'use client'

import { useState, useEffect, useCallback } from 'react'
import api from '@/lib/api'
import Image from 'next/image'

interface Song {
  id: string
  name: string
  artist: string
  album?: string
  duration_ms: number
  spotify_uri: string
  image_url?: string
}

interface SongSearchProps {
  sessionId: string
  onAddToQueue: (spotifyId: string) => void
}

export default function SongSearch({ sessionId, onAddToQueue }: SongSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Song[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [addingIds, setAddingIds] = useState<Set<string>>(new Set())

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      return
    }

    const timer = setTimeout(async () => {
      setIsLoading(true)
      setError(null)
      try {
        const data = await api.searchSongs(query)
        setResults(Array.isArray(data) ? data : [])
      } catch (err) {
        setError('Failed to search songs')
        console.error('Search error:', err)
      } finally {
        setIsLoading(false)
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [query])

  const handleAddToQueue = async (track: Song) => {
    setAddingIds(prev => new Set(prev).add(track.id))
    try {
      await onAddToQueue(track.id)
    } catch (err) {
      console.error('Failed to add to queue:', err)
    } finally {
      setAddingIds(prev => {
        const next = new Set(prev)
        next.delete(track.id)
        return next
      })
    }
  }

  const formatDuration = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  return (
    <div className="space-y-4">
      {/* Search Input */}
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for songs..."
          className="w-full px-4 py-3 pl-12 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-white placeholder-gray-400"
        />
        <svg
          className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        {isLoading && (
          <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-500" />
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-900/20 border border-red-500 rounded-lg p-4 text-red-400">
          {error}
        </div>
      )}

      {/* Results */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {results.length > 0 ? (
          results.map((track) => {
            const isAdding = addingIds.has(track.id)
            return (
              <div
                key={track.id}
                className="flex items-center space-x-3 p-3 bg-gray-800/50 hover:bg-gray-800 rounded-lg transition-colors group"
              >
                {/* Album Art */}
                <div className="relative w-14 h-14 rounded-md overflow-hidden flex-shrink-0">
                  {track.image_url ? (
                    <Image
                      src={track.image_url}
                      alt={track.name}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center">
                      <svg
                        className="w-6 h-6 text-white/50"
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
                </div>

                {/* Track Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-white truncate">{track.name}</p>
                  <p className="text-sm text-gray-400 truncate">
                    {track.artist}
                  </p>
                  <div className="flex items-center space-x-2 mt-1">
                    <span className="text-xs text-gray-500">
                      {formatDuration(track.duration_ms)}
                    </span>
                    <span className="text-xs text-gray-600">•</span>
                    <span className="text-xs text-gray-500 truncate">
                      {track.album}
                    </span>
                  </div>
                </div>

                {/* Add Button */}
                <button
                  onClick={() => handleAddToQueue(track)}
                  disabled={isAdding}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 rounded-lg transition-colors flex items-center space-x-2 flex-shrink-0"
                >
                  {isAdding ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                      <span className="text-sm font-medium">Adding...</span>
                    </>
                  ) : (
                    <>
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 4v16m8-8H4"
                        />
                      </svg>
                      <span className="text-sm font-medium">Add</span>
                    </>
                  )}
                </button>
              </div>
            )
          })
        ) : query.trim() && !isLoading ? (
          <div className="text-center py-12 text-gray-500">
            <svg
              className="w-12 h-12 mx-auto mb-4 text-gray-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <p className="text-lg">No results found</p>
            <p className="text-sm text-gray-600 mt-1">
              Try searching with different keywords
            </p>
          </div>
        ) : !query.trim() ? (
          <div className="text-center py-12 text-gray-500">
            <svg
              className="w-12 h-12 mx-auto mb-4 text-gray-600"
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
            <p className="text-lg">Start searching</p>
            <p className="text-sm text-gray-600 mt-1">
              Find songs to add to the queue
            </p>
          </div>
        ) : null}
      </div>
    </div>
  )
}
