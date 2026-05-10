import { useCallback, useEffect, useRef, type RefObject } from 'react'
import { clearFrameData, registerFrameData } from '../../lib/frameDataRegistry'
import { sampleVideoFrames } from '../../lib/frameSampler'
import { setProcessingError, setProcessingProgress, setProcessingStatus } from '../slices/processingSlice'
import { clearFrames, setFrameSamplingError, setFrameSamplingProgress, setFrameSamplingReady, setFrameSamplingStarted, type FrameSample } from '../slices/frameSlice'
import type { GenerationSettings } from '../../types/generation'
import { useAppDispatch, useAppSelector } from '../hooks'

/**
 * Owns frame sampling orchestration and sampled frame object URL cleanup.
 *
 * The sampler itself uses DOM video/canvas APIs; Redux receives only
 * serializable metadata and object URL strings.
 */
export function useFrameSampling(settings: GenerationSettings, activeSessionRef: RefObject<string | null>) {
  const dispatch = useAppDispatch()
  const frameObjectUrlsRef = useRef<string[]>([])
  const video = useAppSelector((state) => state.video)
  const frames = useAppSelector((state) => state.frames)
  const isSamplingFrames = frames.status === 'sampling'

  const clearFrameArtifacts = useCallback(() => {
    for (const objectUrl of frameObjectUrlsRef.current) {
      URL.revokeObjectURL(objectUrl)
    }
    frameObjectUrlsRef.current = []
    clearFrameData()
    dispatch(clearFrames())
  }, [dispatch])

  useEffect(() => clearFrameArtifacts, [clearFrameArtifacts])

  const sampleFrames = useCallback(async () => {
    if (!video.sessionId || video.status !== 'ready' || video.mediaKind !== 'video' || !video.fileUrl || !video.duration || isSamplingFrames) {
      return
    }

    const sessionId = video.sessionId
    clearFrameArtifacts()
    dispatch(setFrameSamplingStarted({
      sessionId,
      settings: {
        intervalSeconds: settings.frameIntervalSeconds,
        maxSamples: settings.maxFrameSamples,
        maxWidth: settings.frameMaxWidth,
        imageFormat: settings.frameImageFormat,
        imageQuality: settings.frameImageQuality,
      },
    }))
    dispatch(setProcessingStatus('sampling'))
    dispatch(setProcessingProgress(0))
    dispatch(setProcessingError(''))

    try {
      const sampledFrames = await sampleVideoFrames({
        fileUrl: video.fileUrl,
        duration: video.duration,
        settings,
        onProgress: (progress, phase) => {
          dispatch(setFrameSamplingProgress({ progress, phase }))
          dispatch(setProcessingProgress(progress))
        },
      })

      if (activeSessionRef.current !== sessionId) {
        return
      }

      const samples: FrameSample[] = sampledFrames.map((sample) => {
        const id = `${sessionId}-frame-${sample.index}`
        const objectUrl = URL.createObjectURL(sample.blob)
        frameObjectUrlsRef.current.push(objectUrl)
        registerFrameData(sessionId, id, {
          blob: sample.blob,
          timestamp: sample.timestamp,
          targetTimestamp: sample.targetTimestamp,
          width: sample.width,
          height: sample.height,
          mimeType: sample.mimeType,
        })

        return {
          id,
          index: sample.index,
          timestamp: sample.timestamp,
          targetTimestamp: sample.targetTimestamp,
          objectUrl,
          width: sample.width,
          height: sample.height,
          size: sample.size,
          mimeType: sample.mimeType,
        }
      })

      dispatch(setFrameSamplingReady({ sessionId, samples }))
      dispatch(setProcessingStatus('complete'))
      dispatch(setProcessingProgress(100))
      dispatch(setProcessingError(''))
    } catch (err) {
      if (activeSessionRef.current !== sessionId) return
      const message = err instanceof Error ? err.message : 'Frame sampling failed.'
      dispatch(setFrameSamplingError({ sessionId, message }))
      dispatch(setProcessingError(message))
      dispatch(setProcessingStatus('idle'))
    }
  }, [activeSessionRef, clearFrameArtifacts, dispatch, isSamplingFrames, settings, video.duration, video.fileUrl, video.mediaKind, video.sessionId, video.status])

  return {
    frames,
    isSamplingFrames,
    sampleFrames,
    clearFrameArtifacts,
  }
}
