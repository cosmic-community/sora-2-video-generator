import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    bucketSlug: process.env.COSMIC_BUCKET_SLUG,
  })
}