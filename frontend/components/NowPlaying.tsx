'use client'

import { Song } from '@/types'
import Image from 'next/image'

interface NowPlayingProps {
  song: Song
  isPlaying: boolean
}

export default function NowPlaying({ song, isPlaying }: NowPlayingProps) {
  return (
    <div className="relative w-full">
      {/* Background gradient based on album art */}
      <div className="absolute inset-0 bg-gradient-to-b from-purple-900/20 via-transparent to-transparent" />

      <div className="relative flex flex-col items-center space-y-6 py-8">
        {/* Album Art */}
        <div className="relative group">
          <div className={`absolute inset-0 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl blur-xl opacity-50 ${isPlaying ? 'animate-pulse' : ''}`} />
          <div className="relative w-64 h-64 md:w-80 md:h-80 rounded-2xl overflow-hidden shadow-2xl border-4 border-white/10">
            {song.album_art_url ? (
              <Image
                src={song.album_art_url}
                alt={`${song.title} album art`}
                fill
                className="object-cover"
                priority
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center">
                <svg
                  className="w-32 h-32 text-white/50"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                  />
                </svg>
              </div>
            )}
          </div>
        </div>

        {/* Song Info */}
        <div className="text-center space-y-2 max-w-2xl px-4">
          <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight">
            {song.title}
          </h1>
          <p className="text-2xl md:text-3xl text-gray-300 font-medium">
            {song.artist}
          </p>
          <p className="text-lg text-gray-400">
            {song.album}
          </p>
        </div>

        {/* Playing Indicator */}
        {isPlaying && (
          <div className="flex items-center space-x-2 text-green-400">
            <div className="flex space-x-1">
              <div className="w-1 h-4 bg-green-400 rounded-full animate-pulse" style={{ animationDelay: '0ms' }} />
              <div className="w-1 h-4 bg-green-400 rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
              <div className="w-1 h-4 bg-green-400 rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
            </div>
            <span className="text-sm font-medium">Now Playing</span>
          </div>
        )}
      </div>
    </div>
  )
}
