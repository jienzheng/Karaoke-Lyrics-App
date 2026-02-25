'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import api from '@/lib/api'
import { useSpotifyPlayer } from '@/hooks/useSpotifyPlayer'
import {
  Session,
  Song,
  QueueItemWithDetails,
  PlaybackStateWithDetails,
  Lyrics,
} from '@/types'
import LyricsDisplay from '@/components/LyricsDisplay'
import PlayerControls from '@/components/PlayerControls'
import QueueSidebar from '@/components/QueueSidebar'
import SongSearch from '@/components/SongSearch'
import LandscapePrompt from '@/components/LandscapePrompt'

type LyricsDisplayMode = 'original' | 'romanized' | 'both'

export default function PlayerPage() {
  const params = useParams()
  const router = useRouter()
  const sessionId = params.sessionId as string

  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [isGuest, setIsGuest] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
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
  const [countdownSong, setCountdownSong] = useState<Song | null>(null)
  const [ready, setReady] = useState(false)

  // Guest sync state
  const [guestPosition, setGuestPosition] = useState(0)
  const [guestCountdown, setGuestCountdown] = useState<number | null>(null)
  const [guestCountdownSong, setGuestCountdownSong] = useState<Song | null>(null)

  // Guest users don't init Spotify SDK (pass null token)
  const {
    player,
    deviceId,
    isReady,
    currentPosition,
    isPlaying: playerIsPlaying,
    error: playerError,
  } = useSpotifyPlayer(isGuest ? null : accessToken)

  // Determine if current user is the session host
  const isHost = !!(session && userId && session.host_id === userId)

  // Get access token / detect guest
  // sessionStorage is per-tab (guest), localStorage is persistent (host)
  useEffect(() => {
    const guest = sessionStorage.getItem('is_guest') === 'true'
    setIsGuest(guest)
    setUserId(sessionStorage.getItem('user_id') || localStorage.getItem('user_id'))
    if (guest) {
      // Guests don't have an access token — that's fine
      setReady(true)
      return
    }
    const token = localStorage.getItem('access_token')
    if (!token) {
      router.push('/')
      return
    }
    setAccessToken(token)
    setReady(true)
  }, [router])

  // Fetch session data
  useEffect(() => {
    if (!ready) return

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
  }, [sessionId, ready])

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
    if (!ready) return
    fetchQueue()
    const interval = setInterval(fetchQueue, 5000)
    return () => clearInterval(interval)
  }, [ready, fetchQueue])

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
    if (!ready) return
    fetchPlaybackState()
    // Host has SDK — poll less often. Guests get position from sync endpoint,
    // this poll just provides current_song metadata for lyrics/display.
    const interval = setInterval(fetchPlaybackState, isHost ? 5000 : 3000)
    return () => clearInterval(interval)
  }, [ready, fetchPlaybackState, isHost])

  // Pre-fetched lyrics cache: songId -> Lyrics
  const prefetchedLyricsRef = useRef<Record<string, Lyrics>>({})

  // Build song metadata object for lyrics API (avoids Spotify token dependency)
  const buildSongMeta = (song: Song | null) =>
    song ? { name: song.name, artist: song.artist, album: song.album, duration_ms: song.duration_ms } : undefined

  // Fetch lyrics when current song changes (check prefetch cache first)
  useEffect(() => {
    const song = playbackState?.current_song
    const songId = song?.id
    if (!songId) {
      setLyrics(null)
      return
    }

    // Check prefetch cache first
    if (prefetchedLyricsRef.current[songId]) {
      setLyrics(prefetchedLyricsRef.current[songId])
      delete prefetchedLyricsRef.current[songId]
      return
    }

    const fetchLyrics = async () => {
      try {
        const lyricsData = await api.getSongLyrics(songId, sessionId, buildSongMeta(song))
        setLyrics(lyricsData)
      } catch (err) {
        console.error('Failed to fetch lyrics:', err)
        setLyrics(null)
      }
    }

    fetchLyrics()
  }, [playbackState?.current_song, sessionId])

  // Pre-fetch lyrics for the next song in queue
  const prefetchingRef = useRef<string | null>(null)
  useEffect(() => {
    if (!queue.length) return

    // Find the next song that isn't currently playing
    const currentSongId = playbackState?.current_song?.id
    const nextItem = currentSongId
      ? queue.find((item) => item.song.id !== currentSongId)
      : queue[0]

    if (!nextItem) return
    const nextSongId = nextItem.song.id

    // Skip if already prefetched or currently prefetching
    if (prefetchedLyricsRef.current[nextSongId] || prefetchingRef.current === nextSongId) return

    prefetchingRef.current = nextSongId
    api.getSongLyrics(nextSongId, sessionId, buildSongMeta(nextItem.song))
      .then((lyricsData) => {
        if (lyricsData) {
          prefetchedLyricsRef.current[nextSongId] = lyricsData
        }
      })
      .catch(() => {
        // Silent failure — lyrics will be fetched normally when song plays
      })
      .finally(() => {
        if (prefetchingRef.current === nextSongId) {
          prefetchingRef.current = null
        }
      })
  }, [queue, playbackState?.current_song, sessionId])

  // Auto-advance: detect when song ends and trigger skip with countdown (host only)
  const isAdvancingRef = useRef(false)

  useEffect(() => {
    if (!isHost) return
    const durationMs = playbackState?.current_song?.duration_ms
    if (!playbackState?.current_song || !playerIsPlaying || !durationMs) return
    if (isAdvancingRef.current || countdown !== null) return
    // Suppress auto-advance for 10s after a play/skip to avoid stale SDK
    // position data from the previous song triggering an immediate skip.
    if (Date.now() - playbackStartedAtRef.current < 10000) return

    if (currentPosition >= durationMs - 1000) {
      isAdvancingRef.current = true
      handleSkip().finally(() => {
        isAdvancingRef.current = false
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPosition, playerIsPlaying, playbackState?.current_song, countdown, isHost])

  // --- Host: report playback position to DB every 1s ---
  // Use refs so the single stable interval always reads fresh values
  // without tearing down/recreating on every state change.
  const currentPositionRef = useRef(0)
  currentPositionRef.current = currentPosition
  const playerIsPlayingRef = useRef(false)
  playerIsPlayingRef.current = playerIsPlaying
  const countdownRef = useRef<number | null>(null)
  countdownRef.current = countdown
  const currentSongIdRef = useRef<string | null>(null)
  currentSongIdRef.current = playbackState?.current_song?.id ?? null

  useEffect(() => {
    if (!isHost || !session) return

    const report = () => {
      api.updatePlaybackState(sessionId, {
        is_playing: playerIsPlayingRef.current,
        position_ms: currentPositionRef.current,
        song_id: currentSongIdRef.current,
        countdown: countdownRef.current,
      }).catch(() => {})
    }

    // Single stable interval — reads current values from refs each tick
    report()
    const interval = setInterval(report, 1000)
    return () => clearInterval(interval)
  }, [isHost, session, sessionId])

  // --- Guest: poll playback state + rAF interpolation ---
  const queueRef = useRef(queue)
  queueRef.current = queue
  const guestSyncRef = useRef<{
    basePos: number
    baseTime: number
    isPlaying: boolean
    songId: string | null
    durationMs: number
  }>({ basePos: 0, baseTime: 0, isPlaying: false, songId: null, durationMs: 0 })
  const guestRafRef = useRef<number>(0)
  const lastGuestSongIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (isHost || !ready) return

    let cancelled = false

    const poll = async () => {
      try {
        const state = await api.getPlaybackStateSync(sessionId)
        if (cancelled || !state) return

        const serverAge = Date.now() - new Date(state.updated_at).getTime()
        const adjustedPos = state.is_playing
          ? state.position_ms + Math.max(0, serverAge)
          : state.position_ms

        // Use ref to read queue without needing it as a dependency
        const currentQueue = queueRef.current
        const songDuration =
          currentQueue.find((q) => q.song.id === state.song_id)?.song.duration_ms ?? Infinity

        // Detect song change → eagerly refresh metadata so lyrics load faster
        if (state.song_id && state.song_id !== lastGuestSongIdRef.current) {
          lastGuestSongIdRef.current = state.song_id
          fetchPlaybackState() // fire-and-forget — updates playbackState.current_song
        }

        guestSyncRef.current = {
          basePos: adjustedPos,
          baseTime: performance.now(),
          isPlaying: state.is_playing,
          songId: state.song_id,
          durationMs: songDuration,
        }
        setGuestPosition(Math.min(adjustedPos, songDuration))

        // Countdown
        setGuestCountdown(state.countdown)
        if (state.countdown !== null) {
          const nextInQueue = currentQueue[0]?.song ?? null
          setGuestCountdownSong(nextInQueue)
        } else {
          setGuestCountdownSong(null)
        }
      } catch {
        // silent — next poll will retry
      }
    }

    poll()
    const interval = setInterval(poll, 1000)

    // rAF interpolation loop — throttled to ~20fps to avoid excessive re-renders
    let lastSetTime = 0
    const tick = () => {
      if (cancelled) return
      const s = guestSyncRef.current
      if (s.isPlaying) {
        const now = performance.now()
        if (now - lastSetTime > 50) {
          const elapsed = now - s.baseTime
          const pos = Math.min(s.basePos + elapsed, s.durationMs)
          setGuestPosition(pos)
          lastSetTime = now
        }
      }
      guestRafRef.current = requestAnimationFrame(tick)
    }
    guestRafRef.current = requestAnimationFrame(tick)

    return () => {
      cancelled = true
      clearInterval(interval)
      cancelAnimationFrame(guestRafRef.current)
    }
  }, [isHost, ready, sessionId, fetchPlaybackState]) // No `queue` — uses queueRef instead

  // Countdown helper: shows song info for N seconds, then starts playback.
  // Setting countdownCancelledRef causes the loop to stop early.
  const countdownCancelledRef = useRef(false)
  const countdownSongRef = useRef<Song | null>(null)
  // Tracks which song URI Spotify currently has loaded — used to decide
  // between startPlayback (new song) vs resumePlayback (pause/unpause).
  const activeSpotifyUriRef = useRef<string | null>(null)
  // Wall-clock time of the last play/skip action — auto-advance is suppressed
  // for 10 seconds after to avoid a race with stale SDK position data.
  const playbackStartedAtRef = useRef<number>(0)

  const startWithCountdown = async (song: Song) => {
    countdownCancelledRef.current = false
    countdownSongRef.current = song
    setCountdownSong(song)
    for (let i = 5; i >= 1; i--) {
      if (countdownCancelledRef.current) break
      setCountdown(i)
      await new Promise((r) => setTimeout(r, 1000))
    }
    // If cancelled, handlePlayPause already started playback directly
    if (countdownCancelledRef.current) return
    setCountdown(null)
    setCountdownSong(null)
    countdownSongRef.current = null
    // Now actually play
    if (song?.spotify_uri) {
      playbackStartedAtRef.current = Date.now()
      await api.startPlayback(song.spotify_uri, deviceId)
      activeSpotifyUriRef.current = song.spotify_uri
    }
  }

  // Player controls
  const handlePlayPause = async () => {
    try {
      if (playerIsPlaying) {
        await api.pausePlayback()
        return
      }

      // During countdown: cancel it and start the song immediately
      if (countdown !== null && countdownSongRef.current) {
        const song = countdownSongRef.current
        countdownCancelledRef.current = true
        // Clear countdown UI immediately
        setCountdown(null)
        setCountdownSong(null)
        countdownSongRef.current = null
        // Start playback directly
        if (song?.spotify_uri) {
          playbackStartedAtRef.current = Date.now()
          await api.startPlayback(song.spotify_uri, deviceId)
          activeSpotifyUriRef.current = song.spotify_uri
        }
        return
      }

      // If there's already a current song, start or resume it
      const currentSong = playbackState?.current_song
      if (currentSong?.spotify_uri) {
        playbackStartedAtRef.current = Date.now()
        if (activeSpotifyUriRef.current === currentSong.spotify_uri) {
          // Same song Spotify already has loaded — resume to keep position
          await api.resumePlayback(deviceId)
        } else {
          // Different song (e.g. after skip) — start fresh
          await api.startPlayback(currentSong.spotify_uri, deviceId)
          activeSpotifyUriRef.current = currentSong.spotify_uri
        }
        return
      }

      // No current song — advance queue to first song, countdown, then play
      const result = await api.skipSong(sessionId)
      const nextSong = result?.current_song?.song
      // Refresh in background — don't block countdown
      fetchQueue()
      fetchPlaybackState()
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
      activeSpotifyUriRef.current = null
      playbackStartedAtRef.current = Date.now()
      setLyrics(null)
      const result = await api.skipSong(sessionId)
      const nextSong = result?.current_song?.song
      // Refresh queue/playback in background — don't block countdown
      fetchQueue()
      fetchPlaybackState()
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

  const handleReorderQueue = async (orderedIds: string[]) => {
    // Optimistically reorder local state
    const reordered = orderedIds
      .map((id) => queue.find((item) => item.id === id))
      .filter(Boolean) as QueueItemWithDetails[]
    setQueue(reordered)

    try {
      await api.reorderQueueBatch(sessionId, orderedIds)
    } catch (err) {
      console.error('Failed to reorder queue:', err)
      await fetchQueue()
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
        {/* Landscape prompt — only visible on portrait mobile */}
        <LandscapePrompt />

        {/* Header */}
        <header className="flex items-center justify-between px-3 py-2 md:px-6 md:py-4 bg-black/20 backdrop-blur-sm border-b border-white/10">
          <div className="flex items-center space-x-2 md:space-x-4">
            {/* Title hidden on small screens to save space */}
            <h1 className="hidden sm:block text-lg md:text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              Karaoke
            </h1>
            {session && (
              <span className="px-2 py-0.5 md:px-3 md:py-1 bg-purple-600/30 rounded-full text-xs md:text-sm font-mono">
                {session.code}
              </span>
            )}
          </div>

          <div className="flex items-center space-x-2 md:space-x-4">
            {/* Lyrics Display Mode Toggle */}
            <div className="flex items-center bg-gray-800/50 rounded-lg p-0.5 md:p-1">
              <button
                onClick={() => setDisplayMode('original')}
                className={`px-2 py-0.5 md:px-3 md:py-1 rounded-md text-xs md:text-sm font-medium transition-colors ${
                  displayMode === 'original'
                    ? 'bg-purple-600 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Orig
              </button>
              <button
                onClick={() => setDisplayMode('romanized')}
                className={`px-2 py-0.5 md:px-3 md:py-1 rounded-md text-xs md:text-sm font-medium transition-colors ${
                  displayMode === 'romanized'
                    ? 'bg-purple-600 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Rom
              </button>
              <button
                onClick={() => setDisplayMode('both')}
                className={`px-2 py-0.5 md:px-3 md:py-1 rounded-md text-xs md:text-sm font-medium transition-colors ${
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
              className={`p-1.5 md:p-2 rounded-lg transition-colors ${
                showSidebar && sidebarTab === 'search' ? 'bg-purple-600' : 'bg-gray-800/50 hover:bg-gray-700'
              }`}
              title="Search songs"
            >
              <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>

            <button
              onClick={() => {
                if (showSidebar && sidebarTab === 'queue') { setShowSidebar(false) }
                else { setShowSidebar(true); setSidebarTab('queue') }
              }}
              className={`p-1.5 md:p-2 rounded-lg transition-colors ${
                showSidebar && sidebarTab === 'queue' ? 'bg-purple-600' : 'bg-gray-800/50 hover:bg-gray-700'
              }`}
              title="Show queue"
            >
              <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
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
                currentTimeMs={isHost ? currentPosition : guestPosition}
                displayMode={displayMode}
                countdownSeconds={isHost ? (countdown ?? 0) : (guestCountdown ?? 0)}
                countdownSong={isHost ? countdownSong : guestCountdownSong}
                status={
                  (isHost ? countdown : guestCountdown) !== null
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
              {/* "Next song" banner — slides across bottom when ≤20s remaining (host only) */}
              {isHost && (() => {
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
            {!isHost ? (
              /* Non-host: show compact now-playing info bar only */
              playbackState?.current_song && (
                <div className="flex-shrink-0 bg-black/30 backdrop-blur-sm border-t border-white/10">
                  <div className="flex items-center justify-center gap-3 px-4 py-3">
                    <span className="text-sm font-semibold text-white truncate">
                      {playbackState.current_song.name}
                    </span>
                    <span className="text-sm text-gray-500">—</span>
                    <span className="text-sm text-gray-400 truncate">
                      {playbackState.current_song.artist}
                    </span>
                  </div>
                </div>
              )
            ) : (
              <div className="flex-shrink-0 bg-black/30 backdrop-blur-sm border-t border-white/10">
                {/* Compact now-playing bar */}
                {playbackState?.current_song && countdown === null && (
                  <div className="flex items-center justify-center gap-3 px-3 pt-2 md:pt-3">
                    <span className="text-sm font-semibold text-white truncate">
                      {playbackState.current_song.name}
                    </span>
                    <span className="text-sm text-gray-500">—</span>
                    <span className="text-sm text-gray-400 truncate">
                      {playbackState.current_song.artist}
                    </span>
                  </div>
                )}
                <div className="p-2 md:p-6">
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
            )}
          </div>
        </div>

        {/* Player Status (host only) */}
        {isHost && !isReady && deviceId && (
          <div className="absolute bottom-4 left-4 px-4 py-2 bg-yellow-600/90 rounded-lg text-sm">
            Connecting to Spotify...
          </div>
        )}
        {isHost && playerError && (
          <div className="absolute bottom-4 left-4 px-4 py-2 bg-red-600/90 rounded-lg text-sm">
            Player Error: {playerError}
          </div>
        )}
      </div>
    </div>
  )
}
