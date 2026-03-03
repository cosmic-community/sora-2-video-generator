import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Sora 2 Video Generator',
  description: 'Generate AI videos using OpenAI Sora 2',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
        {/* Console capture script for dashboard debugging */}
        <script src="/dashboard-console-capture.js" />
      </head>
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  )
}