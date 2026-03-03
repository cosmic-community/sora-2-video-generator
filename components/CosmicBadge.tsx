'use client'

import { useState, useEffect } from 'react'

interface CosmicBadgeProps {
  bucketSlug: string
}

export default function CosmicBadge({ bucketSlug }: CosmicBadgeProps) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const isDismissed = localStorage.getItem('cosmic-badge-dismissed')
    if (!isDismissed) {
      const timer = setTimeout(() => setIsVisible(true), 1500)
      return () => clearTimeout(timer)
    }
  }, [])

  const handleDismiss = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsVisible(false)
    localStorage.setItem('cosmic-badge-dismissed', 'true')
  }

  if (!isVisible) return null

  return (
    <a
      href={`https://www.cosmicjs.com?utm_source=bucket_${bucketSlug}&utm_medium=referral&utm_campaign=app_badge&utm_content=built_with_cosmic`}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        backgroundColor: '#11171A',
        color: 'white',
        textDecoration: 'none',
        fontSize: '14px',
        fontWeight: 500,
        borderRadius: '8px',
        padding: '12px 16px',
        width: '180px',
        zIndex: 50,
        boxShadow: '0 4px 12px rgba(0,0,0,0.35)',
        transition: 'background-color 0.2s ease',
      }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.backgroundColor = '#1a2326')
      }
      onMouseLeave={(e) =>
        (e.currentTarget.style.backgroundColor = '#11171A')
      }
    >
      <button
        onClick={handleDismiss}
        aria-label="Dismiss badge"
        style={{
          position: 'absolute',
          top: '-8px',
          right: '-8px',
          width: '24px',
          height: '24px',
          background: '#6b7280',
          border: 'none',
          borderRadius: '50%',
          color: 'white',
          fontSize: '16px',
          fontWeight: 'bold',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        ×
      </button>
      <img
        src="https://cdn.cosmicjs.com/b67de7d0-c810-11ed-b01d-23d7b265c299-logo508x500.svg"
        alt="Cosmic Logo"
        style={{ width: '20px', height: '20px' }}
      />
      Built with Cosmic
    </a>
  )
}