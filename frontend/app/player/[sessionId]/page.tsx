'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import api from '@/lib/api'
import { useSpotifyPlayer } from '@/hooks/useSpotifyPlayer'
import {
  Session,
  QueueItemWithDetails,
  PlaybackStateWithDetails,
  Lyrics,
} from '@/types'
import NowPlaying from '@/components/NowPlaying'
import LyricsDisplay from '@/components/LyricsDisplay'
import PlayerControls from '@/components/PlayerControls'
import QueueSidebar from '@/components/QueueSidebar'
import SongSearch from '@/components/SongSearch'

type LyricsDisplayMode = 'original' | 'romanized' | 'both'

export default function PlayerPage() {
  const params = useParams()
  const router = useRouter()
  const sessionId = params.sessionId as string

  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [queue, setQueue] = useState<QueueItemWithDetails[]>([])
  const [playbackState, setPlaybackState] = useState<PlaybackStateWithDetails | null>(null)
  const [lyrics, setLyrics] = useState<Lyrics | null>(null)
  const [volume, setVolume] = useState(50)
  const [displayMode, setDisplayMode] = useState<LyricsDisplayMode>('both')
  const [showQueue, setShowQueue] = useState(true)
  const [showSearch, setShowSearch] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const {
    player,
    deviceId,
    isReady,
    currentPosition,
    isPlaying: playerIsPlaying,
    error: playerError,
  } = useSpotifyPlayer(accessToken)

  // Get access token
  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) {
      router.push('/login')
      return
    }
    setAccessToken(token)
  }, [router])

  // Fetch session data
  useEffect(() => {
    if (!accessToken) return

    const fetchSession = async () => {
      try {
        const sessionData = await api.getSession(sessionId)
        setSession(sessionData)
      } catch (err) {
        console.error('Failed to fetch session:', err)
        setError('Failed to load session')
      } finally {
        setIsLoading(false)
      }
    }

    fetchSession()
  }, [sessionId, accessToken])

  // Fetch queue
  const fetchQueue = useCallback(async () => {
    try {
      const queueData = await api.getQueue(sessionId)
      setQueue(queueData)
    } catch (err) {
      console.error('Failed to fetch queue:', err)
    }
  }, [sessionId])

  useEffect(() => {
    if (!accessToken) return
    fetchQueue()
    const interval = setInterval(fetchQueue, 5000)
    return () => clearInterval(interval)
  }, [accessToken, fetchQueue])

  // Fetch playback state
  const fetchPlaybackState = useCallback(async () => {
    try {
      const state = await api.getPlaybackState(sessionId)
      setPlaybackState(state)
    } catch (err) {
      console.error('Failed to fetch playback state:', err)
    }
  }, [sessionId])

  useEffect(() => {
    if (!accessToken) return
    fetchPlaybackState()
    const interval = setInterval(fetchPlaybackState, 2000)
    return () => clearInterval(interval)
  }, [accessToken, fetchPlaybackState])

  // Fetch lyrics when current song changes
  useEffect(() => {
    if (!playbackState?.current_song?.spotify_id) {
      setLyrics(null)
      return
    }

    const fetchLyrics = async () => {
      try {
        const lyricsData = await api.getSongLyrics(
          playbackState.current_song!.spotify_id
        )
        setLyrics(lyricsData)
      } catch (err) {
        console.error('Failed to fetch lyrics:', err)
        setLyrics(null)
      }
    }

    fetchLyrics()
  }, [playbackState?.current_song?.spotify_id])

  // Player controls
  const handlePlayPause = async () => {
    if (!player) return

    try {
      if (playerIsPlaying) {
        await api.pausePlayback(sessionId)
        await player.pause()
      } else {
        await api.startPlayback(sessionId)
        await player.resume()
      }
    } catch (err) {
      console.error('Failed to toggle playback:', err)
    }
  }

  const handleSkip = async () => {
    try {
      await api.skipSong(sessionId)
      if (player) {
        await player.nextTrack()
      }
    } catch (err) {
      console.error('Failed to skip song:', err)
    }
  }

  const handleVolumeChange = async (newVolume: number) => {
    setVolume(newVolume)
    if (player) {
      try {
        await player.setVolume(newVolume / 100)
      } catch (err) {
        console.error('Failed to set volume:', err)
      }
    }
  }

  const handleSeek = async (timeMs: number) => {
    if (player) {
      try {
        await player.seek(timeMs)
      } catch (err) {
        console.error('Failed to seek:', err)
      }
    }
  }

  const handleRemoveFromQueue = async (queueItemId: string) => {
    try {
      await api.removeFromQueue(sessionId, queueItemId)
      await fetchQueue()
    } catch (err) {
      console.error('Failed to remove from queue:', err)
    }
  }

  const handleReorderQueue = async (queueItemId: string, direction: 'up' | 'down') => {
    const itemIndex = queue.findIndex((item) => item.id === queueItemId)
    if (itemIndex === -1) return

    const newPosition = direction === 'up' ? itemIndex - 1 : itemIndex + 1
    if (newPosition < 0 || newPosition >= queue.length) return

    try {
      await api.reorderQueue(sessionId, queueItemId, newPosition)
      await fetchQueue()
    } catch (err) {
      console.error('Failed to reorder queue:', err)
    }
  }

  const handleAddToQueue = async (spotifyId: string) => {
    try {
      await api.addToQueue(sessionId, spotifyId)
      await fetchQueue()
    } catch (err) {
      console.error('Failed to add to queue:', err)
      throw err
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-500 mx-auto" />
          <p className="text-xl text-white">Loading karaoke player...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md">
          <svg
            className="w-16 h-16 mx-auto text-red-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <h2 className="text-2xl font-bold text-white">Error</h2>
          <p className="text-gray-300">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
          >
            Go Home
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white overflow-hidden">
      <div className="h-full flex flex-col">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 bg-black/20 backdrop-blur-sm border-b border-white/10">
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              Karaoke Player
            </h1>
            {session && (
              <span className="px-3 py-1 bg-purple-600/30 rounded-full text-sm font-mono">
                Session: {session.code}
              </span>
            )}
          </div>

          <div className="flex items-center space-x-4">
            {/* Lyrics Display Mode Toggle */}
            <div className="flex items-center space-x-2 bg-gray-800/50 rounded-lg p-1">
              <button
                onClick={() => setDisplayMode('original')}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  displayMode === 'original'
                    ? 'bg-purple-600 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Original
              </button>
              <button
                onClick={() => setDisplayMode('romanized')}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  displayMode === 'romanized'
                    ? 'bg-purple-600 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Romanized
              </button>
              <button
                onClick={() => setDisplayMode('both')}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  displayMode === 'both'
                    ? 'bg-purple-600 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Both
              </button>
            </div>

            {/* Toggle Buttons */}
            <button
              onClick={() => setShowSearch(!showSearch)}
              className={`p-2 rounded-lg transition-colors ${
                showSearch ? 'bg-purple-600' : 'bg-gray-800/50 hover:bg-gray-700'
              }`}
              title="Toggle search"
            >
              <svg
                className="w-5 h-5"
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
            </button>

            <button
              onClick={() => setShowQueue(!showQueue)}
              className={`p-2 rounded-lg transition-colors ${
                showQueue ? 'bg-purple-600' : 'bg-gray-800/50 hover:bg-gray-700'
              }`}
              title="Toggle queue"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 10h16M4 14h16M4 18h16"
                />
              </svg>
            </button>
          </div>
        </header>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar (Search/Queue) */}
          {(showSearch || showQueue) && (
            <div className="w-96 bg-black/30 backdrop-blur-sm border-r border-white/10 flex flex-col">
              {/* Tabs */}
              <div className="flex border-b border-white/10">
                {showSearch && (
                  <button
                    onClick={() => setShowSearch(true)}
                    className={`flex-1 px-4 py-3 font-medium transition-colors ${
                      showSearch && !showQueue
                        ? 'text-white border-b-2 border-purple-500'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Search
                  </button>
                )}
                {showQueue && (
                  <button
                    className="flex-1 px-4 py-3 font-medium text-white border-b-2 border-purple-500"
                  >
                    Queue ({queue.length})
                  </button>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 overflow-hidden">
                {showSearch && !showQueue ? (
                  <div className="h-full p-4 overflow-y-auto">
                    <SongSearch
                      sessionId={sessionId}
                      onAddToQueue={handleAddToQueue}
                    />
                  </div>
                ) : showQueue ? (
                  <QueueSidebar
                    queue={queue}
                    currentSongId={playbackState?.current_song?.id || null}
                    onRemove={handleRemoveFromQueue}
                    onReorder={handleReorderQueue}
                  />
                ) : null}
              </div>
            </div>
          )}

          {/* Player Area */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Now Playing */}
            {playbackState?.current_song && (
              <div className="flex-shrink-0">
                <NowPlaying
                  song={playbackState.current_song}
                  isPlaying={playerIsPlaying}
                />
              </div>
            )}

            {/* Lyrics */}
            <div className="flex-1 overflow-hidden">
              <LyricsDisplay
                lyrics={lyrics}
                currentTimeMs={currentPosition}
                displayMode={displayMode}
              />
            </div>

            {/* Controls */}
            <div className="flex-shrink-0 p-6 bg-black/30 backdrop-blur-sm border-t border-white/10">
              <PlayerControls
                isPlaying={playerIsPlaying}
                currentTimeMs={currentPosition}
                durationMs={playbackState?.current_song?.duration_ms || 0}
                volume={volume}
                onPlayPause={handlePlayPause}
                onSkip={handleSkip}
                onVolumeChange={handleVolumeChange}
                onSeek={handleSeek}
              />
            </div>
          </div>
        </div>

        {/* Player Status */}
        {!isReady && deviceId && (
          <div className="absolute bottom-4 left-4 px-4 py-2 bg-yellow-600/90 rounded-lg text-sm">
            Connecting to Spotify...
          </div>
        )}
        {playerError && (
          <div className="absolute bottom-4 left-4 px-4 py-2 bg-red-600/90 rounded-lg text-sm">
            Player Error: {playerError}
          </div>
        )}
      </div>
    </div>
  )
}
