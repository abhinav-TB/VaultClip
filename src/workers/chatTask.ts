import { RawImage, TextStreamer } from '@huggingface/transformers'
import { ChatPayload } from './types'
import { ChatMessage, getGenerator, getMemoryUsage, MessageContent, TokenizerLike } from './gemmaRuntime'
import { sendResponse } from './workerMessages'

interface ChatMetrics {
  time: string
  tps: string
  memory?: { used: string } | 'Not supported'
}

interface ChatResponse {
  text: string
  metrics: ChatMetrics
}

export async function handleChat(payload: ChatPayload) {
  try {
    const { processor, model } = await getGenerator()

    sendResponse({
      type: 'LOG',
      taskType: 'CHALLENGE_RESPONSE',
      data: 'Thinking...',
    })

    let finalPrompt = payload.prompt
    const multimodalContent: Exclude<MessageContent, string> = []

    if (payload.attachments && payload.attachments.length > 0) {
      for (const att of payload.attachments) {
        if (att.type === 'text') {
          finalPrompt = `--- DOCUMENT: ${att.name} ---\n${att.data}\n--- END DOCUMENT ---\n\n${finalPrompt}`
        } else if (att.type === 'image') {
          multimodalContent.push({ type: 'image', url: att.data })
        }
      }
    }

    multimodalContent.push({ type: 'text', text: finalPrompt })

    const messages: ChatMessage[] = [
      {
        role: 'user',
        content: multimodalContent.length === 1 ? finalPrompt : multimodalContent,
      },
    ]

    const tokenizer = (processor.tokenizer || processor) as unknown as TokenizerLike
    const streamer = new TextStreamer(tokenizer as ConstructorParameters<typeof TextStreamer>[0], {
      skip_prompt: true,
      skip_special_tokens: true,
      callback_function: (text: string) => {
        sendResponse({
          type: 'LOG',
          taskType: 'CHALLENGE_RESPONSE',
          data: `[STREAM]${text}`,
        })
      },
    })

    const templatedPrompt = processor.apply_chat_template(messages, { tokenize: false, add_generation_prompt: true })
    const textPrompt = typeof templatedPrompt === 'string' ? templatedPrompt : templatedPrompt.toString()

    const rawImageData = payload.attachments?.filter(a => a.type === 'image').map(a => a.data) || []
    const rawImages: RawImage[] = []
    for (const b64 of rawImageData) {
      const img = await RawImage.fromURL(b64)
      rawImages.push(img)
    }

    const inputs = await processor(
      textPrompt,
      rawImages.length > 0 ? rawImages : null,
      null,
    )

    const t0 = performance.now()
    const maxNewTokens = Math.max(32, Math.min(1024, Math.round(payload.maxNewTokens ?? 128)))

    const outputTokens = await model.generate({
      ...inputs,
      max_new_tokens: maxNewTokens,
      temperature: 0.7,
      repetition_penalty: 1.1,
      do_sample: true,
      streamer,
    })

    const t1 = performance.now()
    const duration = (t1 - t0) / 1000
    let generatedText = tokenizer.decode(outputTokens[0], { skip_special_tokens: true })

    if (generatedText.includes('model\n')) {
      generatedText = generatedText.split('model\n').pop() || generatedText
    }

    const finalString = typeof generatedText === 'string' ? generatedText.trim() : 'Failed to parse text'
    const estimatedTokens = finalString.split(/\s+/).length * 1.3
    const tps = (estimatedTokens / duration).toFixed(2)

    sendResponse({
      type: 'SUCCESS',
      taskType: 'CHALLENGE_RESPONSE',
      data: {
        text: finalString,
        metrics: {
          time: duration.toFixed(2),
          tps,
          memory: getMemoryUsage(),
        },
      } satisfies ChatResponse,
    })
  } catch (err) {
    sendResponse({
      type: 'ERROR',
      taskType: 'CHALLENGE_RESPONSE',
      error: err instanceof Error ? err.message : String(err),
    })
  }
}
