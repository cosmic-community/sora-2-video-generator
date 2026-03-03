// Direct REST API calls to the OpenAI Sora Videos API.
// The openai Node.js SDK does not yet expose a .videos namespace at runtime,
// so we call the HTTP endpoints directly.
// Official docs: https://developers.openai.com/api/docs/guides/video-generation

const OPENAI_API_BASE = 'https://api.openai.com/v1'

// Changed: Response shape from the Sora Videos API
interface SoraVideoResponse {
  id: string
  object: string
  created_at: number
  status: string
  model: string
  progress: number
  seconds: string
  size: string
  error?: { message?: string } | null
}

function getApiKey(): string {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is not set')
  }
  return apiKey
}

// Changed: Helper for JSON-based OpenAI API requests (used for GET, remix, etc.)
async function openaiJsonRequest<T>(
  path: string,
  options: {
    method?: string
    body?: Record<string, unknown>
  } = {}
): Promise<T> {
  const apiKey = getApiKey()
  const { method = 'GET', body } = options

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${apiKey}`,
  }

  const fetchOptions: RequestInit = {
    method,
    headers,
  }

  if (body) {
    headers['Content-Type'] = 'application/json'
    fetchOptions.body = JSON.stringify(body)
  }

  const url = `${OPENAI_API_BASE}${path}`
  console.log(`[Sora] ${method} ${url}`)

  const res = await fetch(url, fetchOptions)

  if (!res.ok) {
    let errorMessage = `OpenAI API error: ${res.status} ${res.statusText}`
    try {
      const errorBody = (await res.json()) as { error?: { message?: string } }
      if (errorBody?.error?.message) {
        errorMessage = errorBody.error.message
      }
    } catch {
      // Could not parse error body, use default message
    }
    throw new Error(errorMessage)
  }

  return res.json() as Promise<T>
}

export async function startVideoGeneration(
  prompt: string,
  model: string,
  size: string,
  seconds: string
): Promise<{ id: string; status: string; progress: number }> {
  // Resolve model alias: 'sora' → 'sora-2'
  const resolvedModel = model === 'sora' ? 'sora-2' : model

  console.log('[Sora] Creating video via REST API (JSON body)', {
    prompt: prompt.slice(0, 60),
    model: resolvedModel,
    size,
    seconds,
  })

  const apiKey = getApiKey()

  // Changed: Use JSON body instead of multipart/form-data for reliable
  // server-side fetch in Next.js. The OpenAI Videos API accepts both formats.
  // multipart/form-data via Node.js FormData + fetch can produce malformed
  // boundaries in some server runtimes, causing 400 / "Failed to start generation".
  const url = `${OPENAI_API_BASE}/videos`
  console.log(`[Sora] POST ${url}`)

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt,
      model: resolvedModel,
      size,
      seconds: parseInt(seconds, 10),
    }),
  })

  if (!res.ok) {
    let errorMessage = `OpenAI API error: ${res.status} ${res.statusText}`
    try {
      const errorBody = (await res.json()) as { error?: { message?: string } }
      if (errorBody?.error?.message) {
        errorMessage = errorBody.error.message
      }
    } catch {
      // Could not parse error body
    }
    throw new Error(errorMessage)
  }

  const video = (await res.json()) as SoraVideoResponse

  console.log('[Sora] Video created:', { id: video.id, status: video.status })

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
  // Changed: Correct endpoint per docs: GET /v1/videos/{video_id}
  const video = await openaiJsonRequest<SoraVideoResponse>(
    `/videos/${encodeURIComponent(videoId)}`
  )

  // Derive progress from status if not provided numerically
  let progress = video.progress ?? 0
  if (video.status === 'completed') {
    progress = 100
  } else if (video.status === 'in_progress' && progress === 0) {
    progress = 50
  }

  const errorMessage = video.error?.message ?? undefined

  return {
    id: video.id,
    status: video.status,
    progress,
    error: errorMessage,
  }
}

export async function downloadVideoContent(videoId: string): Promise<Buffer> {
  const apiKey = getApiKey()

  // Changed: Correct endpoint per docs: GET /v1/videos/{video_id}/content
  const url = `${OPENAI_API_BASE}/videos/${encodeURIComponent(videoId)}/content`
  console.log(`[Sora] GET ${url}`)

  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
    // Changed: Follow redirects for download URLs
    redirect: 'follow',
  })

  if (!res.ok) {
    let errorMessage = `Download failed: ${res.status} ${res.statusText}`
    try {
      const errorBody = (await res.json()) as { error?: { message?: string } }
      if (errorBody?.error?.message) {
        errorMessage = errorBody.error.message
      }
    } catch {
      // Could not parse error body
    }
    throw new Error(errorMessage)
  }

  const arrayBuffer = await res.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

export async function downloadThumbnail(videoId: string): Promise<Buffer> {
  const apiKey = getApiKey()

  // Changed: Correct endpoint per docs: GET /v1/videos/{video_id}/content?variant=thumbnail
  const url = `${OPENAI_API_BASE}/videos/${encodeURIComponent(videoId)}/content?variant=thumbnail`
  console.log(`[Sora] GET ${url} (thumbnail)`)

  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
    redirect: 'follow',
  })

  if (!res.ok) {
    let errorMessage = `Thumbnail download failed: ${res.status} ${res.statusText}`
    try {
      const errorBody = (await res.json()) as { error?: { message?: string } }
      if (errorBody?.error?.message) {
        errorMessage = errorBody.error.message
      }
    } catch {
      // Could not parse error body
    }
    throw new Error(errorMessage)
  }

  const arrayBuffer = await res.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

export async function remixVideo(
  videoId: string,
  prompt: string
): Promise<{ id: string; status: string; progress: number }> {
  // Changed: Correct remix endpoint per docs:
  // POST /v1/videos/<previous_video_id>/remix with JSON body { "prompt": "..." }
  console.log('[Sora] Remixing video via REST API', {
    originalVideoId: videoId,
    prompt: prompt.slice(0, 60),
  })

  const video = await openaiJsonRequest<SoraVideoResponse>(
    `/videos/${encodeURIComponent(videoId)}/remix`,
    {
      method: 'POST',
      body: {
        prompt,
      },
    }
  )

  return {
    id: video.id,
    status: video.status ?? 'queued',
    progress: video.progress ?? 0,
  }
}