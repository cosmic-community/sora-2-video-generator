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
    const status = await getVideoStatus(openaiVideoId)

    // Update Cosmic record with latest status
    const updates: Record<string, string | number> = {
      status: status.status,
      progress: status.progress,
    }
    if (status.error) {
      updates.error_message = status.error
    }
    // Changed: Store the video URL in Cosmic when available so download can use it
    if (status.videoUrl) {
      updates.video_url = status.videoUrl
    }
    await updateVideoRecord(cosmicId, updates)

    // Changed: Return videoUrl in the response so the client can use it for preview
    return NextResponse.json({
      data: {
        id: status.id,
        status: status.status,
        progress: status.progress,
        error: status.error,
        videoUrl: status.videoUrl,
      },
    })
  } catch (error) {
    // Changed: Log full error for debugging
    const message = error instanceof Error ? error.message : 'Failed to get status'
    const stack = error instanceof Error ? error.stack : undefined
    console.error('[Status API] Error:', message)
    if (stack) {
      console.error('[Status API] Stack:', stack)
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}