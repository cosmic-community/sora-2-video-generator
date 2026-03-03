'use client'

import type { SoraVideo } from '@/types'

interface VideoCardProps {
  video: SoraVideo
  onRemix: () => void
}

export default function VideoCard({ video, onRemix }: VideoCardProps) {
  const { metadata } = video
  const isComplete = metadata.status === 'completed'
  const isFailed = metadata.status === 'failed'
  const isPending =
    metadata.status === 'queued' || metadata.status === 'in_progress'

  // Changed: Use video_url from Cosmic metadata if available for download
  const handleDownload = () => {
    let url: string
    if (metadata.video_url) {
      url = `/api/videos/download?openaiVideoId=${metadata.openai_video_id}&cosmicId=${video.id}&videoUrl=${encodeURIComponent(metadata.video_url)}`
    } else {
      url = `/api/videos/download?openaiVideoId=${metadata.openai_video_id}&cosmicId=${video.id}`
    }
    const a = document.createElement('a')
    a.href = url
    a.download = `sora-${metadata.openai_video_id}.mp4`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}?video=${metadata.openai_video_id}`
    if (navigator.share) {
      await navigator.share({
        title: 'Sora 2 Video',
        text: metadata.prompt,
        url: shareUrl,
      })
    } else {
      await navigator.clipboard.writeText(shareUrl)
      alert('Link copied to clipboard!')
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="bg-surface-card border border-surface-border rounded-xl overflow-hidden hover:border-brand/30 transition-colors duration-200 flex flex-col">
      {/* Thumbnail / video preview */}
      <div className="aspect-video bg-surface flex items-center justify-center relative overflow-hidden">
        {/* Changed: Show actual video preview if video_url is available and completed */}
        {isComplete && metadata.video_url ? (
          <video
            src={metadata.video_url}
            className="w-full h-full object-cover"
            muted
            loop
            playsInline
            onMouseEnter={(e) => {
              const target = e.currentTarget
              target.play().catch(() => {
                // Autoplay may be blocked, that's fine
              })
            }}
            onMouseLeave={(e) => {
              const target = e.currentTarget
              target.pause()
              target.currentTime = 0
            }}
          />
        ) : isComplete ? (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-surface to-surface-elevated">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="w-12 h-12 text-brand opacity-60"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <rect x="2" y="4" width="20" height="16" rx="3" />
              <polygon points="10,9 16,12 10,15" fill="currentColor" />
            </svg>
          </div>
        ) : isPending ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2">
            <svg
              className="animate-spin w-8 h-8 text-brand/50"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              <circle cx="12" cy="12" r="10" strokeOpacity={0.2} />
              <path
                d="M12 2a10 10 0 0 1 10 10"
                strokeLinecap="round"
              />
            </svg>
            <span className="text-xs text-gray-600">
              {metadata.status === 'queued'
                ? 'Queued'
                : `${metadata.progress ?? 0}%`}
            </span>
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="w-10 h-10 text-red-500/40"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
        )}

        {/* Status badge overlay */}
        <div className="absolute top-2 right-2">
          <StatusPill status={metadata.status} />
        </div>

        {/* Model badge */}
        <div className="absolute top-2 left-2">
          <span className="text-xs bg-black/60 text-gray-300 px-2 py-0.5 rounded-md">
            {metadata.model}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 flex flex-col flex-1 space-y-3">
        <div className="flex-1">
          <p className="text-gray-200 text-sm font-medium line-clamp-2 leading-snug">
            {metadata.prompt}
          </p>
          <div className="flex items-center gap-3 mt-2 text-xs text-gray-600">
            <span>{metadata.size ?? '1280×720'}</span>
            <span>·</span>
            <span>{metadata.seconds ?? '5'}s</span>
            <span>·</span>
            <span>{formatDate(video.created_at)}</span>
          </div>
        </div>

        {isFailed && metadata.error_message && (
          <p className="text-red-400 text-xs bg-red-950/30 rounded-lg px-3 py-2">
            {metadata.error_message}
          </p>
        )}

        {isComplete && (
          <div className="flex gap-2">
            <button
              onClick={handleDownload}
              className="btn-primary text-xs flex-1 flex items-center justify-center gap-1.5 py-2"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="w-3.5 h-3.5"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Download
            </button>
            <button
              onClick={handleShare}
              className="btn-secondary text-xs px-3 py-2 flex items-center gap-1.5"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="w-3.5 h-3.5"
                stroke="currentColor"
                strokeWidth={2}
              >
                <circle cx="18" cy="5" r="3" />
                <circle cx="6" cy="12" r="3" />
                <circle cx="18" cy="19" r="3" />
                <line
                  x1="8.59"
                  y1="13.51"
                  x2="15.42"
                  y2="17.49"
                />
                <line
                  x1="15.41"
                  y1="6.51"
                  x2="8.59"
                  y2="10.49"
                />
              </svg>
              Share
            </button>
            <button
              onClick={onRemix}
              className="btn-secondary text-xs px-3 py-2 flex items-center gap-1.5"
              title="Remix this video"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="w-3.5 h-3.5"
                stroke="currentColor"
                strokeWidth={2}
              >
                <polyline points="17 1 21 5 17 9" />
                <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                <polyline points="7 23 3 19 7 15" />
                <path d="M21 13v2a4 4 0 0 1-4 4H3" />
              </svg>
              Remix
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function StatusPill({ status }: { status: string }) {
  const config: Record<string, { label: string; cls: string }> = {
    queued: { label: 'Queued', cls: 'bg-yellow-900/80 text-yellow-300' },
    in_progress: {
      label: 'Rendering',
      cls: 'bg-blue-900/80 text-blue-300',
    },
    completed: { label: 'Ready', cls: 'bg-green-900/80 text-green-300' },
    failed: { label: 'Failed', cls: 'bg-red-900/80 text-red-300' },
  }
  const c = config[status] ?? {
    label: status,
    cls: 'bg-gray-800 text-gray-400',
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${c.cls} font-medium`}>
      {c.label}
    </span>
  )
}