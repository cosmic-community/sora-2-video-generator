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

// Changed: Extract a detailed error message from OpenAI API error responses,
// including billing errors like "Billing hard limit has been reached"
async function extractErrorMessage(response: Response, context: string): Promise<string> {
  let errorMessage = `${context} failed with status ${response.status}`
  try {
    const rawText = await response.text()
    console.error(`[Sora] ${context} error (${response.status}):`, rawText)
    const err = JSON.parse(rawText) as {
      error?: { message?: string; code?: string; type?: string }
    }
    if (err?.error?.message) {
      // Surface the exact OpenAI error message (e.g. "Billing hard limit has been reached")
      errorMessage = err.error.message
    }
  } catch {
    // ignore JSON parse errors — keep default message
  }
  return errorMessage
}

export async function startVideoGeneration(
  prompt: string,
  model: string,
  size: string,
  seconds: string
): Promise<{ id: string; status: string; progress: number }> {
  const apiKey = getApiKey()

  // Use multipart/form-data as required by the Sora Videos API
  // Endpoint: POST /v1/videos
  const formData = new FormData()
  formData.append('prompt', prompt)
  formData.append('model', model === 'sora' ? 'sora-2' : model)
  formData.append('size', size)
  formData.append('seconds', seconds)

  console.log('[Sora] POST /v1/videos', { prompt: prompt.slice(0, 50), model, size, seconds })

  const response = await fetch(`${OPENAI_API_BASE}/videos`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      // Do NOT set Content-Type for multipart/form-data — fetch sets it with boundary automatically
    },
    body: formData,
  })

  if (!response.ok) {
    // Changed: Use extractErrorMessage to surface billing errors and other OpenAI errors clearly
    const errorMessage = await extractErrorMessage(response, 'Video generation')
    throw new Error(errorMessage)
  }

  const rawText = await response.text()
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

  const response = await fetch(`${OPENAI_API_BASE}/videos/${videoId}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const errorMessage = await extractErrorMessage(response, 'Video status')
    throw new Error(errorMessage)
  }

  const rawText = await response.text()
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

  const response = await fetch(`${OPENAI_API_BASE}/videos/${videoId}/content`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  })

  if (!response.ok) {
    const errorMessage = await extractErrorMessage(response, 'Video download')
    throw new Error(errorMessage)
  }

  const arrayBuffer = await response.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

export async function downloadThumbnail(videoId: string): Promise<Buffer> {
  const apiKey = getApiKey()

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
    const errorMessage = await extractErrorMessage(response, 'Thumbnail download')
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

  const response = await fetch(`${OPENAI_API_BASE}/videos/${videoId}/remix`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prompt }),
  })

  if (!response.ok) {
    const errorMessage = await extractErrorMessage(response, 'Remix')
    throw new Error(errorMessage)
  }

  const rawText = await response.text()
  const video = JSON.parse(rawText) as SoraVideoResponse
  return {
    id: video.id,
    status: video.status ?? 'queued',
    progress: video.progress ?? 0,
  }
}