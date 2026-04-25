import { WorkerRequest, WorkerResponse, WorkerTaskType } from '../workers/types'

/**
 * WorkerClient handles the low-level lifecycle of the Pipeline Worker.
 * It provides a Promise-based API for components and manages cancellation.
 */
class WorkerClient {
  private worker: Worker | null = null

  /**
   * Initializes or returns the existing worker instance
   */
  private getWorker(): Worker {
    if (!this.worker) {
      // Use Vite's worker constructor
      this.worker = new Worker(new URL('../workers/pipeline.worker.ts', import.meta.url), {
        type: 'module',
      })
    }
    return this.worker
  }

  /**
   * Executes a task in the background.
   * Returns a promise that resolves on SUCCESS or rejects on ERROR.
   */
  public runTask<T = unknown>(
    type: WorkerTaskType,
    payload?: unknown,
    onProgress?: (progress: number) => void
  ): Promise<T> {
    const worker = this.getWorker()

    return new Promise((resolve, reject) => {
      // Internal listener specifically for this task instance
      const handleMessage = (event: MessageEvent<WorkerResponse>) => {
        const response = event.data

        // Verify this message belongs to our current task type
        if (response.taskType !== type) return

        switch (response.type) {
          case 'PROGRESS':
            if (onProgress && response.progress !== undefined) {
              onProgress(response.progress)
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

      // Send the actual request
      const request: WorkerRequest = { type, payload }
      worker.postMessage(request)
    })
  }

  /**
   * Hard cancellation of all background work.
   * Kills the thread and cleans up the instance.
   */
  public cancelAll() {
    if (this.worker) {
      this.worker.terminate()
      this.worker = null
    }
  }
}

// Export as a singleton
export const workerClient = new WorkerClient()
