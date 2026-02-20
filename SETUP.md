# 🎤 Karaoke Player - Complete Setup Guide

This guide will walk you through setting up the entire karaoke player application from scratch.

## 📋 Prerequisites

Before you begin, make sure you have:

- **Node.js 18+** and npm installed
- **Python 3.9+** installed
- A **Spotify Developer Account** (free)
- A **Supabase Account** (free tier is fine)
- A **Vercel Account** (free tier is fine)
- A **Railway Account** (free tier is fine)

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
2. Copy your:
   - **Client ID**
   - **Client Secret** (click "View client secret")
3. Save these for later

### 1.3 Add Production Redirect URI

Once you deploy, add your production URLs:
- `https://your-backend-url.railway.app/api/auth/callback`
- `https://your-frontend-url.vercel.app/auth/callback`

---

## Step 2: Supabase Database Setup

### 2.1 Create a Supabase Project

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Click **"New Project"**
3. Fill in:
   - **Name**: karaoke-player
   - **Database Password**: (generate a strong password and save it)
   - **Region**: Choose closest to you
4. Wait for the project to be created (~2 minutes)

### 2.2 Run Database Migrations

1. In your Supabase project, go to **SQL Editor**
2. Click **"New query"**
3. Copy the contents of `backend/supabase/migrations/001_initial_schema.sql`
4. Paste into the editor and click **"Run"**
5. Verify tables were created in **Table Editor**

### 2.3 Get Your Credentials

1. Go to **Project Settings** > **API**
2. Copy:
   - **Project URL** (looks like `https://xxx.supabase.co`)
   - **anon public key** (starts with `eyJ...`)
   - **service_role key** (starts with `eyJ...`) - click "Reveal" to see it

---

## Step 3: Backend Setup (Local Development)

### 3.1 Navigate to Backend Directory

```bash
cd backend
```

### 3.2 Create Virtual Environment

```bash
# Create virtual environment
python -m venv venv

# Activate it
# On macOS/Linux:
source venv/bin/activate
# On Windows:
venv\Scripts\activate
```

### 3.3 Install Dependencies

```bash
pip install -r requirements.txt
```

### 3.4 Configure Environment Variables

```bash
# Copy the example file
cp .env.example .env

# Edit .env with your favorite editor
nano .env
```

Fill in your credentials:

```env
# Server Configuration
PORT=8000
ENVIRONMENT=development
FRONTEND_URL=http://localhost:3000

# Spotify API Configuration
SPOTIFY_CLIENT_ID=your_spotify_client_id_here
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret_here
SPOTIFY_REDIRECT_URI=http://localhost:8000/api/auth/callback

# Supabase Configuration
SUPABASE_URL=https://your_project.supabase.co
SUPABASE_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_KEY=your_supabase_service_role_key_here

# JWT Secret (generate a random string)
JWT_SECRET_KEY=your_random_jwt_secret_minimum_32_characters_long

# CORS Origins
CORS_ORIGINS=http://localhost:3000
```

### 3.5 Run the Backend

```bash
python -m app.main
```

You should see:
```
INFO:     Started server process
INFO:     Uvicorn running on http://0.0.0.0:8000
```

Test it by visiting: http://localhost:8000/docs (Swagger UI)

---

## Step 4: Frontend Setup (Local Development)

### 4.1 Navigate to Frontend Directory

```bash
cd ../frontend
```

### 4.2 Install Dependencies

```bash
npm install --legacy-peer-deps
```

### 4.3 Configure Environment Variables

```bash
# Copy the example file
cp .env.example .env.local

# Edit .env.local
nano .env.local
```

