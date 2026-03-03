// The OpenAI Sora Videos API uses:
// - POST /v1/videos/generations to create a video (JSON body)
// - GET /v1/videos/generations/{video_id} to poll status
// - GET /v1/videos/generations/{video_id}/content to download MP4
// - GET /v1/videos/generations/{video_id}/content?variant=thumbnail for thumbnail
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
  seconds?: number | string
  size?: string
  model?: string
  created_at?: number
  error?: { message?: string }
}

// Extract a detailed error message from OpenAI API error responses,
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

  // Changed: Use JSON body with POST /v1/videos/generations (correct Sora API endpoint)
  // seconds must be sent as a number, not a string
  const resolvedModel = model === 'sora' ? 'sora-2' : model
  const secondsNum = parseInt(seconds, 10)

  const requestBody = {
    prompt,
    model: resolvedModel,
    size,
    n: 1,
    seconds: secondsNum,
  }

  console.log('[Sora] POST /v1/videos/generations', {
    prompt: prompt.slice(0, 50),
    model: resolvedModel,
    size,
    seconds: secondsNum,
  })

  const response = await fetch(`${OPENAI_API_BASE}/videos/generations`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  })

  if (!response.ok) {
    // Use extractErrorMessage to surface billing errors and other OpenAI errors clearly
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

  // Changed: Use correct endpoint /v1/videos/generations/{video_id}
  const response = await fetch(`${OPENAI_API_BASE}/videos/generations/${videoId}`, {
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

  // Changed: Use correct endpoint /v1/videos/generations/{video_id}/content
  const response = await fetch(`${OPENAI_API_BASE}/videos/generations/${videoId}/content`, {
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

  // Changed: Use correct endpoint /v1/videos/generations/{video_id}/content?variant=thumbnail
  const response = await fetch(
    `${OPENAI_API_BASE}/videos/generations/${videoId}/content?variant=thumbnail`,
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

  // Changed: Use correct endpoint /v1/videos/generations/{video_id}/remix
  const response = await fetch(`${OPENAI_API_BASE}/videos/generations/${videoId}/remix`, {
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