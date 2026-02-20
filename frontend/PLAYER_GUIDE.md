# Karaoke Player UI - Implementation Guide

## Overview
The karaoke player UI has been fully implemented with all requested features including synchronized lyrics highlighting, Spotify playback integration, queue management, and song search.

## Components Created

### 1. **NowPlaying Component** (`/components/NowPlaying.tsx`)
- Displays large album art with gradient effects
- Shows song title, artist, and album information
- Animated "Now Playing" indicator
- Responsive design optimized for karaoke displays

### 2. **LyricsDisplay Component** (`/components/LyricsDisplay.tsx`) ⭐ CRITICAL
- **Line-level synchronized highlighting** based on playback time
- Three display modes:
  - Original lyrics only
  - Romanized lyrics only
  - Both side-by-side
- Auto-scrolling to current line
- Large, readable typography (3xl-5xl font sizes)
- High contrast gradient text for current line
- Smooth transitions and animations
- Empty state when no lyrics available

### 3. **PlayerControls Component** (`/components/PlayerControls.tsx`)
- Play/Pause button with gradient styling
- Skip to next song button
- Volume slider (0-100%)
- Progress bar with seek functionality
- Time display (current/total)
- Custom styled range inputs

### 4. **QueueSidebar Component** (`/components/QueueSidebar.tsx`)
- List of upcoming songs with album art
- Currently playing indicator
- Remove button for each song
- Reorder buttons (up/down)
- Shows song duration and who added it
- Hover effects and smooth transitions
- Empty state when queue is empty

### 5. **SongSearch Component** (`/components/SongSearch.tsx`)
- Search input with debounced Spotify search (500ms delay)
- Display search results as cards
- Album art thumbnails
- Add to queue button
- Loading states with spinner
- Empty states for no results and no query
- Error handling

### 6. **Player Page** (`/app/player/[sessionId]/page.tsx`)
- Main karaoke interface integrating all components
- Spotify Web Playback SDK integration
- Real-time queue and playback state updates
- Lyrics fetching from backend API
- Toggleable sidebar (search/queue)
- Display mode toggle (original/romanized/both)
- Session code display
- Full-screen gradient background
- Error and loading states

### 7. **useSpotifyPlayer Hook** (`/hooks/useSpotifyPlayer.ts`)
- Manages Spotify Web Playback SDK lifecycle
- Loads and initializes the player
- Tracks playback position in real-time
- Provides player controls (play, pause, skip, seek, volume)
- Error handling for player issues
- Device ID management

## Key Features Implemented

### ✅ Synchronized Lyrics Highlighting
- **Line-level highlighting** that follows the music in real-time
- Uses `currentTimeMs` from Spotify playback to determine active line
- Auto-scrolls to keep current line centered
- Past lines fade out, current line highlighted with gradient
- Smooth transitions between lines

### ✅ Spotify Integration
- Full Spotify Web Playback SDK integration
- Play/pause control
- Skip tracks
- Volume control (0-100%)
- Seek to position
- Real-time position tracking

### ✅ Queue Management
- View all queued songs
- Remove songs from queue
- Reorder songs (move up/down)
- See who added each song
- Visual indicator for currently playing song

### ✅ Song Search
- Real-time Spotify search with debouncing
- Album art previews
- Add songs to queue
- Loading and error states

### ✅ Professional Design
- Dark theme optimized for karaoke
- Purple/pink gradient color scheme
- Large, readable fonts for lyrics (TV-friendly)
- Smooth animations and transitions
- High contrast for visibility from distance
- No "AI slop" - intentional, professional design

### ✅ Responsive Layout
- Toggleable sidebar for search/queue
- Full-screen player area
- Adapts to different screen sizes
- Optimized for both desktop and TV displays

## Usage

### Access the Player
Navigate to `/player/[sessionId]` where `sessionId` is your karaoke session ID.

### Display Modes
Toggle between three lyrics display modes:
- **Original**: Shows lyrics in original language
- **Romanized**: Shows romanized version (for CJK languages)
- **Both**: Shows both original and romanized side-by-side

### Controls
- **Play/Pause**: Large center button
- **Skip**: Button next to play/pause
- **Volume**: Slider at bottom of controls
- **Progress**: Click/drag on progress bar to seek
- **Search**: Click search icon in header
- **Queue**: Click queue icon in header

### Adding Songs
1. Click the search icon in the header
2. Type song name or artist
3. Click "Add" on any result
4. Song appears in queue
5. Toggle to queue view to see it

### Managing Queue
1. Click queue icon in header
2. Remove songs with X button
3. Reorder with up/down arrows
4. Currently playing song is highlighted

## Technical Details

### API Integration
- Uses `/lib/api.ts` for all backend calls
- Fetches session, queue, playback state, and lyrics
- Updates every 2-5 seconds for real-time sync

### Type Safety
- All components use TypeScript with proper types from `/types/index.ts`
- Spotify SDK types in `/types/spotify.d.ts`

### Performance
- Debounced search to reduce API calls
- Polling intervals optimized (2s for playback, 5s for queue)
- Smooth scrolling with CSS transitions
- Efficient re-renders with React hooks

### Styling
- Tailwind CSS for all styling
- Custom CSS in `globals.css` for range inputs and animations
- Gradient backgrounds and effects
- No external UI libraries - pure Tailwind + custom CSS

## Future Enhancements (Optional)

- WebSocket integration for real-time updates (instead of polling)
- Drag-and-drop queue reordering
- Fullscreen mode toggle
- Karaoke scoring system
- Multi-user avatars
- Custom background themes
- Pitch/key adjustment
- Lyrics karaoke-style animation (word-by-word)

## File Structure
```
frontend/
├── app/
│   ├── player/
│   │   └── [sessionId]/
│   │       └── page.tsx          # Main player page
│   ├── layout.tsx                 # Root layout with Spotify SDK
│   └── globals.css                # Global styles
├── components/
│   ├── LyricsDisplay.tsx          # Synchronized lyrics
│   ├── NowPlaying.tsx             # Album art & song info
│   ├── PlayerControls.tsx         # Playback controls
│   ├── QueueSidebar.tsx           # Queue management
│   └── SongSearch.tsx             # Song search
├── hooks/
│   └── useSpotifyPlayer.ts        # Spotify SDK hook
├── lib/
│   ├── api.ts                     # API client
│   └── utils.ts                   # Utilities
└── types/
    ├── index.ts                   # App types
    └── spotify.d.ts               # Spotify SDK types
```

## Dependencies Used
- Next.js 14 (App Router)
- React 18
- TypeScript
- Tailwind CSS
- Axios (API calls)
- Spotify Web Playback SDK (loaded via CDN)

## Notes
- Requires valid Spotify Premium account for playback
- Access token must be stored in localStorage
- Backend API must be running at NEXT_PUBLIC_API_URL
- Lyrics syncing depends on accurate timestamps from LRCLIB
