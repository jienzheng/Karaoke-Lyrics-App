'use client'

import { useEffect, useRef, useState } from 'react'
import { Lyrics, LyricsLine } from '@/types'

interface LyricsDisplayProps {
  lyrics: Lyrics | null
  currentTimeMs: number
  displayMode: 'original' | 'romanized' | 'both'
}

export default function LyricsDisplay({
  lyrics,
  currentTimeMs,
  displayMode,
}: LyricsDisplayProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [currentLineIndex, setCurrentLineIndex] = useState<number>(-1)

  // Find the current line based on playback time
  useEffect(() => {
    if (!lyrics || !lyrics.lines.length) {
      setCurrentLineIndex(-1)
      return
    }

    // Find the line that should be highlighted
    let lineIndex = -1
    for (let i = 0; i < lyrics.lines.length; i++) {
      if (currentTimeMs >= lyrics.lines[i].time_ms) {
        lineIndex = i
      } else {
        break
      }
    }

    setCurrentLineIndex(lineIndex)
  }, [currentTimeMs, lyrics])

  // Auto-scroll to current line
  useEffect(() => {
    if (currentLineIndex >= 0 && containerRef.current) {
      const currentLineElement = containerRef.current.querySelector(
        `[data-line-index="${currentLineIndex}"]`
      )
      if (currentLineElement) {
        currentLineElement.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        })
      }
    }
  }, [currentLineIndex])

  if (!lyrics || !lyrics.lines.length) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <div className="text-center space-y-4">
          <svg
            className="w-16 h-16 mx-auto text-gray-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <p className="text-2xl font-medium">No lyrics available</p>
          <p className="text-lg text-gray-600">
            Enjoy the music and sing along!
          </p>
        </div>
      </div>
    )
  }

  const renderLine = (line: LyricsLine, index: number) => {
    const isCurrentLine = index === currentLineIndex
    const isPastLine = index < currentLineIndex
    const isUpcomingLine = index > currentLineIndex

    return (
      <div
        key={index}
        data-line-index={index}
        className={`
          transition-all duration-300 py-3 px-6 rounded-lg
          ${isCurrentLine ? 'scale-110 bg-gradient-to-r from-purple-600/30 to-pink-600/30' : ''}
          ${isPastLine ? 'opacity-40' : ''}
          ${isUpcomingLine ? 'opacity-60' : ''}
        `}
      >
        {displayMode === 'both' ? (
          <div className="space-y-2">
            <p
              className={`
                text-3xl md:text-4xl lg:text-5xl font-bold leading-tight
                ${isCurrentLine ? 'text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400' : 'text-white'}
              `}
            >
              {line.text}
            </p>
            {line.romanized_text && (
              <p
                className={`
                  text-xl md:text-2xl lg:text-3xl leading-tight
                  ${isCurrentLine ? 'text-purple-300' : 'text-gray-400'}
                `}
              >
                {line.romanized_text}
              </p>
            )}
          </div>
        ) : displayMode === 'romanized' && line.romanized_text ? (
          <p
            className={`
              text-3xl md:text-4xl lg:text-5xl font-bold leading-tight
              ${isCurrentLine ? 'text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400' : 'text-white'}
            `}
          >
            {line.romanized_text}
          </p>
        ) : (
          <p
            className={`
              text-3xl md:text-4xl lg:text-5xl font-bold leading-tight
              ${isCurrentLine ? 'text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400' : 'text-white'}
            `}
          >
            {line.text}
          </p>
        )}
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="h-full overflow-y-auto scrollbar-hide px-4"
      style={{
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
      }}
    >
      <div className="max-w-4xl mx-auto py-12 space-y-4">
        {lyrics.lines.map((line, index) => renderLine(line, index))}
      </div>
    </div>
  )
}
