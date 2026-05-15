export function getChatBlockedMessage(modelReady: boolean, contextReady: boolean, canBuildIndex: boolean) {
  if (!modelReady && canBuildIndex) {
    return 'Build the context index and load Gemma to enable grounded chat.'
  }
  if (!modelReady) {
    return 'Load Gemma while you prepare transcript or frame context from the media.'
  }
  if (!contextReady && canBuildIndex) {
    return 'Build the context index above to enable timestamped media Q&A.'
  }
  return 'Prepare transcript or frame summaries first, then build the context index.'
}

export function getChatInputPlaceholder(modelReady: boolean, contextReady: boolean, canBuildIndex: boolean) {
  if (!modelReady) return 'Load Gemma to start chatting'
  if (!contextReady && canBuildIndex) return 'Build context index before chatting'
  return 'Prepare media context before chatting'
}
