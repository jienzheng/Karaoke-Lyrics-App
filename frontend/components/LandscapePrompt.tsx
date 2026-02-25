'use client'

import { useEffect, useState } from 'react'

export default function LandscapePrompt() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (sessionStorage.getItem('landscape_dismissed')) return

    const mql = window.matchMedia('(orientation: portrait) and (max-width: 768px)')
    setShow(mql.matches)

    const handler = (e: MediaQueryListEvent) => {
      if (!sessionStorage.getItem('landscape_dismissed')) setShow(e.matches)
    }
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  if (!show) return null

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-purple-900/95 backdrop-blur-sm border-b border-purple-500/30">
      {/* Rotate phone icon */}
      <svg
        className="w-5 h-5 flex-shrink-0 text-purple-300"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M4 7a2 2 0 012-2h6a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2V7z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M17 8l3 3-3 3M14 11h6"
        />
      </svg>
      <p className="flex-1 text-xs text-purple-100">
        Rotate to <strong>landscape</strong> for the best lyrics experience.
      </p>
      <button
        onClick={() => {
          sessionStorage.setItem('landscape_dismissed', '1')
          setShow(false)
        }}
        className="flex-shrink-0 p-1 text-purple-300 hover:text-white transition-colors"
        aria-label="Dismiss"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}
