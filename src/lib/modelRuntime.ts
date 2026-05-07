export function getSourceLabel(source: string) {
  if (source === 'cache') return 'Browser cache'
  if (source === 'network') return 'Hugging Face'
  if (source === 'memory') return 'Worker memory'
  return 'Checking'
}

export function getStageLabel(stage: string) {
  if (stage === 'checking-cache') return 'Checking cache'
  if (stage === 'loading-cache') return 'Reading cached file'
  if (stage === 'downloading') return 'Downloading model file'
  if (stage === 'initializing') return 'Initializing WebGPU'
  if (stage === 'ready') return 'Ready'
  if (stage === 'failed') return 'Failed'
  return 'Not loaded'
}

export function getLoadingMessage(stage: string, source: string) {
  if (stage === 'checking-cache') return 'Checking whether Gemma is already stored in this browser.'
  if (stage === 'loading-cache') return 'Loading Gemma from browser cache. Chat will unlock when WebGPU initialization finishes.'
  if (stage === 'downloading') return 'Downloading Gemma model files from Hugging Face, then caching them for future launches.'
  if (stage === 'initializing') return 'Model files are ready. Initializing Gemma on WebGPU.'
  return `Preparing Gemma using ${getSourceLabel(source).toLowerCase()}.`
}

export function getPhaseProgressLabel(stage: string, source: string) {
  if (stage === 'checking-cache') return 'Looking for existing browser storage'
  if (stage === 'loading-cache') return 'Using cached model files'
  if (stage === 'downloading') return 'Fetching model files and saving them locally'
  if (stage === 'initializing') return 'Preparing WebGPU inference session'
  return `Preparing with ${getSourceLabel(source).toLowerCase()}`
}
