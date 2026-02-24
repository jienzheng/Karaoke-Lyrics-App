'use client'

import { useState, useEffect } from 'react'

interface PlayerControlsProps {
  isPlaying: boolean
  currentTimeMs: number
  durationMs: number
  volume: number
  onPlayPause: () => void
  onSkip: () => void
  onVolumeChange: (volume: number) => void
  onSeek: (timeMs: number) => void
}

export default function PlayerControls({
  isPlaying,
  currentTimeMs,
  durationMs,
  volume,
  onPlayPause,
  onSkip,
  onVolumeChange,
  onSeek,
}: PlayerControlsProps) {
  const [localVolume, setLocalVolume] = useState(volume)

  useEffect(() => {
    setLocalVolume(volume)
  }, [volume])

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseInt(e.target.value)
    setLocalVolume(newVolume)
    onVolumeChange(newVolume)
  }

  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newPosition = parseInt(e.target.value)
    onSeek(newPosition)
  }

  const progressPercentage = durationMs > 0 ? (currentTimeMs / durationMs) * 100 : 0

  return (
    <div className="space-y-6">
      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="relative">
          <input
            type="range"
            min="0"
            max={durationMs}
            value={currentTimeMs}
            onChange={handleProgressChange}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
            style={{
              background: `linear-gradient(to right, #a855f7 0%, #a855f7 ${progressPercentage}%, #374151 ${progressPercentage}%, #374151 100%)`,
            }}
          />
        </div>
        <div className="flex justify-between text-sm text-gray-400">
          <span>{formatTime(currentTimeMs)}</span>
          <span>{formatTime(durationMs)}</span>
        </div>
      </div>

      {/* Main Controls */}
      <div className="flex items-center justify-center space-x-6">
        {/* Play/Pause Button */}
        <button
          onClick={onPlayPause}
          className="w-16 h-16 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 flex items-center justify-center transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 cursor-pointer"
        >
          {isPlaying ? (
            <svg
              className="w-8 h-8 text-white"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
            </svg>
          ) : (
            <svg
              className="w-8 h-8 text-white ml-1"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        {/* Skip Button */}
        <button
          onClick={onSkip}
          className="w-12 h-12 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center transition-all duration-200 cursor-pointer"
        >
          <svg
            className="w-6 h-6 text-white"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
          </svg>
        </button>
      </div>

      {/* Volume Control */}
      <div className="flex items-center space-x-4">
        <svg
          className="w-5 h-5 text-gray-400 flex-shrink-0"
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          {localVolume === 0 ? (
            <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
          ) : localVolume < 50 ? (
            <path d="M7 9v6h4l5 5V4l-5 5H7z" />
          ) : (
            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
          )}
        </svg>
        <input
          type="range"
          min="0"
          max="100"
          value={localVolume}
          onChange={handleVolumeChange}
          className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
          style={{
            background: `linear-gradient(to right, #a855f7 0%, #a855f7 ${localVolume}%, #374151 ${localVolume}%, #374151 100%)`,
          }}
        />
        <span className="text-sm text-gray-400 w-12 text-right">
          {localVolume}%
        </span>
      </div>
    </div>
  )
}