Fill in:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_SPOTIFY_CLIENT_ID=your_spotify_client_id_here
```

### 4.4 Run the Frontend

```bash
npm run dev
```

You should see:
```
✓ Ready in 2.5s
○ Local:   http://localhost:3000
```

Visit: http://localhost:3000

---

## Step 5: Test the Application

### 5.1 Login Flow

1. Go to http://localhost:3000
2. Click **"Login with Spotify"**
3. You'll be redirected to Spotify
4. Authorize the app
5. You should be redirected back

### 5.2 Create a Session

1. After login, create a new session
2. Give it a name (e.g., "Friday Night Karaoke")

### 5.3 Add Songs

1. Search for a song using the search bar
2. Click **"Add to Queue"**
3. The song should appear in the queue

### 5.4 Play Music

1. Click on a song in the queue
2. The player should load
3. Lyrics should appear and highlight as the song plays

---

## Step 6: Deploy to Production

### 6.1 Deploy Backend to Railway

1. Go to [Railway Dashboard](https://railway.app)
2. Click **"New Project"** > **"Deploy from GitHub repo"**
3. Connect your GitHub account and select your repository
4. Railway will auto-detect the Python app
5. Go to **Variables** and add all environment variables from your `.env` file
   - Update `FRONTEND_URL` to your Vercel URL (get this in step 6.2)
   - Update `SPOTIFY_REDIRECT_URI` to `https://your-railway-app.railway.app/api/auth/callback`
   - Update `CORS_ORIGINS` to include your Vercel URL
6. Click **"Deploy"**
7. Once deployed, copy your Railway URL (e.g., `https://your-app.railway.app`)

### 6.2 Deploy Frontend to Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **"Add New..."** > **"Project"**
3. Import your GitHub repository
4. Vercel will auto-detect Next.js
5. Configure:
   - **Framework Preset**: Next.js
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Install Command**: `npm install --legacy-peer-deps`
6. Add environment variables:
   - `NEXT_PUBLIC_API_URL`: Your Railway URL from step 6.1
   - `NEXT_PUBLIC_SPOTIFY_CLIENT_ID`: Your Spotify client ID
7. Click **"Deploy"**
8. Once deployed, copy your Vercel URL (e.g., `https://your-app.vercel.app`)

### 6.3 Update Spotify Redirect URIs

1. Go back to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Select your app
3. Click **"Settings"**
4. Add redirect URIs:
   - `https://your-railway-app.railway.app/api/auth/callback`
   - `https://your-vercel-app.vercel.app/auth/callback`
5. Click **"Save"**

### 6.4 Update Backend Environment Variables

Go back to Railway and update:
- `FRONTEND_URL`: `https://your-vercel-app.vercel.app`
- `SPOTIFY_REDIRECT_URI`: `https://your-railway-app.railway.app/api/auth/callback`
- `CORS_ORIGINS`: `https://your-vercel-app.vercel.app`
- `ENVIRONMENT`: `production`

Redeploy the backend.

---

## Step 7: Verify Production Deployment

1. Visit your Vercel URL
2. Test the login flow
3. Create a session
4. Add songs
5. Play music with lyrics

---

## 🎉 You're Done!

Your karaoke player is now fully deployed and ready to use!

## 📚 Next Steps

- Customize the UI theme in `frontend/app/globals.css`
- Add more languages (edit `backend/app/services/romanization_service.py`)
- Invite friends to join your karaoke sessions
- Consider upgrading to Spotify Premium for better playback

## 🐛 Troubleshooting

### "Authorization failed" error
- Check that your Spotify Client ID and Secret are correct
- Verify redirect URIs match exactly in Spotify Dashboard

### "Failed to fetch lyrics"
- LRCLIB API might not have lyrics for that song
- Try a different, more popular song

### Lyrics not syncing properly
- Ensure the song is actually playing (Spotify Premium required)
- Check browser console for errors

### Database errors
- Verify Supabase credentials are correct
- Check that migrations were run successfully
- Ensure Row Level Security policies are set up

### CORS errors
- Update `CORS_ORIGINS` in backend environment variables
- Must include exact frontend URL (no trailing slash)

---

## 📞 Support

If you encounter issues:
1. Check the logs in Railway (backend) and Vercel (frontend)
2. Ensure all environment variables are set correctly
3. Verify Spotify Developer app settings
4. Check Supabase database connection

---

**Enjoy your karaoke sessions! 🎤🎶**
