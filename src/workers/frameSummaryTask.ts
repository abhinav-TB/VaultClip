import { RawImage } from '@huggingface/transformers'
import type { ChatMessage, TokenizerLike } from './gemmaRuntime'
import { getGenerator } from './gemmaRuntime'
import type { FrameSummaryInput, FrameSummaryResultItem, ProcessFramesPayload, ProcessFramesResult } from './types'
import { sendResponse } from './workerMessages'

const FRAME_SUMMARY_MAX_NEW_TOKENS = 96

/**
 * Summarizes sampled video frames one at a time through Gemma.
 *
 * Per-frame generation keeps each summary tied to one timestamp and lets the
 * UI render partial results as soon as each image finishes.
 *
 * @param payload - Active media session plus sampled frame data URLs.
 */
export async function handleProcessFrames(payload: ProcessFramesPayload) {
  if (!payload.sessionId) {
    throw new Error('Frame summarization requires an active media session.')
  }

  if (!payload.frames.length) {
    throw new Error('Sample frames before asking Gemma to summarize them.')
  }

  const { processor, model } = await getGenerator('PROCESS_FRAMES')
  const tokenizer = (processor.tokenizer || processor) as unknown as TokenizerLike
  const summaries: FrameSummaryResultItem[] = []
  const warnings: string[] = []

  for (const frame of payload.frames) {
    const progress = Math.round((frame.index / payload.frames.length) * 100)
    sendResponse({
      type: 'PROGRESS',
      taskType: 'PROCESS_FRAMES',
      progress,
    })
    sendResponse({
      type: 'LOG',
      taskType: 'PROCESS_FRAMES',
      data: `Summarizing frame ${frame.index + 1} of ${payload.frames.length}`,
    })

    try {
      const summary = await summarizeOneFrame(frame, processor, model, tokenizer)
      const result: FrameSummaryResultItem = {
        frameId: frame.id,
        index: frame.index,
        timestamp: frame.timestamp,
        targetTimestamp: frame.targetTimestamp,
        summary,
        source: 'gemma-frame-summary',
      }

      summaries.push(result)
      sendResponse({
        type: 'PARTIAL',
        taskType: 'PROCESS_FRAMES',
        data: {
          sessionId: payload.sessionId,
          summary: result,
        },
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      warnings.push(`Frame ${frame.index + 1} could not be summarized: ${message}`)
    }
  }

  if (!summaries.length) {
    throw new Error(warnings[0] ?? 'Gemma could not summarize any sampled frames.')
  }

  sendResponse({
    type: 'PROGRESS',
    taskType: 'PROCESS_FRAMES',
    progress: 100,
  })
  sendResponse({
    type: 'SUCCESS',
    taskType: 'PROCESS_FRAMES',
    data: {
      sessionId: payload.sessionId,
      summaries,
      warnings,
    } satisfies ProcessFramesResult,
  })
}

async function summarizeOneFrame(
  frame: FrameSummaryInput,
  processor: Awaited<ReturnType<typeof getGenerator>>['processor'],
  model: Awaited<ReturnType<typeof getGenerator>>['model'],
  tokenizer: TokenizerLike,
) {
  const rawImage = await RawImage.fromURL(frame.dataUrl)
  const messages: ChatMessage[] = [
    {
      role: 'user',
      content: [
        { type: 'image', url: frame.dataUrl },
        {
          type: 'text',
          text:
            'Write a concise visual summary for this sampled video frame. ' +
            'Describe only visible facts: readable text, screens, slides, UI state, people, objects, layout, and actions. ' +
            'Use 1-2 short sentences. Avoid generic openings, markdown, labels, timestamps, and speculation.',
        },
      ],
    },
  ]
  const templatedPrompt = processor.apply_chat_template(messages, { tokenize: false, add_generation_prompt: true })
  const textPrompt = typeof templatedPrompt === 'string' ? templatedPrompt : templatedPrompt.toString()
  const inputs = await processor(textPrompt, [rawImage], null)
  const outputTokens = await model.generate({
    ...inputs,
    max_new_tokens: FRAME_SUMMARY_MAX_NEW_TOKENS,
    repetition_penalty: 1.04,
    do_sample: false,
  })
  const decoded = tokenizer.decode(outputTokens[0], { skip_special_tokens: true })
  const cleaned = cleanFrameSummary(decoded)

  if (!cleaned) {
    throw new Error('Gemma returned an empty frame summary.')
  }

  return cleaned
}

function cleanFrameSummary(text: string) {
  let cleaned = text
    .replace(/```[\s\S]*?```/g, (match) => match.replace(/```(?:\w+)?|```/g, ''))
    .replace(/\r/g, '\n')
    .trim()

  if (cleaned.includes('model\n')) {
    cleaned = cleaned.split('model\n').pop() ?? cleaned
  }

  cleaned = cleaned
    .replace(/^(?:user|model|assistant)(?:\s*\n|:\s+)/i, '')
    .replace(/^(?:frame summary|summary|visual summary)\s*:\s*/i, '')
    .replace(/^["'\s]+|["'\s]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  return cleaned
}
