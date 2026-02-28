# Architecture Documentation

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                          │
├─────────────────────────────────────────────────────────────┤
│  Next.js 14 Frontend (TypeScript)                           │
│  - React Components                                          │
│  - Spotify Web Playback SDK (host browser)                  │
│  - Tailwind CSS Styling                                      │
│  - @dnd-kit drag-and-drop queue reordering                  │
└────────────────┬────────────────────────────────────────────┘
                 │ HTTPS/REST API
                 ▼
┌─────────────────────────────────────────────────────────────┐
│                     API LAYER                                │
├─────────────────────────────────────────────────────────────┤
│  Python FastAPI Backend                                      │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Routers                                              │   │
│  │  ├─ /api/auth         → Spotify OAuth + guest join   │   │
│  │  ├─ /api/spotify      → Song search                  │   │
│  │  ├─ /api/lyrics       → Lyrics fetching              │   │
│  │  ├─ /api/queue        → Queue + playback state       │   │
│  │  └─ /api/romanization → Language conversion          │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Services                                             │   │
│  │  ├─ SpotifyAuthService                               │   │
│  │  ├─ SpotifyService                                   │   │
│  │  ├─ LyricsService (LRCLIB API)                       │   │
│  │  ├─ RomanizationService (pypinyin, pykakasi)         │   │
│  │  └─ QueueService                                     │   │
│  └──────────────────────────────────────────────────────┘   │
│  Background: session cleanup task (every 5 min)              │
└────────┬───────────┬──────────────────────────────────┬─────┘
         │           │                                  │
         ▼           ▼                                  ▼
┌─────────────┐ ┌──────────────┐              ┌─────────────┐
│  Supabase   │ │ Spotify API  │              │ LRCLIB API  │
│  PostgreSQL │ │              │              │  (Lyrics)   │
│             │ │ - OAuth      │              │             │
│ - Users     │ │ - Search     │              │ - Synced    │
│ - Sessions  │ │ - Tracks     │              │ - Plain     │
│ - Queue     │ │              │              │             │
│ - Lyrics    │ └──────────────┘              └─────────────┘
│ - Playback  │
└─────────────┘
```

## Frontend Architecture

### Component Hierarchy

```
app/
├── layout.tsx              # Root Layout
├── page.tsx                # Login page (Spotify host or guest join)
├── auth/callback/
│   └── page.tsx            # OAuth callback — stores tokens, redirects
├── dashboard/
│   └── page.tsx            # Create or join a session
└── player/[sessionId]/
    └── page.tsx            # Main player page
        ├── <LandscapePrompt />     # Mobile: rotate to landscape hint
        ├── <NowPlaying />
        ├── <LyricsDisplay />       ⭐ Core Feature
        ├── <PlayerControls />
        ├── <QueueSidebar />        # With drag-and-drop reordering
        └── <SongSearch />

components/
├── LandscapePrompt.tsx  → Mobile landscape orientation banner
├── LyricsDisplay.tsx    → Time-synced lyrics highlighting
├── NowPlaying.tsx       → Album art & song info
├── PlayerControls.tsx   → Play/pause/skip/volume/seek
├── QueueSidebar.tsx     → Queue management with dnd-kit reorder
└── SongSearch.tsx       → Spotify search

hooks/
├── useSpotifyPlayer.ts     → Spotify SDK integration
├── useRealtimeQueue.ts     → Queue polling/sync
└── useRealtimeSession.ts   → Session state sync

lib/
├── api.ts                  → Backend + Spotify API client
└── utils.ts                → Utility functions

types/
├── index.ts                → TypeScript definitions
└── spotify.d.ts            → Spotify SDK types
```

### User Flows

**Host flow:**
1. Login page → Spotify OAuth
2. OAuth callback (`/auth/callback`) → stores `access_token`, `refresh_token`, `user_id` in `localStorage` → redirects to `/dashboard`
3. Dashboard → create session (generates 6-char code) or join existing
4. Player page → Spotify SDK loads in browser, host controls playback

**Guest flow:**
1. Login page → enter display name + 6-char session code → `POST /api/auth/guest-join`
2. Guest `user_id` and `session_id` stored in `sessionStorage` (tab-isolated, doesn't clobber host's `localStorage`)
3. Directly to `/player/[sessionId]` — no Spotify account needed
4. Lyrics sync via polling `GET /{sessionId}/playback-state` every ~1s

### Data Flow

```
Host playback → Spotify SDK position_ms → PUT /playback-state (every ~1s)
                                                    ↓ (stored in DB)
Guest polls GET /playback-state → reads position_ms → highlights lyrics
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
- OAuth 2.0 authorization code flow
- Token exchange and refresh
- User profile fetch

**LyricsService**
- LRCLIB API integration
- LRC format parsing
- Language detection
- DB caching

**RomanizationService**
- Chinese → Pinyin (pypinyin)
- Japanese → Romaji (pykakasi)
- Korean → Romanization (hangul-romanize)

**QueueService**
- Session management (create, join, cleanup)
- Queue CRUD + reorder (single item and batch)
- Playback state store/retrieve (in-memory dict, fast)
- Host Spotify token retrieval for guest song additions

### Background Tasks

- **Session cleanup**: runs every 5 minutes, marks inactive sessions as `is_active=false`

## Database Schema

### Tables

**users**
- id (UUID, PK)
- spotify_id (unique) — for guests: `guest_<random12hex>`
- display_name
- email
- image_url
- is_guest (boolean) — true for guest users
- created_at, updated_at

