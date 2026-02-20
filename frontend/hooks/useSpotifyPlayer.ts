'use client'

import { useEffect, useState, useRef, useCallback } from 'react'

interface SpotifyPlayer {
  connect(): Promise<boolean>
  disconnect(): void
  pause(): Promise<void>
  resume(): Promise<void>
  togglePlay(): Promise<void>
  seek(position_ms: number): Promise<void>
  setVolume(volume: number): Promise<void>
  nextTrack(): Promise<void>
  previousTrack(): Promise<void>
  getCurrentState(): Promise<Spotify.PlaybackState | null>
  addListener(event: string, callback: (data: any) => void): void
  removeListener(event: string, callback?: (data: any) => void): void
}

interface SpotifyPlayerState {
  position: number
  duration: number
  paused: boolean
  track_window: {
    current_track: {
      id: string
      name: string
      artists: Array<{ name: string }>
      album: {
        name: string
        images: Array<{ url: string }>
      }
      duration_ms: number
    }
  }
}

interface UseSpotifyPlayerReturn {
  player: SpotifyPlayer | null
  deviceId: string | null
  isReady: boolean
  currentPosition: number
  isPlaying: boolean
  error: string | null
}

export function useSpotifyPlayer(accessToken: string | null): UseSpotifyPlayerReturn {
  const [player, setPlayer] = useState<SpotifyPlayer | null>(null)
  const [deviceId, setDeviceId] = useState<string | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [currentPosition, setCurrentPosition] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const positionIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Load Spotify SDK script
  useEffect(() => {
    if (!accessToken) return

    // Check if script is already loaded
    if ((window as any).Spotify) {
      return
    }

    const script = document.createElement('script')
    script.src = 'https://sdk.scdn.co/spotify-player.js'
    script.async = true
    document.body.appendChild(script)

    return () => {
      // Cleanup script if component unmounts before loading
      if (script.parentNode) {
        script.parentNode.removeChild(script)
      }
    }
  }, [accessToken])

  // Initialize player
  useEffect(() => {
    if (!accessToken) return

    ;(window as any).onSpotifyWebPlaybackSDKReady = () => {
      const spotifyPlayer = new (window as any).Spotify.Player({
        name: 'Karaoke Player',
        getOAuthToken: (cb: (token: string) => void) => {
          cb(accessToken)
        },
        volume: 0.5,
      })

      // Ready
      spotifyPlayer.addListener('ready', ({ device_id }: { device_id: string }) => {
        console.log('Spotify player ready with device ID:', device_id)
        setDeviceId(device_id)
        setIsReady(true)
      })

      // Not Ready
      spotifyPlayer.addListener('not_ready', ({ device_id }: { device_id: string }) => {
        console.log('Device has gone offline:', device_id)
        setIsReady(false)
      })

      // Player state changed
      spotifyPlayer.addListener('player_state_changed', (state: SpotifyPlayerState | null) => {
        if (!state) return

        setCurrentPosition(state.position)
        setIsPlaying(!state.paused)

        // Update position while playing
        if (!state.paused) {
          if (positionIntervalRef.current) {
            clearInterval(positionIntervalRef.current)
          }
          positionIntervalRef.current = setInterval(() => {
            setCurrentPosition((prev) => prev + 1000)
          }, 1000)
        } else {
          if (positionIntervalRef.current) {
            clearInterval(positionIntervalRef.current)
            positionIntervalRef.current = null
          }
        }
      })

      // Errors
      spotifyPlayer.addListener('initialization_error', ({ message }: { message: string }) => {
        console.error('Initialization error:', message)
        setError(message)
      })

      spotifyPlayer.addListener('authentication_error', ({ message }: { message: string }) => {
        console.error('Authentication error:', message)
        setError(message)
      })

      spotifyPlayer.addListener('account_error', ({ message }: { message: string }) => {
        console.error('Account error:', message)
        setError(message)
      })

      spotifyPlayer.addListener('playback_error', ({ message }: { message: string }) => {
        console.error('Playback error:', message)
        setError(message)
      })

      // Connect to the player
      spotifyPlayer.connect()

      setPlayer(spotifyPlayer)
    }

    return () => {
      if (player) {
        player.disconnect()
      }
      if (positionIntervalRef.current) {
        clearInterval(positionIntervalRef.current)
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
