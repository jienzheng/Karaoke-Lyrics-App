'use client'

import { QueueItemWithDetails } from '@/types'
import Image from 'next/image'

interface QueueSidebarProps {
  queue: QueueItemWithDetails[]
  currentSongId: string | null
  onRemove: (queueItemId: string) => void
  onReorder: (queueItemId: string, direction: 'up' | 'down') => void
}

export default function QueueSidebar({
  queue,
  currentSongId,
  onRemove,
  onReorder,
}: QueueSidebarProps) {
  const formatDuration = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  if (queue.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500">
        <div className="text-center space-y-4 p-6">
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
              d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
            />
          </svg>
          <p className="text-lg font-medium">Queue is empty</p>
          <p className="text-sm text-gray-600">Add songs to get started</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-4 space-y-3">
        {queue.map((item, index) => {
          const isPlaying = item.song.id === currentSongId
          const isFirst = index === 0
          const isLast = index === queue.length - 1

          return (
            <div
              key={item.id}
              className={`
                relative group rounded-lg overflow-hidden transition-all duration-200
                ${isPlaying ? 'bg-gradient-to-r from-purple-600/20 to-pink-600/20 ring-2 ring-purple-500' : 'bg-gray-800/50 hover:bg-gray-800'}
              `}
            >
              <div className="flex items-center space-x-3 p-3">
                {/* Album Art */}
                <div className="relative w-16 h-16 rounded-md overflow-hidden flex-shrink-0">
                  {item.song.image_url ? (
                    <Image
                      src={item.song.image_url}
                      alt={item.song.name}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center">
                      <svg
                        className="w-8 h-8 text-white/50"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                        />
                      </svg>
                    </div>
                  )}
                  {isPlaying && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <div className="flex space-x-0.5">
                        <div className="w-0.5 h-3 bg-white rounded-full animate-pulse" />
                        <div className="w-0.5 h-3 bg-white rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
                        <div className="w-0.5 h-3 bg-white rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  )}
                </div>

                {/* Song Info */}
                <div className="flex-1 min-w-0">
                  <p className={`font-medium truncate ${isPlaying ? 'text-purple-300' : 'text-white'}`}>
                    {item.song.name}
                  </p>
                  <p className="text-sm text-gray-400 truncate">
                    {item.song.artist}
                  </p>
                  <div className="flex items-center space-x-2 mt-1">
                    <span className="text-xs text-gray-500">
                      {formatDuration(item.song.duration_ms)}
                    </span>
                    <span className="text-xs text-gray-600">•</span>
                    <span className="text-xs text-gray-500">
                      Added by {item.added_by}
                    </span>
                  </div>
                </div>

                {/* Controls */}
                <div className="flex flex-col space-y-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {!isFirst && (
                    <button
                      onClick={() => onReorder(item.id, 'up')}
                      className="p-1 hover:bg-gray-700 rounded transition-colors"
                      title="Move up"
                    >
                      <svg
                        className="w-4 h-4 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 15l7-7 7 7"
                        />
                      </svg>
                    </button>
                  )}
                  {!isLast && (
                    <button
                      onClick={() => onReorder(item.id, 'down')}
                      className="p-1 hover:bg-gray-700 rounded transition-colors"
                      title="Move down"
                    >
                      <svg
                        className="w-4 h-4 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </button>
                  )}
                  <button
                    onClick={() => onRemove(item.id)}
                    className="p-1 hover:bg-red-600/20 rounded transition-colors"
                    title="Remove"
                  >
                    <svg
                      className="w-4 h-4 text-red-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
