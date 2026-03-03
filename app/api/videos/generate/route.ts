import { NextRequest, NextResponse } from 'next/server'
import { startVideoGeneration } from '@/lib/openai'
import { createVideoRecord, updateVideoRecord } from '@/lib/cosmic'
import type { GenerateVideoRequest } from '@/types'

const VALID_SECONDS = ['4', '8', '12']
const VALID_MODELS = ['sora-2', 'sora-2-pro']
const VALID_SIZES = ['1280x720', '1920x1080', '480x480']

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as GenerateVideoRequest
    const { prompt, model, size, seconds } = body

    console.log('[Generate API] Received request:', {
      prompt: prompt ? prompt.slice(0, 60) + '...' : '(empty)',
      model,
      size,
      seconds,
    })

    if (!prompt?.trim()) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
    }
    if (prompt.trim().length > 2000) {
      return NextResponse.json(
        { error: 'Prompt must be under 2000 characters' },
        { status: 400 }
      )
    }

    if (!process.env.OPENAI_API_KEY) {
      console.error('[Generate API] OPENAI_API_KEY is missing from environment variables')
      return NextResponse.json(
        { error: 'OPENAI_API_KEY is not configured. Please add it to your environment variables at https://platform.openai.com/api-keys' },
        { status: 500 }
      )
    }

    const resolvedModel = model ?? 'sora-2'
    const resolvedSize = size ?? '1280x720'
    const resolvedSeconds = seconds ?? '4'

    if (!VALID_SECONDS.includes(resolvedSeconds)) {
      const msg = `Invalid seconds value "${resolvedSeconds}". Must be one of: ${VALID_SECONDS.join(', ')}`
      console.error(`[Generate API] ${msg}`)
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    if (!VALID_MODELS.includes(resolvedModel)) {
      const msg = `Invalid model "${resolvedModel}". Must be one of: ${VALID_MODELS.join(', ')}`
      console.error(`[Generate API] ${msg}`)
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    if (!VALID_SIZES.includes(resolvedSize)) {
      const msg = `Invalid size "${resolvedSize}". Must be one of: ${VALID_SIZES.join(', ')}`
      console.error(`[Generate API] ${msg}`)
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    console.log('[Generate API] Starting video generation:', {
      prompt: prompt.trim().slice(0, 60),
      model: resolvedModel,
      size: resolvedSize,
      seconds: resolvedSeconds,
    })

    const openaiVideo = await startVideoGeneration(
      prompt.trim(),
      resolvedModel,
      resolvedSize,
      resolvedSeconds
    )

    console.log('[Generate API] OpenAI video created, saving to Cosmic:', {
      openaiVideoId: openaiVideo.id,
      status: openaiVideo.status,
      hasVideoUrl: !!openaiVideo.videoUrl,
    })

    const cosmicVideo = await createVideoRecord(
      prompt.trim(),
      openaiVideo.id,
      resolvedModel,
      resolvedSize,
      resolvedSeconds
    )

    console.log('[Generate API] Cosmic record created:', { cosmicId: cosmicVideo.id })

    // Changed: If the video completed synchronously (got URL back immediately),
    // update the Cosmic record with the video URL and completed status
    if (openaiVideo.videoUrl) {
      console.log('[Generate API] Video completed synchronously, updating Cosmic with URL')
      await updateVideoRecord(cosmicVideo.id, {
        status: 'completed',
        progress: 100,
        video_url: openaiVideo.videoUrl,
      })
    }

    return NextResponse.json({
      data: {
        cosmicId: cosmicVideo.id,
        openaiVideoId: openaiVideo.id,
        status: openaiVideo.status,
        progress: openaiVideo.progress,
        // Changed: Include videoUrl in response if immediately available
        videoUrl: openaiVideo.videoUrl,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to start generation'
    const stack = error instanceof Error ? error.stack : undefined
    console.error('[Generate API] Error:', message)
    if (stack) {
      console.error('[Generate API] Stack:', stack)
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}