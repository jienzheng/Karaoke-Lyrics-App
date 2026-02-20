# 🚀 Quick Start Guide

Get your karaoke player running in 5 minutes!

## Prerequisites
- Node.js 18+
- Python 3.9+
- Spotify account
- Supabase account (free)

## 1. Clone & Install

```bash
# Backend
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt

# Frontend (in new terminal)
cd frontend
npm install --legacy-peer-deps
```

## 2. Set Up Spotify App

1. Go to https://developer.spotify.com/dashboard
2. Create new app: "Karaoke Player"
3. Set redirect URI: `http://localhost:8000/api/auth/callback`
4. Copy Client ID and Client Secret

## 3. Set Up Supabase

1. Go to https://supabase.com/dashboard
2. Create new project: "karaoke-player"
3. Go to SQL Editor → New query
4. Run the SQL from `backend/supabase/migrations/001_initial_schema.sql`
5. Copy Project URL and anon key from Settings → API

## 4. Configure Backend

```bash
cd backend
cp .env.example .env
# Edit .env with your credentials:
# - SPOTIFY_CLIENT_ID
# - SPOTIFY_CLIENT_SECRET
# - SUPABASE_URL
# - SUPABASE_KEY
# - SUPABASE_SERVICE_KEY
# - JWT_SECRET_KEY (any random 32+ character string)
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
source venv/bin/activate
python -m app.main

# Terminal 2 - Frontend
cd frontend
npm run dev
```

## 7. Test

1. Open http://localhost:3000
2. Click "Login with Spotify"
3. Create a session
4. Search for a song (try popular songs with lyrics)
5. Add to queue and play!

## 🎤 Enjoy!

For detailed setup and deployment instructions, see [SETUP.md](./SETUP.md)
