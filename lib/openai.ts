// The OpenAI Sora Videos API uses:
// - POST /v1/videos to create a video (multipart/form-data)
// - GET /v1/videos/{video_id} to poll status
// - GET /v1/videos/{video_id}/content to download MP4
// - GET /v1/videos/{video_id}/content?variant=thumbnail for thumbnail
// - POST /v1/videos/{video_id}/remix to remix
// Models: sora-2 (fast) and sora-2-pro (quality)

const OPENAI_API_BASE = 'https://api.openai.com/v1'

function getApiKey(): string {
  const key = process.env.OPENAI_API_KEY
  if (!key) {
    throw new Error('OPENAI_API_KEY environment variable is not set')
  }
  return key
}

interface SoraVideoResponse {
  id: string
  object?: string
  status: string
  progress?: number
  seconds?: string
  size?: string
  model?: string
  created_at?: number
  error?: { message?: string }
}

export async function startVideoGeneration(
  prompt: string,
  model: string,
  size: string,
  seconds: string
): Promise<{ id: string; status: string; progress: number }> {
  const apiKey = getApiKey()

  // Changed: Use multipart/form-data as required by the Sora Videos API
  // Endpoint: POST /v1/videos
  // Parameters: prompt, model, size (e.g. "1280x720"), seconds (e.g. "5")
  const formData = new FormData()
  formData.append('prompt', prompt)
  // Changed: Use sora-2 as the correct model name (not "sora")
  formData.append('model', model === 'sora' ? 'sora-2' : model)
  formData.append('size', size)
  formData.append('seconds', seconds)

  console.log('[Sora] POST /v1/videos', { prompt: prompt.slice(0, 50), model, size, seconds })

  const response = await fetch(`${OPENAI_API_BASE}/videos`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      // Do NOT set Content-Type for multipart/form-data — browser sets it with boundary
    },
    body: formData,
  })

  const rawText = await response.text()
  console.log(`[Sora] POST /v1/videos → ${response.status}:`, rawText)

  if (!response.ok) {
    let errorMessage = `Video generation failed with status ${response.status}`
    try {
      const err = JSON.parse(rawText) as { error?: { message?: string; code?: string } }
      if (err?.error?.message) {
        errorMessage = err.error.message
      }
    } catch {
      errorMessage = `Video generation failed (${response.status}): ${rawText}`
    }
    throw new Error(errorMessage)
  }

  const video = JSON.parse(rawText) as SoraVideoResponse
  return {
    id: video.id,
    status: video.status ?? 'queued',
    progress: video.progress ?? 0,
  }
}

export async function getVideoStatus(videoId: string): Promise<{
  id: string
  status: string
  progress: number
  error?: string
}> {
  const apiKey = getApiKey()

  // Changed: Correct endpoint GET /v1/videos/{video_id}
  const response = await fetch(`${OPENAI_API_BASE}/videos/${videoId}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  })

  const rawText = await response.text()
  console.log(`[Sora] GET /v1/videos/${videoId} → ${response.status}:`, rawText)

  if (!response.ok) {
    let errorMessage = `Video status failed with status ${response.status}`
    try {
      const err = JSON.parse(rawText) as { error?: { message?: string } }
      if (err?.error?.message) errorMessage = err.error.message
    } catch {
      // ignore
    }
    throw new Error(errorMessage)
  }

  const video = JSON.parse(rawText) as SoraVideoResponse

  // Derive progress from status if not provided numerically
  let progress = video.progress ?? 0
  if (video.status === 'completed') {
    progress = 100
  } else if (video.status === 'in_progress' && progress === 0) {
    progress = 50
  }

  return {
    id: video.id,
    status: video.status,
    progress,
    error: video.error?.message,
  }
}

export async function downloadVideoContent(videoId: string): Promise<Buffer> {
  const apiKey = getApiKey()

  // Changed: Correct endpoint GET /v1/videos/{video_id}/content (default variant=video)
  const response = await fetch(`${OPENAI_API_BASE}/videos/${videoId}/content`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  })

  if (!response.ok) {
    const rawText = await response.text()
    console.error(`[Sora] Video download failed ${response.status}:`, rawText)
    let errorMessage = `Video download failed with status ${response.status}`
    try {
      const err = JSON.parse(rawText) as { error?: { message?: string } }
      if (err?.error?.message) errorMessage = err.error.message
    } catch {
      // ignore
    }
    throw new Error(errorMessage)
  }

  const arrayBuffer = await response.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

export async function downloadThumbnail(videoId: string): Promise<Buffer> {
  const apiKey = getApiKey()

  // Changed: Correct endpoint with variant=thumbnail query param
  const response = await fetch(
    `${OPENAI_API_BASE}/videos/${videoId}/content?variant=thumbnail`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    }
  )

  if (!response.ok) {
    const rawText = await response.text()
    console.error(`[Sora] Thumbnail download failed ${response.status}:`, rawText)
    let errorMessage = `Thumbnail download failed with status ${response.status}`
    try {
      const err = JSON.parse(rawText) as { error?: { message?: string } }
      if (err?.error?.message) errorMessage = err.error.message
    } catch {
      // ignore
    }
    throw new Error(errorMessage)
  }

  const arrayBuffer = await response.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

export async function remixVideo(
  videoId: string,
  prompt: string
): Promise<{ id: string; status: string; progress: number }> {
  const apiKey = getApiKey()

  // Changed: Correct remix endpoint POST /v1/videos/{video_id}/remix with JSON body
  const response = await fetch(`${OPENAI_API_BASE}/videos/${videoId}/remix`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prompt }),
  })

  const rawText = await response.text()
  console.log(`[Sora] POST /v1/videos/${videoId}/remix → ${response.status}:`, rawText)

  if (!response.ok) {
    let errorMessage = 'Remix failed'
    try {
      const err = JSON.parse(rawText) as { error?: { message?: string } }
      if (err?.error?.message) errorMessage = err.error.message
    } catch {
      // ignore
    }
    throw new Error(errorMessage)
  }

  const video = JSON.parse(rawText) as SoraVideoResponse
  return {
    id: video.id,
    status: video.status ?? 'queued',
    progress: video.progress ?? 0,
  }
}