// Sora video generation using the official OpenAI Videos API.
// SDK: openai.videos.create(), openai.videos.retrieve(), openai.videos.downloadContent()
// Docs: https://developers.openai.com/api/docs/guides/video-generation
//
// The Videos API (in preview) has five endpoints:
//   POST   /v1/videos                  → Start a render job
//   GET    /v1/videos/{video_id}       → Get status & progress
//   GET    /v1/videos/{video_id}/content → Download the MP4
//   GET    /v1/videos                  → List videos
//   DELETE /v1/videos/{video_id}       → Delete a video
//
// Models: "sora-2" (fast) and "sora-2-pro" (quality)
// Sizes: "1280x720", "1920x1080", "480x480" etc.
// Seconds: "4", "8", "12" (string)

import OpenAI from 'openai'

// Changed: Declare type interface for the OpenAI Videos API (preview feature not yet in SDK types)
interface VideosCreateParams {
  model: string
  prompt: string
  size: string
  seconds: string
}

interface VideoObject {
  id: string
  object: string
  status: string
  progress: number
  error?: { message?: string }
}

interface VideoContentResponse {
  arrayBuffer(): Promise<ArrayBuffer>
}

interface VideosNamespace {
  create(params: VideosCreateParams): Promise<VideoObject>
  retrieve(videoId: string): Promise<VideoObject>
  downloadContent(videoId: string, options?: { variant?: string }): Promise<VideoContentResponse>
}

// Changed: Helper to access the videos namespace which exists at runtime but not in SDK types
function getVideosApi(client: OpenAI): VideosNamespace {
  return (client as unknown as { videos: VideosNamespace }).videos
}

function getClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error(
      '[Sora] OPENAI_API_KEY is not set. Add it to your environment variables. ' +
        'Get your key at https://platform.openai.com/api-keys'
    )
  }
  return new OpenAI({ apiKey })
}

// Changed: Map UI sizes to Sora-supported sizes
// Sora supports: 1920x1080, 1080x1920, 1280x720, 720x1280, 1080x1080
function resolveSize(size: string): string {
  const map: Record<string, string> = {
    '1920x1080': '1920x1080',
    '1280x720': '1280x720',
    '480x480': '1080x1080',
  }
  return map[size] ?? '1280x720'
}

// Changed: Extract a meaningful error message from OpenAI SDK errors
function extractSdkError(error: unknown): string {
  if (error instanceof OpenAI.APIError) {
    const parts: string[] = [error.message]
    if (error.type) parts.push(`type=${error.type}`)
    if (error.code) parts.push(`code=${error.code}`)
    if (error.param) parts.push(`param=${error.param}`)
    return parts.join(' | ')
  }
  if (error instanceof Error) return error.message
  return String(error)
}

// ---------------------------------------------------------------------------
// Generate — POST /v1/videos via openai.videos.create()
// ---------------------------------------------------------------------------
// Changed: Uses the official Videos API, NOT /v1/images/generations.
// The SDK method openai.videos.create() sends a POST to /v1/videos
// with multipart/form-data containing: model, prompt, size, seconds.
// Returns a job object with id, status, progress.
export async function startVideoGeneration(
  prompt: string,
  model: string,
  size: string,
  seconds: string
): Promise<{ id: string; status: string; progress: number }> {
  const client = getClient()
  const mappedSize = resolveSize(size)

  // Changed: Use the actual model names from the docs: "sora-2" or "sora-2-pro"
  const resolvedModel = model === 'sora-2-pro' ? 'sora-2-pro' : 'sora-2'

  console.log('[Sora] Starting video generation via openai.videos.create():', {
    prompt: prompt.length > 80 ? prompt.slice(0, 80) + '...' : prompt,
    model: resolvedModel,
    size: mappedSize,
    seconds,
  })

  try {
    // Changed: Use the typed videos API helper
    const videos = getVideosApi(client)
    const video = await videos.create({
      model: resolvedModel,
      prompt,
      size: mappedSize,
      seconds,
    })

    console.log('[Sora] Video generation started:', {
      id: video.id,
      status: video.status,
      progress: video.progress,
    })

    return {
      id: video.id,
      status: video.status ?? 'queued',
      progress: video.progress ?? 0,
    }
  } catch (error) {
    const msg = extractSdkError(error)
    console.error('[Sora] videos.create() error:', msg)
    throw new Error(msg)
  }
}

// ---------------------------------------------------------------------------
// Poll status — GET /v1/videos/{video_id} via openai.videos.retrieve()
// ---------------------------------------------------------------------------
// Changed: Uses the SDK's videos.retrieve() method to get current status.
// Response: { id, status: "queued"|"in_progress"|"completed"|"failed", progress: 0-100 }
export async function getVideoStatus(videoId: string): Promise<{
  id: string
  status: string
  progress: number
  error?: string
}> {
  const client = getClient()

  console.log(`[Sora] Polling status via openai.videos.retrieve(): ${videoId}`)

  try {
    // Changed: Use the typed videos API helper
    const videos = getVideosApi(client)
    const video = await videos.retrieve(videoId)

    const errorMsg = video.error?.message ?? undefined

    console.log(
      `[Sora] Status ${videoId}: ${video.status}, progress=${video.progress ?? 0}${errorMsg ? `, error=${errorMsg}` : ''}`
    )

    return {
      id: video.id,
      status: video.status,
      progress: video.progress ?? 0,
      error: errorMsg,
    }
  } catch (error) {
    const msg = extractSdkError(error)
    console.error(`[Sora] videos.retrieve() error for ${videoId}:`, msg)
    throw new Error(msg)
  }
}

