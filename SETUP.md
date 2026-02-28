# Karaoke Player - Complete Setup Guide

This guide walks through setting up the karaoke player from scratch, including local development and production deployment.

## Prerequisites

- **Node.js 18+** and npm
- **Python 3.12+**
- A **Spotify Developer Account** (free) — Spotify Premium required for hosting playback
- A **Supabase Account** (free tier is fine)
- A **Vercel Account** (free tier is fine)
- A **Render** account for backend hosting (free tier works)

---

## Step 1: Spotify Developer Setup

### 1.1 Create a Spotify App

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Click **"Create an App"**
3. Fill in:
   - **App name**: Karaoke Player
   - **App description**: Multilingual karaoke player with lyrics
   - **Redirect URI**: `http://localhost:8000/api/auth/callback` (for local development)
4. Click **"Save"**

### 1.2 Get Your Credentials

1. On your app's dashboard, click **"Settings"**
2. Copy your **Client ID** and **Client Secret**

### 1.3 Add Production Redirect URI (for later)

After deploying, add your backend's production URL:
- `https://<your-backend>.onrender.com/api/auth/callback`

---

## Step 2: Supabase Database Setup

### 2.1 Create a Supabase Project

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Click **"New Project"**
3. Fill in name, database password, and region
4. Wait ~2 minutes for provisioning

### 2.2 Run Database Schema

1. In your Supabase project, go to **SQL Editor** → **New query**
2. Copy the entire contents of `backend/supabase/schema_combined.sql`
3. Paste and click **"Run"**
4. Verify tables were created in **Table Editor**

The combined schema creates all tables including: `users`, `sessions`, `queue_items`, `session_participants`, `lyrics_cache`, and `playback_state`, plus indexes, triggers, and guest/session-code columns.

### 2.3 Get Your Credentials

1. Go to **Project Settings** → **API**
2. Copy:
   - **Project URL** (e.g. `https://xxx.supabase.co`)
   - **anon public key** (starts with `eyJ...`)
   - **service_role key** (click "Reveal") — keep this secret

---

## Step 3: Backend Setup (Local)

### 3.1 Create Virtual Environment

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
```

### 3.2 Install Dependencies

```bash
pip install -r requirements.txt
```

### 3.3 Configure Environment Variables

```bash
cp .env.example .env
```

Edit `.env`:

```env
# Server
PORT=8000
ENVIRONMENT=development
FRONTEND_URL=http://localhost:3000

# Spotify
SPOTIFY_CLIENT_ID=your_spotify_client_id_here
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret_here
SPOTIFY_REDIRECT_URI=http://localhost:8000/api/auth/callback

# Supabase
SUPABASE_URL=https://your_project.supabase.co
SUPABASE_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_KEY=your_supabase_service_role_key_here

# JWT
JWT_SECRET_KEY=your_random_jwt_secret_minimum_32_characters

# CORS — must match your frontend origin exactly (no trailing slash)
CORS_ORIGINS=http://localhost:3000
```

### 3.4 Run the Backend

```bash
python -m app.main
```

You should see:
```
INFO:     Uvicorn running on http://0.0.0.0:8000
```

Verify with: http://localhost:8000/docs (Swagger UI)

---

## Step 4: Frontend Setup (Local)

### 4.1 Install Dependencies

```bash
cd frontend
npm install
```

### 4.2 Configure Environment Variables

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_SPOTIFY_CLIENT_ID=your_spotify_client_id_here
```

### 4.3 Run the Frontend

```bash
npm run dev
```

Visit: http://localhost:3000

---

## Step 5: Test the Application

### Host flow

1. Go to http://localhost:3000
2. Click **"Login with Spotify"** → authorize the app
3. After redirect, click **"Create Session"** (name is optional)
4. Note the 6-character session code shown in the player page

### Guest flow

1. Open a new tab (or different browser) at http://localhost:3000
2. Enter a display name and the session code
3. Click **"Join as Guest"** — no Spotify account needed

### Add songs and play

1. Use the search bar to find a song
2. Click **"Add to Queue"**
3. Click play — lyrics will highlight in sync
4. Guests see lyrics synced to the host's playback position in real-time

---

## Step 6: Deploy to Production

### 6.1 Deploy Backend to Render

1. Push your code to GitHub
2. Go to [Render Dashboard](https://render.com)
3. Click **"New"** → **"Web Service"**
4. Connect your GitHub repository
5. Set:
   - **Root Directory**: `backend`
   - **Runtime**: Python
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
6. Add environment variables (all from your `.env`, updated for production):
   - `ENVIRONMENT=production`
   - `FRONTEND_URL=https://your-vercel-app.vercel.app`
   - `SPOTIFY_REDIRECT_URI=https://your-render-app.onrender.com/api/auth/callback`
   - `CORS_ORIGINS=https://your-vercel-app.vercel.app`
   - All Supabase and Spotify credentials
7. Deploy and copy your Render URL


### 6.2 Deploy Frontend to Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **"Add New"** → **"Project"** → import your GitHub repo
3. Set:
   - **Root Directory**: `frontend`
   - **Framework Preset**: Next.js
4. Add environment variables:
   - `NEXT_PUBLIC_API_URL`: Your Render URL from step 6.1
   - `NEXT_PUBLIC_SPOTIFY_CLIENT_ID`: Your Spotify client ID
5. Deploy and copy your Vercel URL

### 6.3 Update Spotify Redirect URIs

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Select your app → **Settings**
3. Add:
   - `https://your-render-app.onrender.com/api/auth/callback`
4. Save

### 6.4 Final Backend Environment Update

Back in Render, update:
- `FRONTEND_URL`: `https://your-vercel-app.vercel.app`
- `SPOTIFY_REDIRECT_URI`: `https://your-render-app.onrender.com/api/auth/callback`
- `CORS_ORIGINS`: `https://your-vercel-app.vercel.app`

Trigger a redeploy.

---

## Troubleshooting

### "Authorization failed" error
- Check Spotify Client ID and Secret are correct
- Verify redirect URI matches exactly in Spotify Dashboard (no trailing slash)

### "Failed to fetch lyrics"
- LRCLIB may not have lyrics for that song; try a more popular song
- Check backend logs for errors

### Lyrics not syncing for guests
- Ensure the host's browser is playing (Spotify SDK must be active)
- Check browser console for network errors on `/playback-state` polling

### CORS errors
- `CORS_ORIGINS` must be the exact frontend URL with no trailing slash
- Verify `NEXT_PUBLIC_API_URL` has no trailing slash

### Database errors
- Verify Supabase credentials are correct
- Confirm `schema_combined.sql` was run successfully (check Table Editor)

### Guest can't join
- Session must be active (not cleaned up by the 5-minute inactivity timer)
- Session code is case-insensitive but must be exactly 6 characters

---

**Enjoy your karaoke sessions!**
