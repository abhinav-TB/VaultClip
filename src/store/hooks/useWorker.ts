import { useCallback } from 'react'
import { useAppDispatch } from '../hooks'
import { workerClient } from '../../services/workerClient'
import {
  setProcessingStatus,
  setProcessingProgress,
  setProcessingError,
} from '../slices/processingSlice'
import { setError, setLoadDetails, setProgress, setStatus } from '../slices/modelSlice'
import { ModelLoadEvent, WorkerTaskType } from '../../workers/types'

/**
 * useWorker provides a clean way for UI components to trigger
 * background tasks and have the global Redux state updated automatically.
 */
export const useWorker = () => {
  const dispatch = useAppDispatch()

  const loadModel = useCallback(async () => {
    dispatch(setStatus('loading'))
    dispatch(setProgress(0))
    let lastProgress = -1
    let lastDetailAt = 0
    let lastDetailKey = ''
    let lastLoadedBytes = 0

    try {
      await workerClient.runTask('INIT_MODELS', undefined, (progress) => {
        const nextProgress = Math.floor(progress)
        if (nextProgress !== lastProgress) {
          lastProgress = nextProgress
          dispatch(setProgress(nextProgress))
        }
      }, (event) => {
        if (isModelLoadEvent(event)) {
          const now = Date.now()
          const detailKey = `${event.stage}|${event.source}|${event.file ?? ''}|${event.total ?? ''}`
          const loadedDelta = Math.abs((event.loaded ?? 0) - lastLoadedBytes)
          const shouldPublish =
            detailKey !== lastDetailKey ||
            now - lastDetailAt > 600 ||
            loadedDelta > 32 * 1024 * 1024 ||
            event.stage === 'ready' ||
            event.stage === 'failed'

          if (!shouldPublish) return

          lastDetailAt = now
          lastDetailKey = detailKey
          lastLoadedBytes = event.loaded ?? lastLoadedBytes

          dispatch(setLoadDetails({
            loadStage: event.stage,
            loadSource: event.source,
            loadMessage: event.message,
            currentFile: event.file ?? null,
            loadedBytes: event.loaded ?? null,
            totalBytes: event.total ?? null,
          }))
        }
      })

      dispatch(setProgress(100))
      dispatch(setStatus('ready'))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Model failed to load'
      dispatch(setError(message))
      throw err
    }
  }, [dispatch])

  const startTask = useCallback(
    async <T = unknown>(type: WorkerTaskType, payload?: unknown, onLog?: (log: string) => void) => {
      // 1. Reset potential previous errors and set status
      dispatch(setProcessingError(''))
      // Map WorkerTaskType to ProcessingStatus logically
      dispatch(setProcessingStatus('idle')) // This would be more specific in a real mapping
      dispatch(setProcessingProgress(0))

      try {
        const result = await workerClient.runTask<T>(type, payload, (progress) => {
          dispatch(setProcessingProgress(progress))
        }, (log) => {
          if (typeof log === 'string') {
            onLog?.(log)
          }
        })

        dispatch(setProcessingStatus('complete'))
        return result
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Task failed'
        dispatch(setProcessingError(message))
        throw err
      }
    },
    [dispatch]
  )

  const cancelWork = useCallback(() => {
    workerClient.cancelAll()
    dispatch(setProcessingStatus('idle'))
    dispatch(setProcessingProgress(0))
    dispatch(setProcessingError('Work cancelled by user'))
  }, [dispatch])

  return { startTask, cancelWork, loadModel }
}

function isModelLoadEvent(event: unknown): event is ModelLoadEvent {
  return (
    typeof event === 'object' &&
    event !== null &&
    'stage' in event &&
    'source' in event &&
    'message' in event
  )
}
