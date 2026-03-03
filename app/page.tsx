import { getAllVideos } from '@/lib/cosmic'
import GeneratorPanel from '@/components/GeneratorPanel'
import VideoGallery from '@/components/VideoGallery'
import CosmicBadge from '@/components/CosmicBadge'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const videos = await getAllVideos()
  const bucketSlug = process.env.COSMIC_BUCKET_SLUG as string

  return (
    <main className="min-h-screen bg-surface">
      {/* Header */}
      <header className="border-b border-surface-border bg-surface-card/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-brand flex items-center justify-center flex-shrink-0">
            <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4 text-white" stroke="currentColor" strokeWidth={2}>
              <polygon points="5,3 19,12 5,21" fill="white" />
            </svg>
          </div>
          <div>
            <h1 className="text-white font-bold text-lg leading-tight">Sora 2 Video Generator</h1>
            <p className="text-gray-500 text-xs">Powered by OpenAI</p>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-10">
        {/* Generator */}
        <GeneratorPanel />

        {/* Gallery */}
        {videos.length > 0 && (
          <section>
            <h2 className="text-white font-semibold text-xl mb-5">Your Video Library</h2>
            <VideoGallery videos={videos} />
          </section>
        )}

        {videos.length === 0 && (
          <div className="text-center py-16 text-gray-600">
            <svg viewBox="0 0 24 24" fill="none" className="w-16 h-16 mx-auto mb-4 opacity-30" stroke="currentColor" strokeWidth={1.5}>
              <rect x="2" y="4" width="20" height="16" rx="3" />
              <polygon points="10,9 16,12 10,15" fill="currentColor" />
            </svg>
            <p className="text-lg">No videos yet — generate your first one above!</p>
          </div>
        )}
      </div>

      <CosmicBadge bucketSlug={bucketSlug} />
    </main>
  )
}