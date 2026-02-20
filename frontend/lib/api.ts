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
          // Handle unauthorized - redirect to login
          localStorage.removeItem('access_token')
          window.location.href = '/login'
        }
        return Promise.reject(error)
      }
    )
  }

  // Auth methods
  async login(code: string) {
    const response = await this.client.post('/auth/callback', { code })
    return response.data
  }

  async getCurrentUser() {
    const response = await this.client.get('/auth/me')
    return response.data
  }

  async logout() {
    const response = await this.client.post('/auth/logout')
    localStorage.removeItem('access_token')
    return response.data
  }

  // Session methods
  async createSession() {
    const response = await this.client.post('/sessions')
    return response.data
  }

  async getSession(sessionId: string) {
    const response = await this.client.get(`/sessions/${sessionId}`)
    return response.data
  }

  async joinSession(sessionId: string) {
    const response = await this.client.post(`/sessions/${sessionId}/join`)
    return response.data
  }

  // Song methods
  async searchSongs(query: string) {
    const response = await this.client.get('/songs/search', {
      params: { query },
    })
    return response.data
  }

  async getSongLyrics(spotifyId: string) {
    const response = await this.client.get(`/songs/${spotifyId}/lyrics`)
    return response.data
  }

  // Queue methods
  async addToQueue(sessionId: string, spotifyId: string) {
    const response = await this.client.post(`/sessions/${sessionId}/queue`, {
      spotify_id: spotifyId,
    })
    return response.data
  }

  async getQueue(sessionId: string) {
    const response = await this.client.get(`/sessions/${sessionId}/queue`)
    return response.data
  }

  async removeFromQueue(sessionId: string, queueItemId: string) {
    const response = await this.client.delete(
      `/sessions/${sessionId}/queue/${queueItemId}`
    )
    return response.data
  }

  async reorderQueue(sessionId: string, queueItemId: string, newPosition: number) {
    const response = await this.client.patch(
      `/sessions/${sessionId}/queue/${queueItemId}`,
      { position: newPosition }
    )
    return response.data
  }

  // Playback methods
  async startPlayback(sessionId: string) {
    const response = await this.client.post(`/sessions/${sessionId}/playback/start`)
    return response.data
  }

  async pausePlayback(sessionId: string) {
    const response = await this.client.post(`/sessions/${sessionId}/playback/pause`)
    return response.data
  }

  async skipSong(sessionId: string) {
    const response = await this.client.post(`/sessions/${sessionId}/playback/skip`)
    return response.data
  }

  async getPlaybackState(sessionId: string) {
    const response = await this.client.get(`/sessions/${sessionId}/playback`)
    return response.data
  }
}

export const api = new ApiClient()
export default api
