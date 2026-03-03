import { NextRequest, NextResponse } from 'next/server'
import { remixVideo } from '@/lib/openai'
import { createVideoRecord } from '@/lib/cosmic'
import type { RemixVideoRequest } from '@/types'

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as RemixVideoRequest
    const { prompt, openai_video_id } = body

    // Changed: Log incoming remix request
    console.log('[Remix API] Received request:', {
      prompt: prompt ? prompt.slice(0, 60) + '...' : '(empty)',
      openai_video_id,
    })

    if (!prompt?.trim()) {
      return NextResponse.json({ error: 'Remix prompt is required' }, { status: 400 })
    }
    if (!openai_video_id) {
      return NextResponse.json({ error: 'openai_video_id is required' }, { status: 400 })
    }

    const remixedVideo = await remixVideo(openai_video_id, prompt.trim())

    const cosmicVideo = await createVideoRecord(
      `Remix: ${prompt.trim()}`,
      remixedVideo.id,
      'sora-2',
      '1280x720',
      '8' // Valid values are '4', '8', '12'
    )

    console.log('[Remix API] Created remix:', {
      cosmicId: cosmicVideo.id,
      openaiVideoId: remixedVideo.id,
    })

    return NextResponse.json({
      data: {
        cosmicId: cosmicVideo.id,
        openaiVideoId: remixedVideo.id,
        status: remixedVideo.status,
        progress: remixedVideo.progress,
      },
    })
  } catch (error) {
    // Changed: Log full error for debugging
    const message = error instanceof Error ? error.message : 'Failed to remix video'
    const stack = error instanceof Error ? error.stack : undefined
    console.error('[Remix API] Error:', message)
    if (stack) {
      console.error('[Remix API] Stack:', stack)
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}