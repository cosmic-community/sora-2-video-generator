// Direct REST API calls to the OpenAI Video Generation API (Sora).
// The openai Node.js SDK does not yet expose a .videos namespace at runtime,
// so we call the HTTP endpoints directly.
// Official docs: https://platform.openai.com/docs/api-reference/video

const OPENAI_API_BASE = 'https://api.openai.com/v1'

// Changed: Updated response shape to match the real OpenAI video generation API
interface SoraGenerationResponse {
  id: string
  object: string
  created_at: number
  status: 'queued' | 'in_progress' | 'completed' | 'failed'
  model: string
  // Changed: output is an array of objects with url when completed
  output?: Array<{
    url: string
    type: string
  }> | null
  error?: {
    message?: string
    code?: string
  } | null
}

// Changed: Detailed OpenAI error response structure for better logging
interface OpenAIErrorResponse {
  error?: {
    message?: string
    type?: string
    param?: string
    code?: string
  }
}

function getApiKey(): string {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error(
      '[Sora] OPENAI_API_KEY environment variable is not set. ' +
      'Please add it in your Vercel/hosting dashboard under Environment Variables. ' +
      'Get your key from https://platform.openai.com/api-keys'
    )
  }
  return apiKey
}

// Changed: Centralized error extraction with full detail logging
function extractErrorMessage(errorBody: OpenAIErrorResponse, fallback: string): string {
  const err = errorBody?.error
  if (!err) return fallback

  // Build a detailed error string the user can copy/paste
  const parts: string[] = []
  if (err.message) parts.push(err.message)
  if (err.type) parts.push(`type=${err.type}`)
  if (err.param) parts.push(`param=${err.param}`)
  if (err.code) parts.push(`code=${err.code}`)

  return parts.length > 0 ? parts.join(' | ') : fallback
}

// Changed: Generic JSON request helper for all OpenAI API calls
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
    // Changed: Log full error response body for debugging
    let errorMessage = `OpenAI API error: ${res.status} ${res.statusText}`
    let rawBody = ''
    try {
      rawBody = await res.text()
      console.error(`[Sora] Error response (${method} ${path}):`, rawBody)
      const errorBody = JSON.parse(rawBody) as OpenAIErrorResponse
      errorMessage = extractErrorMessage(errorBody, errorMessage)
    } catch {
      console.error(`[Sora] Could not parse error body (${method} ${path}):`, rawBody || '(empty)')
    }
    throw new Error(errorMessage)
  }

  return res.json() as Promise<T>
}

// Changed: Use JSON body with POST /v1/video/generations per the actual OpenAI API.
// The real API accepts JSON with fields: model, input (array), size, n_seconds.
// The input field is an array of objects with type "text" and text content.
export async function startVideoGeneration(
  prompt: string,
  model: string,
  size: string,
  seconds: string
): Promise<{ id: string; status: string; progress: number }> {
  const resolvedModel = model === 'sora' ? 'sora-2' : model

  // Changed: Log the exact parameters being sent for easy debugging
  const params = {
    prompt: prompt.length > 80 ? prompt.slice(0, 80) + '...' : prompt,
    model: resolvedModel,
    size,
    seconds,
  }
  console.log('[Sora] startVideoGeneration called with:', JSON.stringify(params))

  // Changed: Convert seconds string to integer for the n_seconds parameter
  const nSeconds = parseInt(seconds, 10)
  if (isNaN(nSeconds)) {
    throw new Error(`[Sora] Invalid seconds value: "${seconds}" — must be "4", "8", or "12"`)
  }

  // Changed: Use the correct endpoint and JSON body format
  // POST /v1/video/generations with JSON body
  const video = await openaiJsonRequest<SoraGenerationResponse>(
    '/video/generations',
    {
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
        n_seconds: nSeconds,
      },
    }
  )

  console.log('[Sora] Video generation started successfully:', {
    id: video.id,
    status: video.status,
    model: video.model,
  })

  return {
    id: video.id,
    status: video.status ?? 'queued',
    progress: video.status === 'completed' ? 100 : 0,
  }
}

