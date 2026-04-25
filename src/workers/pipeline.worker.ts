import { WorkerRequest, WorkerResponse } from './types'

/**
 * Universal Pipeline Worker
 * This worker will eventually handle Transformers.js and media processing.
 * For now, it implements the simulation logic to verify the messaging bridge.
 */

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const { type, payload } = event.data

  try {
    switch (type) {
      case 'SIMULATE_WORK':
        await handleSimulation(payload as { duration: number })
        break

      // Future cases will be added here:
      // case 'INIT_MODELS': ...

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

/**
 * Helper to wrap postMessage with types
 */
function sendResponse(response: WorkerResponse) {
  self.postMessage(response)
}

/**
 * Dummy task to simulate long running background work
 */
async function handleSimulation(payload: { duration: number }) {
  const duration = payload.duration || 5000
  const steps = 10
  const interval = duration / steps

  for (let i = 1; i <= steps; i++) {
    // Check if worker was terminated (though the browser handles this,
    // it's good to keep logic clean)
    await new Promise((resolve) => setTimeout(resolve, interval))

    sendResponse({
      type: 'PROGRESS',
      taskType: 'SIMULATE_WORK',
      progress: (i / steps) * 100,
    })
  }

  sendResponse({
    type: 'SUCCESS',
    taskType: 'SIMULATE_WORK',
    data: { message: 'Simulation complete!' },
  })
}
