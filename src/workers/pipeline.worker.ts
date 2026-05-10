import { handleExtractAudio } from './audioExtractionTask'
import { handleChat } from './chatTask'
import { handleProcessFrames } from './frameSummaryTask'
import { handleInitModels } from './gemmaRuntime'
import { handleTranscribe } from './transcriptionTask'
import type { ChatPayload, ExtractAudioPayload, ProcessFramesPayload, TranscribePayload, WorkerRequest } from './types'
import { sendResponse } from './workerMessages'

// Single worker entrypoint. Keep this file as a thin router so model, ffmpeg,
// chat, and transcription code can be reviewed independently.
self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const { type, payload } = event.data

  try {
    switch (type) {
      case 'INIT_MODELS':
        await handleInitModels()
        break
      case 'CHALLENGE_RESPONSE':
        await handleChat(payload as ChatPayload)
        break
      case 'EXTRACT_AUDIO':
        await handleExtractAudio(payload as ExtractAudioPayload)
        break
      case 'TRANSCRIBE':
        await handleTranscribe(payload as TranscribePayload)
        break
      case 'PROCESS_FRAMES':
        await handleProcessFrames(payload as ProcessFramesPayload)
        break
      default:
        sendResponse({
          type: 'ERROR',
          taskType: type,
          error: `Unknown task type: ${type}`,
        })
    }
  } catch (err) {
    sendResponse({
      type: 'ERROR',
      taskType: type,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}
