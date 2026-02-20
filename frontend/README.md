# Karaoke Player Frontend

A Next.js 14 frontend application for the multiplayer karaoke player with Spotify integration.

## Tech Stack

- **Next.js 14** with App Router
- **TypeScript** for type safety
- **Tailwind CSS v4** for styling
- **Axios** for API requests
- **React 18** for UI components

## Project Structure

```
frontend/
├── app/                    # Next.js App Router pages
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Home page (Login)
│   └── globals.css        # Global styles with Tailwind
├── lib/                   # Utility libraries
│   ├── api.ts            # API client for backend
│   └── utils.ts          # Utility functions
├── types/                 # TypeScript type definitions
│   └── index.ts          # Shared types
├── .env.example          # Environment variables template
├── next.config.js        # Next.js configuration
├── tailwind.config.ts    # Tailwind CSS configuration
├── tsconfig.json         # TypeScript configuration
└── postcss.config.js     # PostCSS configuration
```

## Getting Started

### Prerequisites

- Node.js 18+ installed
- npm or yarn package manager

### Installation

1. Install dependencies:
```bash
npm install
```

2. Create environment file:
```bash
cp .env.example .env.local
```

3. Update the environment variables in `.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_SPOTIFY_CLIENT_ID=your_spotify_client_id
```

### Development

Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the application.

### Build

Build the production application:
```bash
npm run build
```

### Start Production Server

Start the production server:
```bash
npm start
```

### Lint

Run ESLint:
```bash
npm run lint
```

## Features

- Spotify OAuth authentication
- Real-time session management
- Song search and queue management
- Karaoke player with synced lyrics
- Multi-language support with romanization
- Responsive design with dark mode support

## API Integration

The frontend connects to the FastAPI backend running at `NEXT_PUBLIC_API_URL`. The API client is configured in `lib/api.ts` with the following features:

- Automatic token management
- Request/response interceptors
- Error handling
- Type-safe API calls

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build production bundle
- `npm start` - Start production server
- `npm run lint` - Run ESLint

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | Backend API URL | `http://localhost:8000` |
| `NEXT_PUBLIC_SPOTIFY_CLIENT_ID` | Spotify Client ID | - |

## Next Steps

1. Build authentication UI and Spotify login flow
2. Create session management pages
3. Implement song search and queue UI
4. Build karaoke player with lyrics display
5. Add real-time synchronization with WebSockets
