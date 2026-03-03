import { NextRequest, NextResponse } from 'next/server'
import { remixVideo } from '@/lib/openai'
import { createVideoRecord } from '@/lib/cosmic'
import type { RemixVideoRequest } from '@/types'

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as RemixVideoRequest
    const { prompt, openai_video_id } = body

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
      '8' // Changed: '5' is invalid — valid values are '4', '8', '12'
    )

    return NextResponse.json({
      data: {
        cosmicId: cosmicVideo.id,
        openaiVideoId: remixedVideo.id,
        status: remixedVideo.status,
        progress: remixedVideo.progress,
      },
    })
  } catch (error) {
    console.error('Remix error:', error)
    const message =
      error instanceof Error ? error.message : 'Failed to remix video'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}