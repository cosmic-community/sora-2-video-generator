# Sora 2 Video Generator

![App Preview](https://cdn.openai.com/API/docs/video-gallery/posters/Space-Race.jpg?w=1200&h=300&fit=crop&auto=format,compress)

Generate stunning AI videos using OpenAI's Sora 2 model. Type a prompt, choose your settings, watch it render in real-time, then download or share your creation.

## Features

- 🎬 Generate videos with `sora-2` or `sora-2-pro`
- 📊 Real-time progress tracking with polling
- ⬇️ One-click MP4 download
- 🔗 Share via Web Share API or clipboard
- 🖼️ Thumbnail previews for all videos
- 🔄 Remix completed videos with new prompts
- 📚 Persistent video library stored in Cosmic
- ⚙️ Configurable resolution and duration

## Clone this Project

Want to create your own version of this project with all the content and structure? Clone this Cosmic bucket and code repository to get started instantly:

[![Clone this Project](https://img.shields.io/badge/Clone%20this%20Project-29abe2?style=for-the-badge&logo=cosmic&logoColor=white)](https://app.cosmicjs.com/projects/new?clone_bucket=69a6c13b2f592b85452c7ca4&clone_repository=69a6c2d12f592b85452c7cc9)

## Prompts

This application was built using the following prompts to generate the content structure and code:

### Content Model Prompt

> No content model prompt provided - app built from existing content structure

### Code Generation Prompt

> I want to build a simple application that allows me to insert a prompt and then generate a video created by Sora 2. I then want to be able to download or share that video. Can this be done using the API docs from OpenAI? Let's build it!

The app has been tailored to work with your existing Cosmic content structure and includes all the features requested above.

## Technologies

- **[Next.js 16](https://nextjs.org/)** — App Router, Server Components, API Routes
- **[OpenAI SDK](https://www.npmjs.com/package/openai)** — Videos API (Sora 2)
- **[Cosmic](https://www.cosmicjs.com/docs)** — Persistent video library storage
- **[Tailwind CSS](https://tailwindcss.com/)** — Styling
- **TypeScript** — Type safety throughout

## Getting Started

### Prerequisites

- Node.js 18+ or Bun
- OpenAI API key with Videos API access
- Cosmic bucket

### Installation

```bash
git clone <your-repo>
cd sora-video-generator
bun install
```

Set environment variables, then:

```bash
bun dev
```

Open [http://localhost:3000](http://localhost:3000)

## Cosmic SDK Examples

```typescript
// Save a video job to Cosmic
const { object } = await cosmic.objects.insertOne({
  type: 'sora-videos',
  title: prompt.slice(0, 60),
  metadata: {
    openai_video_id: video.id,
    prompt,
    status: 'queued',
    model,
  },
})

// Update status when complete
await cosmic.objects.updateOne(cosmicId, {
  metadata: { status: 'completed', thumbnail_url: thumbnailUrl },
})
```

## Cosmic CMS Integration

Video generation jobs are persisted to Cosmic with:
- `openai_video_id` — for polling and downloading
- `prompt` — original prompt text
- `status` — queued / in_progress / completed / failed
- `model` — sora-2 or sora-2-pro
- `thumbnail_url` — stored thumbnail for gallery
- `video_url` — temporary download URL (1 hour validity noted)

## Deployment

### Vercel (Recommended)

```bash
bun add -g vercel
vercel --prod
```

Set `OPENAI_API_KEY`, `COSMIC_BUCKET_SLUG`, `COSMIC_READ_KEY`, `COSMIC_WRITE_KEY` in Vercel dashboard.

### Netlify

```bash
bun add -g netlify-cli
netlify deploy --prod
```

<!-- README_END -->