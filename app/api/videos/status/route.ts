import { NextRequest, NextResponse } from 'next/server'
import { getVideoStatus } from '@/lib/openai'
import { updateVideoRecord } from '@/lib/cosmic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const openaiVideoId = searchParams.get('openaiVideoId')
  const cosmicId = searchParams.get('cosmicId')

  if (!openaiVideoId || !cosmicId) {
    return NextResponse.json(
      { error: 'openaiVideoId and cosmicId are required' },
      { status: 400 }
    )
  }

  try {
    // Changed: Uses openai.videos.retrieve() which hits GET /v1/videos/{id}
    const status = await getVideoStatus(openaiVideoId)

    // Changed: Persist status + progress to Cosmic
    const updates: Record<string, string | number> = {
      status: status.status,
      progress: status.progress,
    }
    if (status.error) {
      updates.error_message = status.error
    }

    await updateVideoRecord(cosmicId, updates)

    return NextResponse.json({
      data: {
        id: status.id,
        status: status.status,
        progress: status.progress,
        error: status.error,
      },
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to get status'
    const stack = error instanceof Error ? error.stack : undefined
    console.error('[Status API] Error:', message)
    if (stack) {
      console.error('[Status API] Stack:', stack)
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}