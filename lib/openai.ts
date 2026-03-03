// Direct REST API calls to the OpenAI Sora Videos API.
// The openai Node.js SDK does not yet expose a .videos namespace at runtime,
// so we call the HTTP endpoints directly.
// Docs: https://platform.openai.com/docs/api-reference/videos

const OPENAI_API_BASE = 'https://api.openai.com/v1'

// Changed: Response shape from the Sora Videos API
interface SoraVideoResponse {
  id: string
  status: string
  progress?: number
  error?: { message?: string } | null
}

function getApiKey(): string {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is not set')
  }
  return apiKey
}

// Changed: Generic helper for authenticated OpenAI API requests
async function openaiRequest<T>(
  path: string,
  options: {
    method?: string
    body?: Record<string, unknown>
    rawResponse?: boolean
  } = {}
): Promise<T> {
  const apiKey = getApiKey()
  const { method = 'GET', body } = options

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  }

  const fetchOptions: RequestInit = {
    method,
    headers,
  }

  if (body) {
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

  console.log('[Sora] Creating video via REST API', {
    prompt: prompt.slice(0, 60),
    model: resolvedModel,
    size,
    seconds,
  })

  // Changed: Direct POST to the Sora generations endpoint
  const video = await openaiRequest<SoraVideoResponse>('/videos/generations', {
    method: 'POST',
    body: {
      model: resolvedModel,
      input: [
        {
          type: 'text',
          text: prompt,
        },
      ],
      size,
      duration: parseInt(seconds, 10),
    },
  })

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
  // Changed: Direct GET to retrieve video generation status
  const video = await openaiRequest<SoraVideoResponse>(
    `/videos/generations/${encodeURIComponent(videoId)}`
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

  // Changed: Direct GET to download the generated video content
  const url = `${OPENAI_API_BASE}/videos/generations/${encodeURIComponent(videoId)}/content`
  console.log(`[Sora] GET ${url}`)

  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
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

  // Changed: Direct GET with variant=thumbnail query parameter
  const url = `${OPENAI_API_BASE}/videos/generations/${encodeURIComponent(videoId)}/content?variant=thumbnail`
  console.log(`[Sora] GET ${url} (thumbnail)`)

  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
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
  // Changed: Remix is a new generation that references the original video
  // Using the standard generations endpoint with the original video as input
  console.log('[Sora] Remixing video via REST API', {
    originalVideoId: videoId,
    prompt: prompt.slice(0, 60),
  })

  const video = await openaiRequest<SoraVideoResponse>('/videos/generations', {
    method: 'POST',
    body: {
      model: 'sora-2',
      input: [
        {
          type: 'text',
          text: prompt,
        },
        {
          type: 'generation',
          id: videoId,
        },
      ],
      size: '1280x720',
      duration: 8,
    },
  })

  return {
    id: video.id,
    status: video.status ?? 'queued',
    progress: video.progress ?? 0,
  }
}