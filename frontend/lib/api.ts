import axios, { AxiosInstance, AxiosError } from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

class ApiClient {
  private client: AxiosInstance

  constructor() {
    this.client = axios.create({
      baseURL: API_URL,
      headers: {
        'Content-Type': 'application/json',
      },
      withCredentials: true,
    })

    // Request interceptor to add auth token
    this.client.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('access_token')
        if (token) {
          config.headers.Authorization = `Bearer ${token}`
        }
        return config
      },
      (error) => Promise.reject(error)
    )

    // Response interceptor to handle errors
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response?.status === 401) {
          localStorage.removeItem('access_token')
          window.location.href = '/'
        }
        return Promise.reject(error)
      }
    )
  }

  // Auth methods
  async getCurrentUser() {
    const token = localStorage.getItem('access_token')
    const response = await this.client.get(`/api/auth/me?access_token=${token}`)
    return response.data
  }

  // Session methods
  async getSession(sessionId: string) {
    const response = await this.client.get(`/api/queue/session/${sessionId}`)
    return response.data
  }

  // Song methods
  async searchSongs(query: string, limit: number = 10) {
    const response = await this.client.get('/api/spotify/search', {
      params: { q: query, limit },
    })
    return response.data
  }

  async getSongLyrics(spotifyId: string) {
    const response = await this.client.get(`/api/lyrics/song/${spotifyId}`)
    const data = response.data

    // Transform backend LyricsResponse into the flat Lyrics format the frontend expects
    if (data?.original_lyrics?.lines) {
      const lines = data.original_lyrics.lines.map((line: any, i: number) => {
        const romanizedLine = data.romanized_lyrics?.lines?.[i]
        return {
          time_ms: line.time_ms ?? Math.round(line.start_time * 1000),
          text: line.text,
          romanized_text: romanizedLine?.text || line.romanized_text || undefined,
        }
      })

      return {
        id: data.song_id,
        song_id: data.song_id,
        source: data.original_lyrics.source || 'lrclib',
        language: data.detected_language,
        synced: data.original_lyrics.synced ?? false,
        lines,
        created_at: new Date().toISOString(),
      }
    }

    return data
  }

  // Queue methods
  async addToQueue(sessionId: string, spotifyId: string) {
    const userId = localStorage.getItem('user_id')
    const response = await this.client.post(`/api/queue/add?user_id=${userId}`, {
      song_id: spotifyId,
      session_id: sessionId,
    })
    return response.data
  }

  async getQueue(sessionId: string) {
    const response = await this.client.get(`/api/queue/${sessionId}/list`)
    return response.data
  }

  async removeFromQueue(sessionId: string, queueItemId: string) {
    const userId = localStorage.getItem('user_id')
    const response = await this.client.delete(
      `/api/queue/${queueItemId}?user_id=${userId}`
    )
    return response.data
  }

  async reorderQueue(sessionId: string, queueItemId: string, newPosition: number) {
    const response = await this.client.post(
      `/api/queue/${sessionId}/reorder?queue_item_id=${queueItemId}&new_position=${newPosition}`
    )
    return response.data
  }

  // Playback methods
  private async _ensureDevice(deviceId: string) {
    const token = localStorage.getItem('access_token')
    if (!token) return
    const headers = { Authorization: `Bearer ${token}` }

    // Transfer playback to this device so Spotify recognizes it
    await axios.put(
      'https://api.spotify.com/v1/me/player',
      { device_ids: [deviceId], play: false },
      { headers }
    )
    // Brief wait for Spotify to register the transfer
    await new Promise((r) => setTimeout(r, 300))
  }

  async startPlayback(spotifyUri: string, deviceId?: string | null) {
    const token = localStorage.getItem('access_token')
    if (!token) throw new Error('No access token')
    const headers = { Authorization: `Bearer ${token}` }
    const body = { uris: [spotifyUri] }

    if (deviceId) {
      // Ensure the device is active first
      await this._ensureDevice(deviceId)

      await axios.put(
        `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`,
        body, { headers }
      )
      return
    }

    // No SDK device — play on whatever device is currently active
    await axios.put(
      'https://api.spotify.com/v1/me/player/play',
      body, { headers }
    )
  }

  async pausePlayback() {
    const token = localStorage.getItem('access_token')
    if (!token) return
    const headers = { Authorization: `Bearer ${token}` }

    await axios.put(
      'https://api.spotify.com/v1/me/player/pause',
      {}, { headers }
    ).catch(() => {})
  }

  async resumePlayback(deviceId?: string | null) {
    const token = localStorage.getItem('access_token')
    if (!token) return
    const headers = { Authorization: `Bearer ${token}` }

    // Resume without sending uris — keeps current position
    const url = deviceId
      ? `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`
      : 'https://api.spotify.com/v1/me/player/play'

    await axios.put(url, {}, { headers })
  }

  async seekPlayback(positionMs: number) {
    const token = localStorage.getItem('access_token')
    if (!token) return

    await axios.put(
      `https://api.spotify.com/v1/me/player/seek?position_ms=${positionMs}`,
      {},
      { headers: { Authorization: `Bearer ${token}` } }
    ).catch(() => {})
  }

  async skipSong(sessionId: string) {
    const userId = localStorage.getItem('user_id')
    const response = await this.client.post(`/api/queue/${sessionId}/next?user_id=${userId}`)
    return response.data
  }

  async getPlaybackState(sessionId: string) {
    try {
      const current = await this.client.get(`/api/queue/${sessionId}/current`)
      if (!current?.data) return null
      return {
        session_id: sessionId,
        is_playing: false,
        position_ms: 0,
        current_song: current.data.song,
      }
    } catch {
      return null
    }
  }
}

export const api = new ApiClient()
export default api
