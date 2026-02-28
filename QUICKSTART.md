# Quick Start Guide

Get your karaoke player running in 5 minutes!

## Prerequisites
- Node.js 18+
- Python 3.12+
- Spotify account (Spotify Premium required for hosting sessions)
- Supabase account (free)

## 1. Clone & Install

```bash
# Backend
cd backend
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Frontend (in new terminal)
cd frontend
npm install
```

## 2. Set Up Spotify App

1. Go to https://developer.spotify.com/dashboard
2. Create new app: "Karaoke Player"
3. Add redirect URI: `http://localhost:8000/api/auth/callback`
4. Copy **Client ID** and **Client Secret**

## 3. Set Up Supabase

1. Go to https://supabase.com/dashboard
2. Create new project: "karaoke-player"
3. Go to **SQL Editor** → **New query**
4. Copy the contents of `backend/supabase/schema_combined.sql` and run it
5. Verify tables were created in **Table Editor**
6. Copy **Project URL**, **anon key**, and **service_role key** from **Settings → API**

## 4. Configure Backend

```bash
cd backend
cp .env.example .env
# Edit .env:
# SPOTIFY_CLIENT_ID=...
# SPOTIFY_CLIENT_SECRET=...
# SPOTIFY_REDIRECT_URI=http://localhost:8000/api/auth/callback
# SUPABASE_URL=...
# SUPABASE_KEY=...
# SUPABASE_SERVICE_KEY=...
# JWT_SECRET_KEY=<random 32+ char string>
# FRONTEND_URL=http://localhost:3000
# CORS_ORIGINS=http://localhost:3000
```

## 5. Configure Frontend

```bash
cd frontend
cp .env.example .env.local
# Edit .env.local:
# NEXT_PUBLIC_API_URL=http://localhost:8000
# NEXT_PUBLIC_SPOTIFY_CLIENT_ID=your_spotify_client_id
```

## 6. Run!

```bash
# Terminal 1 - Backend
cd backend
source .venv/bin/activate
python -m app.main

# Terminal 2 - Frontend
cd frontend
npm run dev
```

## 7. Test

1. Open http://localhost:3000
2. **Host**: Click "Login with Spotify", create a session, note the 6-char session code
3. **Guest**: Open a new tab (or different browser), enter a name and the session code to join
4. Search for a song, add to queue, and play!

For detailed deployment instructions, see [SETUP.md](./SETUP.md)
