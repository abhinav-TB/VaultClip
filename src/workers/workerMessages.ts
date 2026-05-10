import type { ModelLoadEvent, WorkerRequest, WorkerResponse } from './types'

/**
 * Posts a typed worker response back to the main thread.
 *
 * @param response - Worker response envelope consumed by the main thread.
 */
export function sendResponse(response: WorkerResponse) {
  self.postMessage(response)
}

/**
 * Sends a structured model-load status event through the worker log channel.
 *
 * @param taskType - Worker task associated with this model-load event.
 * @param event - Structured model loading details for the UI.
 */
export function sendModelLoadEvent(taskType: WorkerRequest['type'], event: ModelLoadEvent) {
  sendResponse({
    type: 'LOG',
    taskType,
    data: event,
  })
}
