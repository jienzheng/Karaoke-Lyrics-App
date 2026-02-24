'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import api, { API_URL } from '@/lib/api'

export default function Dashboard() {
  const router = useRouter()
  const [user, setUser] = useState<{ display_name: string; image_url?: string } | null>(null)
  const [sessionName, setSessionName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [isJoining, setIsJoining] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const apiUrl = API_URL

  useEffect(() => {
    // Guests should not access the dashboard
    if (sessionStorage.getItem('is_guest') === 'true') {
      router.push('/')
      return
    }

    const token = localStorage.getItem('access_token')
    if (!token) {
      router.push('/')
      return
    }

    // Fetch user profile via api client (sends Authorization: Bearer header)
    api
      .getCurrentUser()
      .then((data) => setUser(data))
      .catch(() => {
        localStorage.removeItem('access_token')
        router.push('/')
      })
  }, [router])

  const handleCreateSession = async () => {
    setIsCreating(true)
    setError(null)
    try {
      const token = localStorage.getItem('access_token')
      const userId = localStorage.getItem('user_id')
      const refreshToken = localStorage.getItem('refresh_token')
      const res = await fetch(`${apiUrl}/api/queue/session/create?user_id=${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: sessionName || 'Karaoke Session',
          refresh_token: refreshToken || undefined,
        }),
      })
      if (!res.ok) throw new Error('Failed to create session')
      const session = await res.json()
      router.push(`/player/${session.id}`)
    } catch (err) {
      setError('Failed to create session. Please try again.')
      setIsCreating(false)
    }
  }

  const handleJoinSession = async () => {
    if (!joinCode.trim()) return
    setIsJoining(true)
    setError(null)
    try {
      const token = localStorage.getItem('access_token')
      const userId = localStorage.getItem('user_id')
      const res = await fetch(`${apiUrl}/api/queue/session/join?user_id=${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ session_id: joinCode.trim() }),
      })
      if (!res.ok) throw new Error('Session not found')
      const session = await res.json()
      router.push(`/player/${session.id}`)
    } catch (err) {
      setError('Session not found. Check the code and try again.')
      setIsJoining(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('user_id')
    sessionStorage.clear()
    router.push('/')
  }

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-500 mx-auto" />
          <p className="text-xl text-white">Loading...</p>
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      <div className="max-w-lg w-full space-y-6">
        {/* User Info */}
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            Karaoke Player
          </h1>
          <p className="text-gray-300">Welcome, {user.display_name}!</p>
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-red-200 text-center text-sm">
            {error}
          </div>
        )}

        {/* Create Session */}
        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 space-y-4">
          <h2 className="text-xl font-semibold text-white">Create a Session</h2>
          <input
            type="text"
            value={sessionName}
            onChange={(e) => setSessionName(e.target.value)}
            placeholder="Session name (optional)"
            className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-purple-500"
          />
          <button
            onClick={handleCreateSession}
            disabled={isCreating}
            className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white font-bold py-3 px-4 rounded-lg transition-colors"
          >
            {isCreating ? 'Creating...' : 'Create Session'}
          </button>
        </div>

        {/* Join Session */}
        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 space-y-4">
          <h2 className="text-xl font-semibold text-white">Join a Session</h2>
          <input
            type="text"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            placeholder="Enter session code"
            className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-purple-500"
          />
          <button
            onClick={handleJoinSession}
            disabled={isJoining || !joinCode.trim()}
            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-bold py-3 px-4 rounded-lg transition-colors"
          >
            {isJoining ? 'Joining...' : 'Join Session'}
          </button>
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full text-gray-400 hover:text-white py-2 transition-colors text-sm"
        >
          Logout
        </button>
      </div>
    </main>
  )
}
