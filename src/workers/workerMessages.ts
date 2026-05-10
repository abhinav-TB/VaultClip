import { ModelLoadEvent, WorkerRequest, WorkerResponse } from './types'

export function sendResponse(response: WorkerResponse) {
  self.postMessage(response)
}

export function sendModelLoadEvent(taskType: WorkerRequest['type'], event: ModelLoadEvent) {
  sendResponse({
    type: 'LOG',
    taskType,
    data: event,
  })
}
