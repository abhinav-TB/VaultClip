import { RawImage } from '@huggingface/transformers'
import type { ChatMessage, MessageContent, TokenizerLike } from './gemmaRuntime'
import { getGenerator } from './gemmaRuntime'
import type { FrameSummaryInput, FrameSummaryResultItem, ProcessFramesPayload, ProcessFramesResult } from './types'
import { sendResponse } from './workerMessages'

const FRAME_SUMMARY_MAX_NEW_TOKENS = 96

/**
 * Summarizes sampled video frames segment-by-segment through Gemma.
 *
 * @param payload - Active media session, sampled frames, and segment bounds.
 */
export async function handleProcessFrames(payload: ProcessFramesPayload) {
  if (!payload.sessionId) {
    throw new Error('Frame summarization requires an active media session.')
  }

  if (!payload.frames.length) {
    throw new Error('Sample frames before asking Gemma to summarize them.')
  }

  if (!payload.segmentBounds.length) {
    throw new Error('Segment bounds are missing.')
  }

  const { processor, model } = await getGenerator('PROCESS_FRAMES')
  const tokenizer = (processor.tokenizer || processor) as unknown as TokenizerLike
  const summaries: FrameSummaryResultItem[] = []
  const warnings: string[] = []

  for (let i = 0; i < payload.segmentBounds.length; i++) {
    const segment = payload.segmentBounds[i]
    const segmentFrames = payload.frames.filter(f => f.timestamp >= segment.startTime && f.timestamp <= segment.endTime)

    if (segmentFrames.length === 0) continue

    const progress = Math.round((i / payload.segmentBounds.length) * 100)
    sendResponse({
      type: 'PROGRESS',
      taskType: 'PROCESS_FRAMES',
      progress,
    })
    sendResponse({
      type: 'LOG',
      taskType: 'PROCESS_FRAMES',
      data: `Summarizing segment ${i + 1} of ${payload.segmentBounds.length} (${segmentFrames.length} frames)`,
    })

    try {
      const segmentDuration = Math.round(segment.endTime - segment.startTime)
      const summary = await summarizeSegmentFrames(segmentFrames, segmentDuration, processor, model, tokenizer)
      const result: FrameSummaryResultItem = {
        segmentId: segment.id,
        startTime: segment.startTime,
        endTime: segment.endTime,
        summary,
        source: 'gemma-segment-summary',
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
      warnings.push(`Segment at ${segment.startTime}s could not be summarized: ${message}`)
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

async function summarizeSegmentFrames(
  frames: FrameSummaryInput[],
  segmentDuration: number,
  processor: Awaited<ReturnType<typeof getGenerator>>['processor'],
  model: Awaited<ReturnType<typeof getGenerator>>['model'],
  tokenizer: TokenizerLike,
) {
  const rawImages = await Promise.all(frames.map(f => RawImage.fromURL(f.dataUrl)))
  
  const content: MessageContent = []
  for (const f of frames) {
    content.push({ type: 'image', url: f.dataUrl })
  }
  content.push({
    type: 'text',
    text:
      `Write a concise visual summary for these video frames representing a continuous ${segmentDuration}-second segment. ` +
      'Describe only visible facts: readable text, screens, slides, UI state, people, objects, layout, and actions. ' +
      'Use 1-2 short sentences. Avoid generic openings, markdown, labels, timestamps, and speculation.',
  })

  const messages: ChatMessage[] = [
    {
      role: 'user',
      content,
    },
  ]
  const templatedPrompt = processor.apply_chat_template(messages, { tokenize: false, add_generation_prompt: true })
  const textPrompt = typeof templatedPrompt === 'string' ? templatedPrompt : templatedPrompt.toString()
  const inputs = await processor(textPrompt, rawImages, null)
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
