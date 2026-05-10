import type { WorkerRequest, WorkerResponse, WorkerTaskType } from '../workers/types'

/**
 * Promise-based facade over the pipeline worker.
 *
 * Components use this client instead of attaching worker listeners directly.
 */
class WorkerClient {
  private worker: Worker | null = null

  /** Returns the existing worker instance, creating it on first use. */
  private getWorker(): Worker {
    if (!this.worker) {
      this.worker = new Worker(new URL('../workers/pipeline.worker.ts', import.meta.url), {
        type: 'module',
      })
    }
    return this.worker
  }

  /**
   * Executes one background task and resolves when the worker posts SUCCESS.
   *
   * @param type - Worker task type to execute.
   * @param payload - Serializable task payload, except File objects explicitly passed to workers.
   * @param onProgress - Optional progress callback for PROGRESS messages.
   * @param onLog - Optional callback for LOG messages.
   * @param onPartial - Optional callback for PARTIAL messages.
   * @returns Worker SUCCESS payload typed by the caller.
   */
  public runTask<T = unknown>(
    type: WorkerTaskType,
    payload?: unknown,
    onProgress?: (progress: number) => void,
    onLog?: (log: unknown) => void,
    onPartial?: (partial: unknown) => void
  ): Promise<T> {
    const worker = this.getWorker()

    return new Promise((resolve, reject) => {
      const handleMessage = (event: MessageEvent<WorkerResponse>) => {
        const response = event.data

        if (response.taskType !== type) return

        switch (response.type) {
          case 'LOG':
            if (onLog && response.data) {
              onLog(response.data)
            }
            break
          case 'PROGRESS':
            if (onProgress && response.progress !== undefined) {
              onProgress(response.progress)
            }
            break

          case 'PARTIAL':
            if (onPartial && response.data) {
              onPartial(response.data)
            }
            break

          case 'SUCCESS':
            worker.removeEventListener('message', handleMessage)
            resolve(response.data as T)
            break

          case 'ERROR':
            worker.removeEventListener('message', handleMessage)
            reject(new Error(response.error || 'Unknown worker error'))
            break
        }
      }

      worker.addEventListener('message', handleMessage)

      const request: WorkerRequest = { type, payload }
      worker.postMessage(request)
    })
  }

  /**
   * Cancels all background work by terminating the worker.
   *
   * The next task creates a fresh worker with empty in-worker model/ffmpeg state.
   */
  public cancelAll() {
    if (this.worker) {
      this.worker.terminate()
      this.worker = null
    }
  }
}

/** Shared worker client instance used by UI flows. */
export const workerClient = new WorkerClient()
