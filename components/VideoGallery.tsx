'use client'

import { useState } from 'react'
import type { SoraVideo } from '@/types'
import VideoCard from '@/components/VideoCard'

interface VideoGalleryProps {
  videos: SoraVideo[]
}

export default function VideoGallery({ videos }: VideoGalleryProps) {
  const [remixingId, setRemixingId] = useState<string | null>(null)
  const [remixPrompt, setRemixPrompt] = useState('')
  const [remixLoading, setRemixLoading] = useState(false)
  const [remixError, setRemixError] = useState<string | null>(null)

  const handleStartRemix = (videoId: string) => {
    setRemixingId(videoId)
    setRemixPrompt('')
    setRemixError(null)
  }

  const handleCancelRemix = () => {
    setRemixingId(null)
    setRemixPrompt('')
    setRemixError(null)
  }

  const handleSubmitRemix = async (openaiVideoId: string, cosmicId: string) => {
    if (!remixPrompt.trim()) return
    setRemixLoading(true)
    setRemixError(null)

    try {
      const res = await fetch('/api/videos/remix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: remixPrompt.trim(),
          openai_video_id: openaiVideoId,
          cosmic_id: cosmicId,
        }),
      })
      const json = (await res.json()) as { data?: unknown; error?: string }
      if (json.error) {
        setRemixError(json.error)
      } else {
        setRemixingId(null)
        setRemixPrompt('')
        // Refresh the page to show new remix in gallery
        window.location.reload()
      }
    } catch {
      setRemixError('Failed to start remix — please try again')
    } finally {
      setRemixLoading(false)
    }
  }

  if (videos.length === 0) return null

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {videos.map((video) => (
          <div key={video.id}>
            <VideoCard
              video={video}
              onRemix={() => handleStartRemix(video.id)}
            />

            {remixingId === video.id && (
              <div className="mt-3 bg-surface-elevated border border-brand/30 rounded-xl p-4 space-y-3">
                <p className="text-sm text-gray-300 font-medium">Remix this video</p>
                <textarea
                  value={remixPrompt}
                  onChange={(e) => setRemixPrompt(e.target.value)}
                  placeholder="Describe what to change… e.g. 'Change the sky to a sunset with pink and orange hues.'"
                  rows={3}
                  className="input-field text-sm resize-none"
                />
                {remixError && (
                  <p className="text-red-400 text-xs">{remixError}</p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      handleSubmitRemix(
                        video.metadata.openai_video_id,
                        video.id
                      )
                    }
                    disabled={!remixPrompt.trim() || remixLoading}
                    className="btn-primary text-sm flex-1"
                  >
                    {remixLoading ? 'Starting…' : 'Start Remix'}
                  </button>
                  <button
                    onClick={handleCancelRemix}
                    disabled={remixLoading}
                    className="btn-secondary text-sm px-4"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}