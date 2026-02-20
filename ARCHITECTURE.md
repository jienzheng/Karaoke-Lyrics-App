# 🏗️ Architecture Documentation

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                          │
├─────────────────────────────────────────────────────────────┤
│  Next.js 14 Frontend (TypeScript)                           │
│  - React Components                                          │
│  - Spotify Web Playback SDK                                  │
│  - Real-time UI Updates (Polling)                            │
│  - Tailwind CSS Styling                                      │
└────────────────┬────────────────────────────────────────────┘
                 │ HTTPS/REST API
                 ▼
┌─────────────────────────────────────────────────────────────┐
│                     API LAYER                                │
├─────────────────────────────────────────────────────────────┤
│  Python FastAPI Backend                                      │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Routers                                              │   │
│  │  ├─ /api/auth      → Spotify OAuth                   │   │
│  │  ├─ /api/spotify   → Song search                     │   │
│  │  ├─ /api/lyrics    → Lyrics fetching                 │   │
│  │  ├─ /api/queue     → Queue management                │   │
│  │  └─ /api/romanization → Language conversion          │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Services                                             │   │
│  │  ├─ SpotifyAuthService                               │   │
│  │  ├─ SpotifyService                                   │   │
│  │  ├─ LyricsService (LRCLIB API)                       │   │
│  │  ├─ RomanizationService (pypinyin, pykakasi)        │   │
│  │  └─ QueueService                                     │   │
│  └──────────────────────────────────────────────────────┘   │
└────────┬───────────┬──────────────────────────────────┬─────┘
         │           │                                  │
         │           │                                  │
         ▼           ▼                                  ▼
┌─────────────┐ ┌──────────────┐              ┌─────────────┐
│  Supabase   │ │ Spotify API  │              │ LRCLIB API  │
│  PostgreSQL │ │              │              │  (Lyrics)   │
│             │ │ - OAuth      │              │             │
│ - Users     │ │ - Search     │              │ - Synced    │
│ - Sessions  │ │ - Tracks     │              │ - Plain     │
│ - Queue     │ │ - Playback   │              │             │
│ - Lyrics    │ │              │              │             │
└─────────────┘ └──────────────┘              └─────────────┘
```

## Frontend Architecture

### Component Hierarchy

```
app/
├── layout.tsx (Root Layout)
├── page.tsx (Login Page)
│
├── player/[sessionId]/
│   └── page.tsx (Main Player Page)
│       ├── <NowPlaying />
│       ├── <LyricsDisplay />          ⭐ Core Feature
│       ├── <PlayerControls />
│       ├── <QueueSidebar />
│       └── <SongSearch />
│
components/
├── LyricsDisplay.tsx       → Line-level synchronized lyrics
├── NowPlaying.tsx          → Album art & song info
├── PlayerControls.tsx      → Play/pause/skip/volume
├── QueueSidebar.tsx        → Queue management
└── SongSearch.tsx          → Spotify search

hooks/
├── useSpotifyPlayer.ts     → Spotify SDK integration
├── useRealtimeQueue.ts     → Queue synchronization
└── useRealtimeSession.ts   → Session synchronization

lib/
├── api.ts                  → Backend API client
└── utils.ts                → Utility functions

types/
├── index.ts                → TypeScript definitions
└── spotify.d.ts            → Spotify SDK types
```

### Data Flow

```
User Action → Component → API Call → Backend → Database
                ↓
         Update UI State
                ↓
    Real-time Sync (Polling)
                ↓
         Update All Clients
```

## Backend Architecture

### Service Layer Pattern

```
Router → Service → External API / Database
   ↓        ↓            ↓
Request   Logic    Data Source
   ↓        ↓            ↓
Response  Result     Data
```

### Key Services

**SpotifyAuthService**
- OAuth 2.0 flow
- Token management
- Token refresh

**LyricsService**
- LRCLIB API integration
- LRC format parsing
- Language detection
- Caching

**RomanizationService**
- Chinese → Pinyin (pypinyin)
- Japanese → Romaji (pykakasi)
- Korean → Romanization (hangul-romanize)

**QueueService**
- Session management
- Queue CRUD operations
- Position management
- Current song tracking

## Database Schema

### Tables

**users**
- id (UUID, PK)
- spotify_id (unique)
- display_name
- email
- image_url
- created_at, updated_at

**sessions**
- id (UUID, PK)
- name
- host_id (FK → users)
- is_active
- lyrics_display_mode
- created_at, updated_at

**queue_items**
- id (UUID, PK)
- session_id (FK → sessions)
- song_id, song_name, artist_name
- spotify_uri, image_url
- added_by (FK → users)
- position (ordered)
- is_playing (boolean)
- created_at

**session_participants**
- id (UUID, PK)
- session_id (FK → sessions)
- user_id (FK → users)
- joined_at

**lyrics_cache**
- id (UUID, PK)
- song_id (unique)
- original_lyrics (JSONB)
- romanized_lyrics (JSONB)
- language, synced, source
- created_at, updated_at

### Relationships

```
users (1) ──< (N) sessions (host)
users (1) ──< (N) queue_items (added_by)
sessions (1) ──< (N) queue_items
sessions (1) ──< (N) session_participants
users (1) ──< (N) session_participants
```

## Critical Features

### 1. Synchronized Lyrics Highlighting ⭐

**Implementation:**
```typescript
// Track playback position
const [position, setPosition] = useState(0);

