// Direct REST API calls to the OpenAI Sora Videos API.
// The openai Node.js SDK does not yet expose a .videos namespace at runtime,
// so we call the HTTP endpoints directly.
// Official docs: https://developers.openai.com/api/docs/guides/video-generation

const OPENAI_API_BASE = 'https://api.openai.com/v1'

// Response shape from the Sora Videos API
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

// Helper for JSON-based OpenAI API requests (used for GET, remix, etc.)
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

// Changed: Use multipart/form-data for POST /v1/videos per official docs.
// The curl example in the docs shows:
//   curl -X POST "https://api.openai.com/v1/videos" \
//     -H "Content-Type: multipart/form-data" \
//     -F prompt="..." -F model="sora-2-pro" -F size="1280x720" -F seconds="8"
//
// All form fields are strings. seconds must be "4", "8", or "12" (NOT an integer).
// Do NOT manually set Content-Type — fetch auto-generates it with the correct
// multipart boundary when given a FormData body.
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

  const apiKey = getApiKey()
  const url = `${OPENAI_API_BASE}/videos`

  // Changed: Build multipart/form-data body matching the official docs curl example
  const formData = new FormData()
  formData.append('prompt', prompt)
  formData.append('model', resolvedModel)
  formData.append('size', size)
  formData.append('seconds', seconds) // String: "4", "8", or "12"

  console.log(`[Sora] POST ${url} (multipart/form-data)`)

  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        // IMPORTANT: Do NOT set Content-Type here.
        // fetch() automatically sets it to multipart/form-data with the
        // correct boundary when the body is a FormData instance.
      },
      body: formData,
    })
  } catch (networkError) {
    // Changed: Catch network-level errors (DNS, timeout, etc.)
    const networkMsg = networkError instanceof Error ? networkError.message : String(networkError)
    console.error('[Sora] Network error calling POST /v1/videos:', networkMsg)
    throw new Error(`[Sora] Network error: ${networkMsg}`)
  }

  if (!res.ok) {
    // Changed: Read the full error body and log it for copy/paste debugging
    let errorMessage = `OpenAI API error: ${res.status} ${res.statusText}`
    let rawBody = ''
    try {
      rawBody = await res.text()
      console.error(`[Sora] POST /v1/videos error response (HTTP ${res.status}):`, rawBody)
      const errorBody = JSON.parse(rawBody) as OpenAIErrorResponse
      errorMessage = extractErrorMessage(errorBody, errorMessage)
    } catch {
      console.error('[Sora] Could not parse error body:', rawBody || '(empty)')
    }
    throw new Error(errorMessage)
  }

  const video = (await res.json()) as SoraVideoResponse

  console.log('[Sora] Video created successfully:', {
    id: video.id,
    status: video.status,
    progress: video.progress,
    model: video.model,
    seconds: video.seconds,
    size: video.size,
  })

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
  console.log(`[Sora] getVideoStatus called for: ${videoId}`)

  const video = await openaiJsonRequest<SoraVideoResponse>(
    `/videos/${encodeURIComponent(videoId)}`
  )

  let progress = video.progress ?? 0
  if (video.status === 'completed') {
    progress = 100
  } else if (video.status === 'in_progress' && progress === 0) {
    progress = 50
  }

  const errorMessage = video.error?.message ?? undefined

  console.log(`[Sora] Video ${videoId} status: ${video.status}, progress: ${progress}${errorMessage ? `, error: ${errorMessage}` : ''}`)

  return {
    id: video.id,
    status: video.status,
    progress,
    error: errorMessage,
  }
}

export async function downloadVideoContent(videoId: string): Promise<Buffer> {
  const apiKey = getApiKey()

  const url = `${OPENAI_API_BASE}/videos/${encodeURIComponent(videoId)}/content`
  console.log(`[Sora] GET ${url}`)

  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
    redirect: 'follow',
  })

  if (!res.ok) {
    let errorMessage = `Download failed: ${res.status} ${res.statusText}`
    let rawBody = ''
    try {
      rawBody = await res.text()
      console.error(`[Sora] Download error response (HTTP ${res.status}):`, rawBody)
      const errorBody = JSON.parse(rawBody) as OpenAIErrorResponse
      errorMessage = extractErrorMessage(errorBody, errorMessage)
    } catch {
      console.error('[Sora] Could not parse download error body:', rawBody || '(empty)')
    }
    throw new Error(errorMessage)
  }

  const arrayBuffer = await res.arrayBuffer()
  console.log(`[Sora] Downloaded video ${videoId}: ${arrayBuffer.byteLength} bytes`)
  return Buffer.from(arrayBuffer)
}

export async function downloadThumbnail(videoId: string): Promise<Buffer> {
  const apiKey = getApiKey()

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
    let rawBody = ''
    try {
      rawBody = await res.text()
      console.error(`[Sora] Thumbnail error response (HTTP ${res.status}):`, rawBody)
      const errorBody = JSON.parse(rawBody) as OpenAIErrorResponse
      errorMessage = extractErrorMessage(errorBody, errorMessage)
    } catch {
      console.error('[Sora] Could not parse thumbnail error body:', rawBody || '(empty)')
    }
    throw new Error(errorMessage)
  }

  const arrayBuffer = await res.arrayBuffer()
  console.log(`[Sora] Downloaded thumbnail ${videoId}: ${arrayBuffer.byteLength} bytes`)
  return Buffer.from(arrayBuffer)
}

// Remix uses application/json per official docs:
//   curl -X POST ".../videos/<id>/remix" \
//     -H "Content-Type: application/json" \
//     -d '{"prompt": "..."}'
export async function remixVideo(
  videoId: string,
  prompt: string
): Promise<{ id: string; status: string; progress: number }> {
  console.log('[Sora] remixVideo called:', {
    originalVideoId: videoId,
    prompt: prompt.length > 80 ? prompt.slice(0, 80) + '...' : prompt,
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

  console.log('[Sora] Remix created:', { id: video.id, status: video.status })

  return {
    id: video.id,
    status: video.status ?? 'queued',
    progress: video.progress ?? 0,
  }
}