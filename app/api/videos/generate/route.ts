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

    const resolvedModel = model ?? 'sora-2'
    const resolvedSize = size ?? '1280x720'
    // Changed: Default to '4' — the shortest valid Sora API duration
    const resolvedSeconds = seconds ?? '4'

    const openaiVideo = await startVideoGeneration(
      prompt.trim(),
      resolvedModel,
      resolvedSize,
      resolvedSeconds
    )

    const cosmicVideo = await createVideoRecord(
      prompt.trim(),
      openaiVideo.id,
      resolvedModel,
      resolvedSize,
      resolvedSeconds
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