// Update every second
useEffect(() => {
  const interval = setInterval(() => {
    player?.getCurrentState().then(state => {
      setPosition(state?.position || 0);
    });
  }, 1000);
}, [player]);

// Highlight current line
const currentLine = lyrics.lines.find(line =>
  position >= line.start_time && position < line.end_time
);
```

**Timing Flow:**
1. Spotify SDK provides position_ms
2. Convert to seconds
3. Match against lyric line timestamps
4. Apply highlight class to current line
5. Auto-scroll to keep visible

### 2. Multi-user Real-time Sync

**Implementation:**
- Polling every 2-3 seconds
- Compare queue state
- Emit change events
- Update UI reactively

### 3. Language Detection & Romanization

**Process:**
```
Original Text
     ↓
Detect Language (Unicode ranges)
     ↓
Chinese? → pypinyin → Pinyin
Japanese? → pykakasi → Romaji
Korean? → hangul-romanize → Romanization
     ↓
Display Both Versions
```

## Security

### Authentication
- Spotify OAuth 2.0
- JWT for session management
- Row Level Security (RLS) in Supabase

### Authorization
- Users can only modify their own queue items
- Session hosts have additional permissions
- RLS policies enforce access control

## Performance Optimizations

### Frontend
- Debounced search (300ms)
- Lazy loading components
- Image optimization (Next.js)
- Client-side caching

### Backend
- Lyrics caching in database
- Connection pooling
- Async operations

### Database
- Indexed foreign keys
- Indexed frequently queried columns
- Efficient queries with proper JOINs

## Scalability Considerations

### Current Architecture
- Supports: ~100 concurrent sessions
- Polling interval: 2-3 seconds
- Database: Free tier (up to 500 MB)

### Future Improvements
- WebSocket for real-time updates
- Redis for caching
- CDN for static assets
- Database read replicas
- Horizontal scaling with load balancer

## Technology Stack

| Layer | Technology | Why? |
|-------|-----------|------|
| Frontend Framework | Next.js 14 | SSR, App Router, great DX |
| UI Styling | Tailwind CSS | Rapid development, customizable |
| Language | TypeScript | Type safety, better IDE support |
| Backend Framework | FastAPI | Fast, async, automatic docs |
| Language | Python 3.9+ | Rich ecosystem, easy romanization libs |
| Database | Supabase (PostgreSQL) | Free tier, real-time, managed |
| Auth | Spotify OAuth | Required for Spotify API access |
| Lyrics | LRCLIB API | Free, time-synced lyrics |
| Audio Playback | Spotify Web Playback SDK | Official, reliable |
| Deployment (Frontend) | Vercel | Optimized for Next.js |
| Deployment (Backend) | Railway | Easy Python deployment, free tier |

## API Endpoints

### Authentication
- `GET /api/auth/login` - Get Spotify auth URL
- `GET /api/auth/callback` - OAuth callback
- `POST /api/auth/refresh` - Refresh token
- `GET /api/auth/me` - Get current user

### Spotify
- `GET /api/spotify/search?q={query}` - Search songs
- `GET /api/spotify/track/{id}` - Get track details

### Lyrics
- `POST /api/lyrics/fetch` - Fetch lyrics
- `GET /api/lyrics/song/{id}` - Get cached lyrics

### Queue
- `POST /api/queue/session/create` - Create session
- `POST /api/queue/session/join` - Join session
- `GET /api/queue/session/{id}` - Get session
- `POST /api/queue/add` - Add to queue
- `GET /api/queue/{sessionId}/list` - Get queue
- `DELETE /api/queue/{itemId}` - Remove from queue
- `POST /api/queue/{sessionId}/next` - Play next
- `GET /api/queue/{sessionId}/current` - Get current song

### Romanization
- `POST /api/romanization/convert` - Romanize text
- `POST /api/romanization/detect-and-convert` - Auto-detect & romanize

## Deployment Architecture

```
┌──────────────────────────────────────────────────┐
│              Vercel Edge Network                  │
│         (Frontend - Next.js Static)               │
│              ↓ HTTPS                              │
│         Users' Browsers                           │
└──────────────────────────────────────────────────┘
                      ↓ REST API
┌──────────────────────────────────────────────────┐
│            Railway Cloud                          │
│         (Backend - FastAPI)                       │
│              ↓ SQL                                │
│         Supabase Cloud                            │
│         (PostgreSQL Database)                     │
└──────────────────────────────────────────────────┘
```

## Development Workflow

1. **Local Development**
   - Backend: `python -m app.main` (port 8000)
   - Frontend: `npm run dev` (port 3000)
   - Database: Supabase cloud (or local with Docker)

2. **Testing**
   - Manual testing in browser
   - Check API docs at `/docs`

3. **Deployment**
   - Push to GitHub
   - Vercel auto-deploys frontend
   - Railway auto-deploys backend
   - No downtime deployments

---

This architecture is designed for:
- ✅ Simplicity (easy to understand and maintain)
- ✅ Scalability (can grow with usage)
- ✅ Cost-effectiveness (free tier friendly)
- ✅ Developer experience (fast iteration)
- ✅ User experience (smooth, responsive)
