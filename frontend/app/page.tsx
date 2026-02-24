'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function Home() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [guestName, setGuestName] = useState('')
  const [sessionCode, setSessionCode] = useState('')
  const [isJoiningAsGuest, setIsJoiningAsGuest] = useState(false)
  const [guestError, setGuestError] = useState<string | null>(null)

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

  const handleSpotifyLogin = async () => {
    setIsLoading(true)
    // Clear any guest state in this tab before Spotify OAuth
    sessionStorage.clear()
    try {
      window.location.href = `${apiUrl}/api/auth/login`
    } catch (error) {
      console.error('Failed to initiate Spotify login:', error)
      setIsLoading(false)
    }
  }

  const handleGuestJoin = async () => {
    if (!guestName.trim() || !sessionCode.trim()) return
    setIsJoiningAsGuest(true)
    setGuestError(null)
    try {
      const res = await fetch(`${apiUrl}/api/auth/guest-join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          display_name: guestName.trim(),
          session_code: sessionCode.trim(),
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || 'Failed to join session')
      }
      const data = await res.json()
      // Store guest state in sessionStorage (per-tab) so it doesn't
      // clobber the host's localStorage in the same browser
      sessionStorage.setItem('user_id', data.user_id)
      sessionStorage.setItem('is_guest', 'true')
      router.push(`/player/${data.session_id}`)
    } catch (err: unknown) {
      setGuestError(err instanceof Error ? err.message : 'Failed to join session')
      setIsJoiningAsGuest(false)
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      <div className="max-w-md w-full space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            Karaoke Player
          </h1>
          <p className="text-gray-400 text-sm">
            Sing along with your favorite songs
          </p>
        </div>

        {/* Spotify Login Card */}
        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white">Host a Session</h2>
          <p className="text-sm text-gray-300">
            Sign in with Spotify Premium to create and host a karaoke session.
          </p>
          <button
            onClick={handleSpotifyLogin}
            disabled={isLoading}
            className="w-full bg-green-500 hover:bg-green-600 disabled:bg-gray-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <span>Loading...</span>
            ) : (
              <>
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                </svg>
                Login with Spotify
              </>
            )}
          </button>
        </div>

        {/* Divider */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/20" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-3 bg-gray-900 text-gray-500">or</span>
          </div>
        </div>

        {/* Guest Join Card */}
        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white">Join as Guest</h2>
          <p className="text-sm text-gray-300">
            Enter your name and a session code to join an existing session.
          </p>

          {guestError && (
            <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-red-200 text-center text-sm">
              {guestError}
            </div>
          )}

          <input
            type="text"
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            placeholder="Your display name"
            className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white text-center placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent"
          />
          <input
            type="text"
            value={sessionCode}
            onChange={(e) => setSessionCode(e.target.value.toUpperCase())}
            placeholder="Session code"
            maxLength={6}
            className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white text-center placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent"
          />
          <button
            onClick={handleGuestJoin}
            disabled={isJoiningAsGuest || !guestName.trim() || !sessionCode.trim()}
            className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
          >
            {isJoiningAsGuest ? 'Joining...' : 'Join as Guest'}
          </button>
        </div>
      </div>
    </main>
  )
}
