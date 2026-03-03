// OpenAI Sora Videos API endpoints (from official docs):
// - POST   /v1/videos                          — create video (multipart/form-data)
// - GET    /v1/videos/{video_id}               — get status
// - GET    /v1/videos/{video_id}/content       — download MP4 (variant=video)
// - GET    /v1/videos/{video_id}/content?variant=thumbnail — thumbnail
// - POST   /v1/videos/{video_id}/remix         — remix (JSON body)
// - GET    /v1/videos                          — list videos
// - DELETE /v1/videos/{video_id}               — delete video

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

  // Changed: Correct endpoint is POST /v1/videos with multipart/form-data
  // per official OpenAI docs:
  // curl -X POST "https://api.openai.com/v1/videos"
  //   -H "Content-Type: multipart/form-data"
  //   -F model="sora-2-pro"
  //   -F prompt="..."
  //   -F size="1280x720"
  //   -F seconds="8"
  const resolvedModel = model === 'sora' ? 'sora-2' : model

  const formData = new FormData()
  formData.append('prompt', prompt)
  formData.append('model', resolvedModel)
  formData.append('size', size)
  formData.append('seconds', seconds) // docs show seconds as a string form field

  console.log('[Sora] POST /v1/videos (multipart/form-data)', {
    prompt: prompt.slice(0, 50),
    model: resolvedModel,
    size,
    seconds,
  })

  // Changed: Use /v1/videos (not /v1/videos/generations)
  const response = await fetch(`${OPENAI_API_BASE}/videos`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      // Do NOT set Content-Type manually — fetch sets it automatically with the boundary for FormData
    },
    body: formData,
  })

  if (!response.ok) {
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

  // Changed: Correct endpoint is GET /v1/videos/{video_id}
  const response = await fetch(`${OPENAI_API_BASE}/videos/${videoId}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
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

  // Changed: Correct endpoint is GET /v1/videos/{video_id}/content
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

  // Changed: Correct endpoint is GET /v1/videos/{video_id}/content?variant=thumbnail
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

  // Changed: Correct endpoint is POST /v1/videos/{video_id}/remix with JSON body
  // per official OpenAI docs:
  // curl -X POST "https://api.openai.com/v1/videos/<previous_video_id>/remix"
  //   -H "Content-Type: application/json"
  //   -d '{ "prompt": "..." }'
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