**sessions**
- id (UUID, PK)
- name
- host_id (FK → users)
- is_active
- code (VARCHAR 6, unique) — shareable join code, e.g. `"AB12CD"`
- host_refresh_token — stored so guests can use the host's Spotify token
- last_activity_at — used for inactivity cleanup
- lyrics_display_mode
- created_at, updated_at

**queue_items**
- id (UUID, PK)
- session_id (FK → sessions)
- song_id, song_name, artist_name, album_name
- duration_ms
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
- UNIQUE(session_id, user_id)

**lyrics_cache**
- id (UUID, PK)
- song_id (unique)
- song_name, artist_name
- original_lyrics (JSONB)
- romanized_lyrics (JSONB)
- language, synced, source
- created_at, updated_at

**playback_state**
- session_id (UUID, PK, FK → sessions)
- is_playing (boolean)
- position_ms (integer)
- song_id (VARCHAR)
- countdown (integer, nullable) — 5..1 for pre-song countdown
- updated_at

### Relationships

```
users (1) ──< (N) sessions (host)
users (1) ──< (N) queue_items (added_by)
sessions (1) ──< (N) queue_items
sessions (1) ──< (N) session_participants
users (1) ──< (N) session_participants
sessions (1) ──< (1) playback_state
```

## Critical Features

### 1. Synchronized Lyrics Highlighting

**Host side:**
```typescript
// Spotify SDK provides position every second
player.addListener('player_state_changed', (state) => {
  setPosition(state.position)
})

// Highlight current line
const currentLine = lyrics.lines.find(line =>
  position >= line.time_ms && position < nextLine.time_ms
)
```

**Guest sync:**
```
Host browser → PUT /playback-state { position_ms, is_playing, song_id }
                             ↓ (DB upsert)
Guest polls GET /playback-state every ~1s → uses position_ms for highlighting
```

### 2. Guest Join Without Spotify

Guests get a full session experience without a Spotify account:
- They can browse the queue, see lyrics, and add songs
- Songs are added using the host's stored Spotify refresh token
- Guest state is stored in `sessionStorage` so the host can be in the same browser without conflict

### 3. Language Detection & Romanization

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

### 4. Queue Reordering

The host can drag queue items to reorder them. The frontend sends a batch reorder request with the full ordered list of item IDs, which updates all `position` values in the DB in a single operation.

## Security

### Authentication
- Spotify OAuth 2.0 (hosts)
- Guest tokens are ephemeral UUIDs with no Spotify scopes
- JWT not currently used for session validation (token passed directly to Spotify API)
- Row Level Security (RLS) in Supabase

### Authorization
- Queue item deletion checks `added_by` matches requesting user
- Session hosts have additional permissions (playback control, skip)

## Performance

### Frontend
- Debounced search (300ms)
- Image optimization (Next.js)
- Client-side caching

### Backend
- Lyrics cached in DB after first fetch
- Playback state stored in memory (Python dict) — fast reads for frequent guest polling
- Async operations throughout

### Database
- Indexed foreign keys and frequently queried columns

## API Endpoints

### Authentication
- `GET /api/auth/login` - Redirect to Spotify auth
- `GET /api/auth/callback` - OAuth callback; redirects to frontend with tokens
- `POST /api/auth/refresh` - Refresh Spotify access token
- `GET /api/auth/me` - Get current user (requires `Authorization: Bearer <token>`)
- `POST /api/auth/guest-join` - Join session as guest (no Spotify needed)

### Spotify
- `GET /api/spotify/search?q={query}` - Search songs

### Lyrics
- `GET /api/lyrics/song/{id}` - Get lyrics (fetches + caches on first call)

### Queue
- `POST /api/queue/session/create` - Create session
- `POST /api/queue/session/join` - Join session by ID
- `GET /api/queue/session/{id}` - Get session details
- `POST /api/queue/add` - Add song to queue
- `GET /api/queue/{sessionId}/list` - Get queue
- `DELETE /api/queue/{itemId}` - Remove from queue
- `POST /api/queue/{sessionId}/reorder` - Move one item to new position
- `POST /api/queue/{sessionId}/reorder-batch` - Reorder all items at once
- `POST /api/queue/{sessionId}/next` - Advance to next song
- `GET /api/queue/{sessionId}/current` - Get currently playing song
- `PUT /api/queue/{sessionId}/playback-state` - Host updates playback position
- `GET /api/queue/{sessionId}/playback-state` - Guests poll playback position

### Romanization
- `POST /api/romanization/convert` - Romanize text
- `POST /api/romanization/detect-and-convert` - Auto-detect & romanize

## Deployment Architecture

```
┌──────────────────────────────────────────────────┐
│              Vercel Edge Network                  │
│         (Frontend - Next.js)                      │
└──────────────────────────────────────────────────┘
                      ↓ REST API
┌──────────────────────────────────────────────────┐
│             Render Cloud                          │
│         (Backend - FastAPI)                       │
│              ↓ SQL                                │
│         Supabase Cloud                            │
│         (PostgreSQL Database)                     │
└──────────────────────────────────────────────────┘
```

A `render.yaml` is included in `backend/` for one-click Render deploys.

## Development Workflow

1. **Local Development**
   - Backend: `python -m app.main` (port 8000)
   - Frontend: `npm run dev` (port 3000)
   - Database: Supabase cloud

2. **API Docs**
   - Swagger UI: `http://localhost:8000/docs`

3. **Deployment**
   - Push to GitHub → Vercel auto-deploys frontend
   - Push to GitHub → Render auto-deploys backend

---

Architecture designed for:
- Simplicity (easy to understand and maintain)
- Cost-effectiveness (free tier friendly)
- Fast iteration
- Smooth user experience for both hosts and guests
