# 🎤 Karaoke Player

A production-ready web application for multilingual karaoke with real-time lyrics highlighting, romanization support for Asian languages, and Spotify integration.

## ✨ Features

- 🎵 **Spotify Integration** - Login with Spotify and play songs using Spotify Web Playback SDK
- 🌏 **Multilingual Support** - Chinese (Pinyin), Japanese (Romaji), Korean (Romanization)
- 📝 **Real-time Lyrics** - Word-level highlighting synchronized with music playback
- 👥 **Multi-user Sessions** - Shared queue for party mode karaoke
- 🎚️ **Playback Controls** - Volume control, queue management, lyrics display toggle
- ⚡ **Real-time Sync** - Live queue updates across all connected users

## 🏗️ Architecture

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│   Next.js       │ ──────> │  Python FastAPI  │ ──────> │   Supabase      │
│   Frontend      │  HTTP   │  Backend         │  SQL    │   PostgreSQL    │
│   (TypeScript)  │         │                  │         └─────────────────┘
└─────────────────┘         └──────────────────┘
     Vercel                      Railway                    Cloud Database
                                     │
                                     ├──> Spotify API
                                     ├──> LRCLIB API
                                     └──> Romanization
```

## 📁 Project Structure

```
karaoke-player/
├── frontend/               # Next.js TypeScript frontend
│   ├── src/
│   │   ├── app/           # Next.js 14 App Router
│   │   ├── components/    # React components
│   │   ├── lib/           # Utilities and API client
│   │   └── types/         # TypeScript types
│   └── package.json
│
├── backend/               # Python FastAPI backend
│   ├── app/
│   │   ├── main.py        # FastAPI application
│   │   ├── routers/       # API endpoints
│   │   ├── services/      # Business logic
│   │   └── models/        # Database models
│   └── requirements.txt
│
└── README.md
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm/yarn
- Python 3.9+
- Spotify Developer Account
- Supabase Account

### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy environment file and configure
cp .env.example .env
# Edit .env with your credentials

# Run development server
python -m app.main
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Copy environment file and configure
cp .env.example .env.local
# Edit .env.local with your API URL

# Run development server
npm run dev
```

Visit `http://localhost:3000` to see the app!

## 🔑 Environment Variables

### Backend (.env)
- `SPOTIFY_CLIENT_ID` - From Spotify Developer Dashboard
- `SPOTIFY_CLIENT_SECRET` - From Spotify Developer Dashboard
- `SUPABASE_URL` - From Supabase project settings
- `SUPABASE_KEY` - From Supabase project settings
- `JWT_SECRET_KEY` - Random secret for JWT signing

### Frontend (.env.local)
- `NEXT_PUBLIC_API_URL` - Backend API URL (http://localhost:8000 for local)
- `NEXT_PUBLIC_SPOTIFY_CLIENT_ID` - Spotify client ID

## 📦 Deployment

### Deploy Backend to Railway

1. Push code to GitHub
2. Connect Railway to your repository
3. Set environment variables in Railway dashboard
4. Deploy automatically on push

### Deploy Frontend to Vercel

```bash
cd frontend
vercel
```

Or connect your GitHub repository to Vercel for automatic deployments.

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14, TypeScript, Tailwind CSS, shadcn/ui |
| Backend | Python, FastAPI, Uvicorn |
| Database | Supabase (PostgreSQL) |
| Audio | Spotify Web Playback SDK |
| Lyrics | LRCLIB API |
| Romanization | pypinyin, pykakasi, hangul-romanize |
| Deployment | Vercel (Frontend), Railway (Backend) |

## 📝 API Documentation

Once the backend is running, visit:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## 🤝 Contributing

This is a personal project, but suggestions and feedback are welcome!

## 📄 License

MIT License - feel free to use this for your own karaoke sessions!

---

Built with ❤️ for karaoke lovers