// ---------------------------------------------------------------------------
// Download video — GET /v1/videos/{video_id}/content via openai.videos.downloadContent()
// ---------------------------------------------------------------------------
// Changed: Uses the SDK's videos.downloadContent() method.
// Per the docs, this streams the binary MP4 data.
// "Download URLs are valid for a maximum of 1 hour after generation."
export async function downloadVideoContent(videoId: string): Promise<Buffer> {
  const client = getClient()

  console.log(`[Sora] Downloading video via openai.videos.downloadContent(): ${videoId}`)

  try {
    // Changed: Use the typed videos API helper
    const videos = getVideosApi(client)
    const content = await videos.downloadContent(videoId)

    // Changed: The SDK returns a Response-like object with arrayBuffer()
    const body = content.arrayBuffer()
    const buffer = Buffer.from(await body)

    console.log(`[Sora] Downloaded video ${videoId}: ${buffer.byteLength} bytes`)
    return buffer
  } catch (error) {
    const msg = extractSdkError(error)
    console.error(`[Sora] videos.downloadContent() error for ${videoId}:`, msg)
    throw new Error(msg)
  }
}

// ---------------------------------------------------------------------------
// Download thumbnail — GET /v1/videos/{video_id}/content?variant=thumbnail
// ---------------------------------------------------------------------------
// Changed: Per the docs, you can download thumbnail and spritesheet variants.
// The variant query parameter specifies: "video" (default), "thumbnail", "spritesheet"
export async function downloadThumbnail(videoId: string): Promise<Buffer> {
  const client = getClient()

  console.log(`[Sora] Downloading thumbnail for: ${videoId}`)

  try {
    // Changed: Use the typed videos API helper with variant parameter
    const videos = getVideosApi(client)
    const content = await videos.downloadContent(videoId, {
      variant: 'thumbnail',
    })

    const body = content.arrayBuffer()
    const buffer = Buffer.from(await body)

    console.log(`[Sora] Downloaded thumbnail ${videoId}: ${buffer.byteLength} bytes`)
    return buffer
  } catch (error) {
    const msg = extractSdkError(error)
    console.error(`[Sora] thumbnail download error for ${videoId}:`, msg)
    throw new Error(msg)
  }
}

// ---------------------------------------------------------------------------
// Download from a direct URL (fallback helper)
// ---------------------------------------------------------------------------
export async function downloadVideoFromUrl(videoUrl: string): Promise<Buffer> {
  console.log(`[Sora] Downloading from URL: ${videoUrl.slice(0, 80)}...`)
  const res = await fetch(videoUrl, { redirect: 'follow' })
  if (!res.ok)
    throw new Error(`Download failed: ${res.status} ${res.statusText}`)
  const ab = await res.arrayBuffer()
  console.log(`[Sora] Downloaded ${ab.byteLength} bytes`)
  return Buffer.from(ab)
}

// ---------------------------------------------------------------------------
// Remix — POST /v1/videos/{video_id}/remix
// ---------------------------------------------------------------------------
// Changed: Per the docs, remix uses a dedicated endpoint:
//   POST /v1/videos/<previous_video_id>/remix
//   Body: { "prompt": "..." }
export async function remixVideo(
  videoId: string,
  prompt: string
): Promise<{ id: string; status: string; progress: number }> {
  console.log('[Sora] Remixing video:', {
    originalVideoId: videoId,
    prompt: prompt.slice(0, 80),
  })

  // Changed: The SDK may not have a .remix() method yet, so use raw REST
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('[Sora] OPENAI_API_KEY is not set')

  const url = `https://api.openai.com/v1/videos/${encodeURIComponent(videoId)}/remix`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prompt }),
  })

  const rawText = await res.text()

  if (!res.ok) {
    console.error(`[Sora] Remix error (HTTP ${res.status}):`, rawText)
    let msg = `OpenAI API error: ${res.status} ${res.statusText}`
    try {
      const parsed = JSON.parse(rawText) as {
        error?: { message?: string; type?: string; code?: string }
      }
      if (parsed.error?.message) msg = parsed.error.message
    } catch {
      // raw text already logged
    }
    throw new Error(msg)
  }

  console.log('[Sora] Remix response:', rawText.slice(0, 400))

  const video = JSON.parse(rawText) as {
    id: string
    status: string
    progress: number
  }

  console.log('[Sora] Remix started:', {
    id: video.id,
    status: video.status,
  })

  return {
    id: video.id,
    status: video.status ?? 'queued',
    progress: video.progress ?? 0,
  }
}