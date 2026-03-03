import { NextRequest, NextResponse } from 'next/server'
import { startVideoGeneration } from '@/lib/openai'
import { createVideoRecord } from '@/lib/cosmic'
import type { GenerateVideoRequest } from '@/types'

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as GenerateVideoRequest
    const { prompt, model, size, seconds } = body

    if (!prompt?.trim()) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
    }
    if (prompt.trim().length > 2000) {
      return NextResponse.json(
        { error: 'Prompt must be under 2000 characters' },
        { status: 400 }
      )
    }

    // Start the OpenAI video generation job
    const openaiVideo = await startVideoGeneration(
      prompt.trim(),
      model ?? 'sora-2',
      size ?? '1280x720',
      seconds ?? '5'
    )

    // Persist to Cosmic
    const cosmicVideo = await createVideoRecord(
      prompt.trim(),
      openaiVideo.id,
      model ?? 'sora-2',
      size ?? '1280x720',
      seconds ?? '5'
    )

    return NextResponse.json({
      data: {
        cosmicId: cosmicVideo.id,
        openaiVideoId: openaiVideo.id,
        status: openaiVideo.status,
        progress: openaiVideo.progress,
      },
    })
  } catch (error) {
    console.error('Generate error:', error)
    const message =
      error instanceof Error ? error.message : 'Failed to start generation'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}