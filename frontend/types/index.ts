// User types
export interface User {
  id: string
  spotify_id: string
  display_name: string
  email: string
  profile_image_url?: string
  is_guest?: boolean
  created_at: string
}

// Session types
export interface Session {
  id: string
  name: string
  code: string
  host_id: string
  is_active: boolean
  current_song?: Song | null
  created_at: string
  lyrics_display_mode?: string
}

export interface SessionWithHost extends Session {
  host: User
}

// Song types
export interface Song {
  id: string
  name: string
  artist: string
  album?: string
  duration_ms: number
  spotify_uri?: string
  image_url?: string
}

export interface SpotifyTrack {
  id: string
  name: string
  artists: Array<{ name: string }>
  album: {
    name: string
    images: Array<{ url: string; height: number; width: number }>
  }
  duration_ms: number
  preview_url?: string
}

// Lyrics types
export interface LyricsLine {
  time_ms: number
  text: string
  romanized_text?: string
}

export interface Lyrics {
  id: string
  song_id: string
  source: 'lrclib' | 'manual'
  language?: string
  synced: boolean
  lines: LyricsLine[]
  created_at: string
}

// Queue types
export interface QueueItem {
  id: string
  song: Song
  added_by: string
  added_by_name?: string
  added_at: string
  position: number
}

export interface QueueItemWithDetails extends QueueItem {}

// Playback types
export interface PlaybackState {
  session_id: string
  current_song_id?: string
  is_playing: boolean
  position_ms: number
  updated_at?: string
}

export interface PlaybackStateWithDetails extends PlaybackState {
  current_song?: Song
  lyrics?: Lyrics
}

// API Response types
export interface ApiResponse<T> {
  data: T
  message?: string
}

export interface ApiError {
  error: string
  detail?: string
  status_code: number
}

// WebSocket message types
export type WebSocketMessageType =
  | 'session_update'
  | 'queue_update'
  | 'playback_update'
  | 'user_joined'
  | 'user_left'
  | 'error'

export interface WebSocketMessage<T = any> {
  type: WebSocketMessageType
  data: T
  timestamp: string
}

// Form types
export interface LoginFormData {
  code: string
}

export interface CreateSessionFormData {
  name?: string
}

export interface JoinSessionFormData {
  code: string
}

export interface SearchFormData {
  query: string
}

// Component prop types
export interface BaseComponentProps {
  className?: string
  children?: React.ReactNode
}
