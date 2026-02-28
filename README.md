# Karaoke Player

A web application for multilingual karaoke with real-time lyrics highlighting, romanization support for Asian languages, and Spotify integration.

## Features

- **Spotify Integration** - Host sessions with Spotify Premium; playback runs in the browser via the Spotify Web Playback SDK
- **Guest Join** - Anyone can join a session by entering a display name and 6-character session code — no Spotify account needed
- **Multilingual Support** - Chinese (Pinyin), Japanese (Romaji), Korean (Romanization)
- **Real-time Lyrics** - Time-synced lyrics highlighting synchronized with music playback
- **Guest Lyric Sync** - Guests see lyrics in real-time by polling the host's playback position
- **Multi-user Sessions** - Shared queue for party mode karaoke with drag-and-drop reordering
- **Playback Controls** - Volume, seek, skip, queue management

## Architecture

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│   Next.js       │ ──────> │  Python FastAPI  │ ──────> │   Supabase      │
│   Frontend      │  HTTP   │  Backend         │  SQL    │   PostgreSQL    │
│   (TypeScript)  │         │                  │         └─────────────────┘
└─────────────────┘         └──────────────────┘
     Vercel                        Render                     Cloud Database
                                     │
                                     ├──> Spotify API
                                     ├──> LRCLIB API
                                     └──> Romanization
```

## Project Structure

```
karaoke-player/
├── frontend/               # Next.js TypeScript frontend
│   ├── app/               # Next.js App Router pages
│   │   ├── auth/callback/ # OAuth callback handler
│   │   ├── dashboard/     # Session create/join page
│   │   └── player/[sessionId]/  # Main player page
│   ├── components/        # React components
│   ├── hooks/             # Custom hooks
│   ├── lib/               # API client and utilities
│   └── types/             # TypeScript types
│
├── backend/               # Python FastAPI backend
│   ├── app/
│   │   ├── main.py        # FastAPI application
│   │   ├── routers/       # API endpoints
│   │   ├── services/      # Business logic
│   │   └── models/        # Schemas and DB models
│   ├── supabase/
│   │   ├── schema_combined.sql  # Full DB schema (run this)
│   │   └── migrations/          # Individual migrations
│   └── requirements.txt
│
└── README.md
```

## Quick Start

### Prerequisites

- Node.js 18+
- Python 3.12+
- Spotify Developer Account (for hosting sessions)
- Supabase Account

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your credentials
python -m app.main
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env.local
# Edit .env.local with your API URL and Spotify client ID
npm run dev
```

Visit `http://localhost:3000`.

## Environment Variables

### Backend (.env)
- `SPOTIFY_CLIENT_ID` - From Spotify Developer Dashboard
- `SPOTIFY_CLIENT_SECRET` - From Spotify Developer Dashboard
- `SPOTIFY_REDIRECT_URI` - `http://localhost:8000/api/auth/callback` for local dev
- `SUPABASE_URL` - From Supabase project settings
- `SUPABASE_KEY` - Supabase anon key
- `SUPABASE_SERVICE_KEY` - Supabase service role key
- `JWT_SECRET_KEY` - Random secret (32+ chars)
- `FRONTEND_URL` - Frontend origin for post-login redirect
- `CORS_ORIGINS` - Comma-separated list of allowed frontend origins

### Frontend (.env.local)
- `NEXT_PUBLIC_API_URL` - Backend API URL (`http://localhost:8000` for local)
- `NEXT_PUBLIC_SPOTIFY_CLIENT_ID` - Spotify client ID

## Deployment

### Backend — Render

A `render.yaml` is included in `backend/`. Set environment variables in the dashboard and deploy from GitHub. The start command is:

```
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

### Frontend — Vercel

Connect the GitHub repository to Vercel. Set **Root Directory** to `frontend` and add the environment variables. Vercel auto-detects Next.js.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14, TypeScript, Tailwind CSS |
| Drag-and-Drop | @dnd-kit |
| Backend | Python 3.12, FastAPI, Uvicorn |
| Database | Supabase (PostgreSQL) |
| Audio | Spotify Web Playback SDK |
| Lyrics | LRCLIB API |
| Romanization | pypinyin, pykakasi, hangul-romanize |
| Deployment | Vercel (Frontend), Render (Backend) |

## API Documentation

With the backend running, visit:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## License

MIT License

---

Built for karaoke lovers
