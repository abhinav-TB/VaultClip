import type { MediaKind } from '../store/slices/videoSlice'
import { MediaMetadataGrid, MediaPreview, VideoWarnings } from './VideoUploadPanelSections'

export const NormalMediaSummary = ({
  mediaKind,
  fileUrl,
  name,
  size,
  duration,
  type,
  sessionId,
  warnings,
}: {
  mediaKind: MediaKind | null
  fileUrl: string | null
  name: string | null
  size: number | null
  duration: number | null
  type: string | null
  sessionId: string | null
  warnings: string[]
}) => (
  <div className="space-y-4">
    <div className="overflow-hidden rounded-lg border border-gray-800 bg-gray-950/50">
      <MediaPreview mediaKind={mediaKind} fileUrl={fileUrl} />
    </div>
    <MediaMetadataGrid mediaKind={mediaKind} name={name} size={size} duration={duration} type={type} sessionId={sessionId} />
    {warnings.length > 0 && <VideoWarnings warnings={warnings} />}
  </div>
)