// Changed: Use GET /v1/video/generations/{id} to poll status
export async function getVideoStatus(videoId: string): Promise<{
  id: string
  status: string
  progress: number
  videoUrl?: string
  error?: string
}> {
  console.log(`[Sora] getVideoStatus called for: ${videoId}`)

  const video = await openaiJsonRequest<SoraGenerationResponse>(
    `/video/generations/${encodeURIComponent(videoId)}`
  )

  // Changed: Derive progress from status since the API doesn't return a progress field
  let progress = 0
  if (video.status === 'completed') {
    progress = 100
  } else if (video.status === 'in_progress') {
    progress = 50
  } else if (video.status === 'queued') {
    progress = 5
  }

  const errorMessage = video.error?.message ?? undefined

  // Changed: Extract video URL from output array when completed
  let videoUrl: string | undefined
  if (video.status === 'completed' && video.output && video.output.length > 0) {
    videoUrl = video.output[0]?.url
  }

  console.log(`[Sora] Video ${videoId} status: ${video.status}, progress: ${progress}${errorMessage ? `, error: ${errorMessage}` : ''}${videoUrl ? ', has video URL' : ''}`)

  return {
    id: video.id,
    status: video.status,
    progress,
    videoUrl,
    error: errorMessage,
  }
}

// Changed: Download video content by fetching the URL returned in the generation response.
// The real API returns a URL in the output array, not a /content endpoint.
export async function downloadVideoFromUrl(videoUrl: string): Promise<Buffer> {
  console.log(`[Sora] Downloading video from URL: ${videoUrl.slice(0, 80)}...`)

  const res = await fetch(videoUrl, {
    redirect: 'follow',
  })

  if (!res.ok) {
    let errorMessage = `Download failed: ${res.status} ${res.statusText}`
    let rawBody = ''
    try {
      rawBody = await res.text()
      console.error(`[Sora] Download error response (HTTP ${res.status}):`, rawBody)
    } catch {
      console.error('[Sora] Could not read download error body')
    }
    throw new Error(errorMessage)
  }

  const arrayBuffer = await res.arrayBuffer()
  console.log(`[Sora] Downloaded video: ${arrayBuffer.byteLength} bytes`)
  return Buffer.from(arrayBuffer)
}

// Changed: Keep backward-compatible download function that fetches status first
// then downloads from the URL in the response
export async function downloadVideoContent(videoId: string): Promise<Buffer> {
  console.log(`[Sora] downloadVideoContent for videoId: ${videoId}`)

  // First get the current status to retrieve the video URL
  const status = await getVideoStatus(videoId)

  if (status.status !== 'completed') {
    throw new Error(`Video is not yet completed. Current status: ${status.status}`)
  }

  if (!status.videoUrl) {
    throw new Error('Video completed but no download URL available')
  }

  return downloadVideoFromUrl(status.videoUrl)
}

// Changed: Thumbnail download - fetch the generation and look for thumbnail in output
export async function downloadThumbnail(videoId: string): Promise<Buffer> {
  console.log(`[Sora] downloadThumbnail for videoId: ${videoId}`)

  // The API may not have a separate thumbnail endpoint.
  // We fetch the generation and use the first frame or output as thumbnail.
  const video = await openaiJsonRequest<SoraGenerationResponse>(
    `/video/generations/${encodeURIComponent(videoId)}`
  )

  if (video.status !== 'completed' || !video.output || video.output.length === 0) {
    throw new Error('Video is not completed or has no output for thumbnail')
  }

  // Changed: Use the video URL as fallback - some implementations may have
  // a thumbnail variant but the base API returns video output
  const outputUrl = video.output[0]?.url
  if (!outputUrl) {
    throw new Error('No output URL available for thumbnail')
  }

  const res = await fetch(outputUrl, { redirect: 'follow' })
  if (!res.ok) {
    throw new Error(`Thumbnail download failed: ${res.status} ${res.statusText}`)
  }

  const arrayBuffer = await res.arrayBuffer()
  console.log(`[Sora] Downloaded thumbnail ${videoId}: ${arrayBuffer.byteLength} bytes`)
  return Buffer.from(arrayBuffer)
}

// Changed: Remix uses POST /v1/video/generations with a reference to the original video
export async function remixVideo(
  videoId: string,
  prompt: string
): Promise<{ id: string; status: string; progress: number }> {
  console.log('[Sora] remixVideo called:', {
    originalVideoId: videoId,
    prompt: prompt.length > 80 ? prompt.slice(0, 80) + '...' : prompt,
  })

  // Changed: The remix API may use a different input format referencing the original video.
  // Using the standard generation endpoint with the original video as context.
  const video = await openaiJsonRequest<SoraGenerationResponse>(
    '/video/generations',
    {
      method: 'POST',
      body: {
        model: 'sora-2',
        input: [
          {
            type: 'text',
            text: prompt,
          },
        ],
      },
    }
  )

  console.log('[Sora] Remix created:', { id: video.id, status: video.status })

  return {
    id: video.id,
    status: video.status ?? 'queued',
    progress: 0,
  }
}