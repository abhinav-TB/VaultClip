import { useCallback, type RefObject } from 'react'
import { getFrameData } from '../../lib/frameDataRegistry'
import { workerClient } from '../../services/workerClient'
import type { ProcessFramesPartialResult, ProcessFramesResult } from '../../workers/types'
import { useAppDispatch, useAppSelector } from '../hooks'
import { setProcessingError, setProcessingProgress, setProcessingStatus } from '../slices/processingSlice'
import {
  appendFrameSummary,
  setFrameSummaryError,
  setFrameSummaryProgress,
  setFrameSummaryReady,
  setFrameSummaryStarted,
} from '../slices/frameSlice'

/**
 * Owns Gemma frame-summary orchestration.
 *
 * Frame image blobs stay in the in-memory registry; the worker receives
 * temporary data URLs because the existing Gemma image path consumes URLs.
 */
export function useFrameSummaries(activeSessionRef: RefObject<string | null>) {
  const dispatch = useAppDispatch()
  const video = useAppSelector((state) => state.video)
  const frames = useAppSelector((state) => state.frames)
  const modelReady = useAppSelector((state) => state.model.status === 'ready')
  const isSummarizingFrames = frames.summaryStatus === 'summarizing'

  const summarizeFrames = useCallback(async () => {
    if (!video.sessionId || video.status !== 'ready' || video.mediaKind !== 'video' || frames.status !== 'ready' || isSummarizingFrames || !modelReady) {
      return
    }

    const sessionId = video.sessionId
    const frameData = getFrameData(sessionId)
    if (!frameData.length) {
      dispatch(setFrameSummaryError({
        sessionId,
        message: 'Sampled frame images are no longer available in browser memory. Sample frames again and retry.',
      }))
      return
    }

    dispatch(setFrameSummaryStarted({ sessionId }))
    dispatch(setProcessingStatus('summarizing'))
    dispatch(setProcessingProgress(0))
    dispatch(setProcessingError(''))

    try {
      const frameDataById = new Map(frameData)
      const frameInputs = await Promise.all(frames.samples.map(async (sample) => {
        const data = frameDataById.get(sample.id)
        if (!data) return null

        return {
          id: sample.id,
          index: sample.index,
          timestamp: sample.timestamp,
          targetTimestamp: sample.targetTimestamp,
          mimeType: sample.mimeType,
          dataUrl: await blobToDataUrl(data.blob),
        }
      }))
      const availableFrames = frameInputs.filter((frame): frame is NonNullable<typeof frame> => Boolean(frame))

      if (!availableFrames.length) {
        throw new Error('Sampled frame images are no longer available in browser memory. Sample frames again and retry.')
      }

      const result = await workerClient.runTask<ProcessFramesResult>('PROCESS_FRAMES', {
        sessionId,
        frames: availableFrames,
      }, (progress) => {
        dispatch(setFrameSummaryProgress({ progress }))
        dispatch(setProcessingProgress(progress))
      }, (log) => {
        if (typeof log === 'string') {
          dispatch(setFrameSummaryProgress({
            progress: frames.summaryProgress,
            phase: log,
          }))
        }
      }, (partial) => {
        const partialResult = partial as ProcessFramesPartialResult
        if (partialResult.sessionId === activeSessionRef.current) {
          dispatch(appendFrameSummary({
            sessionId: partialResult.sessionId,
            summary: partialResult.summary,
          }))
        }
      })

      if (activeSessionRef.current !== result.sessionId) return

      dispatch(setFrameSummaryReady({
        sessionId: result.sessionId,
        summaries: result.summaries,
        warnings: result.warnings,
      }))
      dispatch(setProcessingStatus('complete'))
      dispatch(setProcessingProgress(100))
      dispatch(setProcessingError(''))
    } catch (err) {
      if (activeSessionRef.current !== sessionId) return
      const message = err instanceof Error ? err.message : 'Frame summarization failed.'
      dispatch(setFrameSummaryError({ sessionId, message }))
      dispatch(setProcessingError(message))
      dispatch(setProcessingStatus('idle'))
    }
  }, [activeSessionRef, dispatch, frames.samples, frames.status, frames.summaryProgress, isSummarizingFrames, modelReady, video.mediaKind, video.sessionId, video.status])

  return {
    isSummarizingFrames,
    summarizeFrames,
  }
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
      } else {
        reject(new Error('Could not convert frame image to a data URL.'))
      }
    }
    reader.onerror = () => reject(new Error('Could not read sampled frame image from browser memory.'))
    reader.readAsDataURL(blob)
  })
}
