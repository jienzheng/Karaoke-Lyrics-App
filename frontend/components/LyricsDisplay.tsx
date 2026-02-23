'use client'

import { useEffect, useRef, useState } from 'react'
import { Lyrics, LyricsLine, Song } from '@/types'
import Image from 'next/image'

type PlayerStatus = 'empty_queue' | 'ready_to_play' | 'playing' | 'no_lyrics' | 'countdown'

interface LyricsDisplayProps {
  lyrics: Lyrics | null
  currentTimeMs: number
  displayMode: 'original' | 'romanized' | 'both'
  status?: PlayerStatus
  countdownSeconds?: number
  countdownSong?: Song | null
}

const CJK_REGEX = /[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9fff\u3400-\u4dbf\uF900-\uFAFF\uac00-\ud7af]/

function WordHighlightedLine({
  text,
  progress,
  activeClassName,
  inactiveClassName,
  style,
}: {
  text: string
  progress: number
  activeClassName: string
  inactiveClassName: string
  style?: React.CSSProperties
}) {
  const hasSpaces = /\s/.test(text.trim())

  // If text has spaces (Korean, Japanese with word-segmentation, English): split by spaces
  // If no spaces (Chinese, unsegmented Japanese): split by characters
  const units = hasSpaces
    ? text.split(/\s+/).filter(Boolean)
    : [...text].filter(ch => ch.trim())

  if (units.length === 0) return null

  const separator = hasSpaces ? ' ' : ''
  const activeIndex = Math.floor(progress * units.length)

  return (
    <p className="leading-snug px-2" style={style}>
      {units.map((unit, i) => (
        <span
          key={i}
          className={i <= activeIndex ? activeClassName : inactiveClassName}
        >
          {unit}{i < units.length - 1 ? separator : ''}
        </span>
      ))}
    </p>
  )
}

export default function LyricsDisplay({
  lyrics,
  currentTimeMs,
  displayMode,
  status = 'playing',
  countdownSeconds = 0,
  countdownSong = null,
}: LyricsDisplayProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [currentLineIndex, setCurrentLineIndex] = useState<number>(-1)

  // Find the current line based on playback time
  useEffect(() => {
    if (!lyrics || !lyrics.lines.length) {
      setCurrentLineIndex(-1)
      return
    }

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

  // Countdown display
  if (status === 'countdown' && countdownSong) {
    return (
      <div className="h-full flex flex-col items-center justify-center px-8">
        <div className="text-center space-y-6">
          {/* Album art */}
          {countdownSong.image_url && (
            <div className="relative w-40 h-40 md:w-52 md:h-52 mx-auto rounded-2xl overflow-hidden shadow-2xl">
              <Image
                src={countdownSong.image_url}
                alt={countdownSong.name}
                fill
                className="object-cover"
              />
            </div>
          )}
          {/* Song info */}
          <div>
            <p className="text-2xl md:text-3xl font-bold text-white">
              {countdownSong.name}
            </p>
            <p className="text-lg md:text-xl text-gray-400 mt-1">
              {countdownSong.artist}
            </p>
          </div>
          {/* Countdown number */}
          <div className="text-8xl md:text-9xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 tabular-nums">
            {countdownSeconds}
          </div>
          <p className="text-lg text-gray-500">Get ready to sing!</p>
        </div>
      </div>
    )
  }

  // Empty states
  if (!lyrics || !lyrics.lines.length) {
    let icon = (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
      />
    )
    let title = 'No lyrics available'
    let subtitle = 'Enjoy the music and sing along!'

    if (status === 'empty_queue') {
      icon = (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      )
      title = 'Queue up some songs!'
      subtitle = 'Search for songs and add them to get the party started.'
    } else if (status === 'ready_to_play') {
      icon = (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
        />
      )
      title = 'Ready to go!'
      subtitle = 'Press play to start your karaoke session.'
    }

    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <div className="text-center space-y-4">
          <svg
            className="w-16 h-16 mx-auto text-gray-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            {icon}
          </svg>
          <p className="text-2xl font-medium">{title}</p>
          <p className="text-lg text-gray-600">{subtitle}</p>
        </div>
      </div>
    )
  }

  const currentLine = currentLineIndex >= 0 ? lyrics.lines[currentLineIndex] : null
  const nextLine = currentLineIndex + 1 < lyrics.lines.length ? lyrics.lines[currentLineIndex + 1] : null

  const getText = (line: LyricsLine) => {
    if (displayMode === 'romanized' && line.romanized_text) {
      // Korean: hangul is already a phonetic alphabet, show it instead of romanization
      if (lyrics?.language === 'korean') return line.text
      return line.romanized_text
    }
    return line.text
  }

  const getRomanized = (line: LyricsLine) => {
    if (displayMode === 'both') return line.romanized_text
    return null
  }

  // Calculate word-level progress within the current line
  let lineProgress = 1
  if (currentLine) {
    const lineStart = currentLine.time_ms
    const lineEnd = nextLine ? nextLine.time_ms : lineStart + 5000
    const fullDuration = lineEnd - lineStart

    // Line gaps often include trailing instrumental time after singing ends.
    // Compress highlighting so it keeps pace with the actual singing.
    const hasCJKText = CJK_REGEX.test(getText(currentLine))
    const duration = fullDuration * (hasCJKText ? 0.6 : 0.75)

    if (duration > 0) {
      lineProgress = Math.min(1, Math.max(0, (currentTimeMs - lineStart) / duration))
    }
  }

  return (
    <div
      ref={containerRef}
      className="h-full w-full flex flex-col items-center justify-center px-4 sm:px-8 md:px-12"
    >
      <div className="w-full max-w-5xl text-center flex flex-col items-center justify-center gap-[3vh]">
        {/* Current line */}
        <div
          key={`current-${currentLineIndex}`}
          className="flex flex-col items-center justify-center"
        >
          {currentLine ? (
            <>
              <WordHighlightedLine
                text={getText(currentLine)}
                progress={lineProgress}
                activeClassName="font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400"
                inactiveClassName="font-bold text-purple-400/40"
                style={{ fontSize: 'clamp(1.5rem, 5vw, 4rem)' }}
              />
              {getRomanized(currentLine) && (
                <WordHighlightedLine
                  text={getRomanized(currentLine)!}
                  progress={lineProgress}
                  activeClassName="text-purple-300"
                  inactiveClassName="text-purple-300/40"
                  style={{ fontSize: 'clamp(1rem, 3vw, 2.5rem)', marginTop: '0.5rem' }}
                />
              )}
            </>
          ) : (
            <p className="text-2xl font-medium text-gray-600">...</p>
          )}
        </div>

        {/* Divider */}
        <div className="w-16 h-px bg-gray-700/50" />

        {/* Next line */}
        <div className="flex flex-col items-center justify-center">
          {nextLine ? (
            <>
              <p
                className="font-medium leading-snug text-gray-400 px-2"
                style={{ fontSize: 'clamp(1.1rem, 3.2vw, 2.5rem)' }}
              >
                {getText(nextLine)}
              </p>
              {getRomanized(nextLine) && (
                <p
                  className="leading-snug text-gray-500 mt-1"
                  style={{ fontSize: 'clamp(0.85rem, 2vw, 1.8rem)' }}
                >
                  {getRomanized(nextLine)}
                </p>
              )}
            </>
          ) : currentLine ? (
            <p className="text-lg text-gray-600">...</p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
