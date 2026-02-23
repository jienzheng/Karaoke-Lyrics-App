'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import api from '@/lib/api'
import { useSpotifyPlayer } from '@/hooks/useSpotifyPlayer'
import {
  Session,
  QueueItemWithDetails,
  PlaybackStateWithDetails,
  Lyrics,
} from '@/types'
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
  const [showSidebar, setShowSidebar] = useState(true)
  const [sidebarTab, setSidebarTab] = useState<'queue' | 'search'>('queue')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [countdownSong, setCountdownSong] = useState<any>(null)

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
      router.push('/')
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
    const songId = playbackState?.current_song?.spotify_id || playbackState?.current_song?.id
    if (!songId) {
      setLyrics(null)
      return
    }

    const fetchLyrics = async () => {
      try {
        const lyricsData = await api.getSongLyrics(songId)
        setLyrics(lyricsData)
      } catch (err) {
        console.error('Failed to fetch lyrics:', err)
        setLyrics(null)
      }
    }

    fetchLyrics()
  }, [playbackState?.current_song])

  // Auto-advance: detect when song ends and trigger skip with countdown
  const isAdvancingRef = useRef(false)

  useEffect(() => {
    const durationMs = playbackState?.current_song?.duration_ms
    if (!playbackState?.current_song || !playerIsPlaying || !durationMs) return
    if (isAdvancingRef.current || countdown !== null) return

    if (currentPosition >= durationMs - 1000) {
      isAdvancingRef.current = true
      handleSkip().finally(() => {
        isAdvancingRef.current = false
      })
    }
  }, [currentPosition, playerIsPlaying, playbackState?.current_song, countdown])

  // Countdown helper: shows song info for 5 seconds, then starts playback
  const startWithCountdown = async (song: any) => {
    setCountdownSong(song)
    for (let i = 5; i >= 1; i--) {
      setCountdown(i)
      await new Promise((r) => setTimeout(r, 1000))
    }
    setCountdown(null)
    setCountdownSong(null)
    // Now actually play
    if (song?.spotify_uri) {
      await api.startPlayback(song.spotify_uri, deviceId)
    }
  }

  // Player controls
  const handlePlayPause = async () => {
    try {
      if (playerIsPlaying) {
        await api.pausePlayback()
        return
      }

      // If there's already a current song, resume from current position
      const currentSong = playbackState?.current_song
      if (currentSong?.spotify_uri) {
        await api.resumePlayback(deviceId)
        return
      }

      // No current song — advance queue to first song, countdown, then play
      const result = await api.skipSong(sessionId)
      const nextSong = result?.current_song?.song
      await fetchQueue()
      await fetchPlaybackState()
      if (nextSong) {
        await startWithCountdown(nextSong)
      }
    } catch (err) {
      console.error('Failed to toggle playback:', err)
    }
  }

  const handleSkip = async () => {
    try {
      await api.pausePlayback()
      const result = await api.skipSong(sessionId)
      const nextSong = result?.current_song?.song
      await fetchQueue()
      await fetchPlaybackState()
      if (nextSong) {
        await startWithCountdown(nextSong)
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
    try {
      if (player) {
        await player.seek(timeMs)
      } else {
        await api.seekPlayback(timeMs)
      }
    } catch (err) {
      console.error('Failed to seek:', err)
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
              onClick={() => {
                if (showSidebar && sidebarTab === 'search') { setShowSidebar(false) }
                else { setShowSidebar(true); setSidebarTab('search') }
              }}
              className={`p-2 rounded-lg transition-colors ${
                showSidebar && sidebarTab === 'search' ? 'bg-purple-600' : 'bg-gray-800/50 hover:bg-gray-700'
              }`}
              title="Search songs"
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
              onClick={() => {
                if (showSidebar && sidebarTab === 'queue') { setShowSidebar(false) }
                else { setShowSidebar(true); setSidebarTab('queue') }
              }}
              className={`p-2 rounded-lg transition-colors ${
                showSidebar && sidebarTab === 'queue' ? 'bg-purple-600' : 'bg-gray-800/50 hover:bg-gray-700'
              }`}
              title="Show queue"
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
          {showSidebar && (
            <div className="w-96 bg-black/30 backdrop-blur-sm border-r border-white/10 flex flex-col">
              {/* Tabs */}
              <div className="flex border-b border-white/10">
                <button
                  onClick={() => setSidebarTab('search')}
                  className={`flex-1 px-4 py-3 font-medium transition-colors ${
                    sidebarTab === 'search'
                      ? 'text-white border-b-2 border-purple-500'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Search
                </button>
                <button
                  onClick={() => setSidebarTab('queue')}
                  className={`flex-1 px-4 py-3 font-medium transition-colors ${
                    sidebarTab === 'queue'
                      ? 'text-white border-b-2 border-purple-500'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Queue ({queue.length})
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-hidden">
                {sidebarTab === 'search' ? (
                  <div className="h-full p-4 overflow-y-auto">
                    <SongSearch
                      sessionId={sessionId}
                      onAddToQueue={handleAddToQueue}
                    />
                  </div>
                ) : (
                  <QueueSidebar
                    queue={queue}
                    currentSongId={playbackState?.current_song?.id || null}
                    onRemove={handleRemoveFromQueue}
                    onReorder={handleReorderQueue}
                  />
                )}
              </div>
            </div>
          )}

          {/* Player Area */}
          <div className="flex-1 flex flex-col overflow-hidden min-h-0">
            {/* Lyrics — takes all available space */}
            <div className="flex-1 min-h-0 overflow-hidden relative">
              <LyricsDisplay
                lyrics={lyrics}
                currentTimeMs={currentPosition}
                displayMode={displayMode}
                countdownSeconds={countdown ?? 0}
                countdownSong={countdownSong}
                status={
                  countdown !== null
                    ? 'countdown'
                    : queue.length === 0 && !playbackState?.current_song
                    ? 'empty_queue'
                    : queue.length > 0 && !playbackState?.current_song
                    ? 'ready_to_play'
                    : playbackState?.current_song && !lyrics
                    ? 'no_lyrics'
                    : 'playing'
                }
              />
              {/* "Next song" banner — slides across bottom when ≤20s remaining */}
              {(() => {
                const durationMs = playbackState?.current_song?.duration_ms ?? 0
                const timeLeft = durationMs - currentPosition
                const nextSong = queue[0]
                if (!nextSong || !playerIsPlaying || timeLeft > 20000 || timeLeft <= 0 || countdown !== null) return null
                return (
                  <div className="absolute bottom-2 left-0 w-full overflow-hidden pointer-events-none">
                    <p
                      className="whitespace-nowrap text-sm text-gray-400 animate-marquee"
                      style={{ animation: 'marquee 10s linear infinite' }}
                    >
                      Next song: {nextSong.song.name} — {nextSong.song.artist}
                    </p>
                  </div>
                )
              })()}
            </div>

            {/* Controls + compact song info */}
            <div className="flex-shrink-0 bg-black/30 backdrop-blur-sm border-t border-white/10">
              {/* Compact now-playing bar */}
              {playbackState?.current_song && countdown === null && (
                <div className="flex items-center justify-center gap-3 px-4 pt-3">
                  <span className="text-sm font-semibold text-white truncate">
                    {playbackState.current_song.name}
                  </span>
                  <span className="text-sm text-gray-500">—</span>
                  <span className="text-sm text-gray-400 truncate">
                    {playbackState.current_song.artist}
                  </span>
                </div>
              )}
              <div className="p-4 md:p-6">
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
