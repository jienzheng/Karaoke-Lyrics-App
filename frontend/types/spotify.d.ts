declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady: () => void
    Spotify: typeof Spotify
  }
}

declare namespace Spotify {
  interface Player {
    new (options: PlayerOptions): Player
    connect(): Promise<boolean>
    disconnect(): void
    addListener(event: 'ready', callback: (data: ReadyData) => void): void
    addListener(event: 'not_ready', callback: (data: NotReadyData) => void): void
    addListener(
      event: 'player_state_changed',
      callback: (state: PlaybackState | null) => void
    ): void
    addListener(
      event: 'initialization_error' | 'authentication_error' | 'account_error' | 'playback_error',
      callback: (error: Error) => void
    ): void
    removeListener(event: string, callback?: (data: any) => void): void
    getCurrentState(): Promise<PlaybackState | null>
    setName(name: string): Promise<void>
    getVolume(): Promise<number>
    setVolume(volume: number): Promise<void>
    pause(): Promise<void>
    resume(): Promise<void>
    togglePlay(): Promise<void>
    seek(position_ms: number): Promise<void>
    previousTrack(): Promise<void>
    nextTrack(): Promise<void>
  }

  interface PlayerOptions {
    name: string
    getOAuthToken: (callback: (token: string) => void) => void
    volume?: number
  }

  interface ReadyData {
    device_id: string
  }

  interface NotReadyData {
    device_id: string
  }

  interface Error {
    message: string
  }

  interface PlaybackState {
    context: {
      uri: string
      metadata: any
    }
    disallows: {
      pausing: boolean
      peeking_next: boolean
      peeking_prev: boolean
      resuming: boolean
      seeking: boolean
      skipping_next: boolean
      skipping_prev: boolean
    }
    paused: boolean
    position: number
    repeat_mode: number
    shuffle: boolean
    track_window: {
      current_track: Track
      previous_tracks: Track[]
      next_tracks: Track[]
    }
  }

  interface Track {
    uri: string
    id: string
    type: string
    media_type: string
    name: string
    is_playable: boolean
    album: {
      uri: string
      name: string
      images: Image[]
    }
    artists: Artist[]
    duration_ms: number
  }

  interface Image {
    url: string
    height: number | null
    width: number | null
  }

  interface Artist {
    uri: string
    name: string
  }
}

export {}
