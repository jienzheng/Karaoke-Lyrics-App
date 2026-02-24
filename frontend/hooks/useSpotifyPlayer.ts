'use client'

import { useEffect, useState, useRef } from 'react'

interface UseSpotifyPlayerReturn {
  player: Spotify.Player | null
  deviceId: string | null
  isReady: boolean
  currentPosition: number
  isPlaying: boolean
  error: string | null
}

export function useSpotifyPlayer(accessToken: string | null): UseSpotifyPlayerReturn {
  const [player, setPlayer] = useState<Spotify.Player | null>(null)
  const [deviceId, setDeviceId] = useState<string | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [currentPosition, setCurrentPosition] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const playerRef = useRef<Spotify.Player | null>(null)
  // Timestamp-based position tracking for accurate lyrics sync
  const playbackRef = useRef<{ position: number; timestamp: number; playing: boolean }>({
    position: 0, timestamp: 0, playing: false,
  })
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    if (!accessToken) return

    const initPlayer = () => {
      // Don't create a second player if one already exists
      if (playerRef.current) return

      const spotifyPlayer = new window.Spotify.Player({
        name: 'Karaoke Player',
        getOAuthToken: (cb: (token: string) => void) => {
          cb(accessToken)
        },
        volume: 0.5,
      })

      spotifyPlayer.addListener('ready', ({ device_id }) => {
        console.log('Spotify player ready with device ID:', device_id)
        setDeviceId(device_id)
        setIsReady(true)
      })

      spotifyPlayer.addListener('not_ready', ({ device_id }) => {
        console.log('Device has gone offline:', device_id)
        setIsReady(false)
      })

      spotifyPlayer.addListener('player_state_changed', (state) => {
        if (!state) return

        // Record the exact position and wall-clock time for interpolation
        playbackRef.current = {
          position: state.position,
          timestamp: performance.now(),
          playing: !state.paused,
        }
        setCurrentPosition(state.position)
        setIsPlaying(!state.paused)

        // Start or stop the animation frame loop
        if (!state.paused && !rafRef.current) {
          const tick = () => {
            const { position, timestamp, playing } = playbackRef.current
            if (playing) {
              const elapsed = performance.now() - timestamp
              setCurrentPosition(Math.round(position + elapsed))
              rafRef.current = requestAnimationFrame(tick)
            }
          }
          rafRef.current = requestAnimationFrame(tick)
        } else if (state.paused && rafRef.current) {
          cancelAnimationFrame(rafRef.current)
          rafRef.current = null
        }
      })

      spotifyPlayer.addListener('initialization_error', ({ message }) => {
        console.error('Initialization error:', message)
        setError(message)
      })

      spotifyPlayer.addListener('authentication_error', ({ message }) => {
        console.error('Authentication error:', message)
        setError(message)
      })

      spotifyPlayer.addListener('account_error', ({ message }) => {
        console.error('Account error:', message)
        setError(message)
      })

      spotifyPlayer.addListener('playback_error', ({ message }) => {
        console.error('Playback error:', message)
        setError(message)
      })

      spotifyPlayer.connect()
      playerRef.current = spotifyPlayer
      setPlayer(spotifyPlayer)
    }

    // If SDK is already loaded, init immediately. Otherwise load the script.
    if (window.Spotify) {
      initPlayer()
    } else {
      window.onSpotifyWebPlaybackSDKReady = initPlayer

      // Only add the script if it hasn't been added yet
      if (!document.querySelector('script[src="https://sdk.scdn.co/spotify-player.js"]')) {
        const script = document.createElement('script')
        script.src = 'https://sdk.scdn.co/spotify-player.js'
        script.async = true
        document.body.appendChild(script)
      }
    }

    return () => {
      if (playerRef.current) {
        playerRef.current.disconnect()
        playerRef.current = null
      }
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
  }, [accessToken])

  return {
    player,
    deviceId,
    isReady,
    currentPosition,
    isPlaying,
    error,
  }
}
