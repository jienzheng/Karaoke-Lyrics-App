import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Karaoke Player',
  description: 'Multiplayer karaoke application with Spotify integration',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <script src="https://sdk.scdn.co/spotify-player.js" async></script>
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  )
}
