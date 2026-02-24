'use client'

import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function AuthCallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const accessToken = searchParams.get('access_token')
    const refreshToken = searchParams.get('refresh_token')
    const userId = searchParams.get('user_id')

    if (accessToken) {
      // Clear any guest state in this tab
      sessionStorage.clear()

      localStorage.setItem('access_token', accessToken)
      if (refreshToken) {
        localStorage.setItem('refresh_token', refreshToken)
      }
      if (userId) {
        localStorage.setItem('user_id', userId)
      }
      router.push('/dashboard')
    } else {
      // No token received, go back to login
      router.push('/')
    }
  }, [searchParams, router])

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-purple-600 to-blue-600">
      <div className="text-center space-y-4">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto" />
        <p className="text-xl text-white">Logging you in...</p>
      </div>
    </main>
  )
}

const LoadingScreen = () => (
  <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-purple-600 to-blue-600">
    <div className="text-center space-y-4">
      <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto" />
      <p className="text-xl text-white">Logging you in...</p>
    </div>
  </main>
)

export default function AuthCallback() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <AuthCallbackContent />
    </Suspense>
  )
}
