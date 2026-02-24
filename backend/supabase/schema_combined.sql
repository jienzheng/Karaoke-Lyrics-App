-- Combined Supabase schema for Karaoke Player
-- Run this once in your Supabase project's SQL editor.

-- =========================================
-- EXTENSIONS
-- =========================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- =========================================
-- TABLES
-- =========================================

-- ==================== USERS TABLE ====================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    spotify_id VARCHAR(255) UNIQUE NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_spotify_id ON users(spotify_id);


-- ==================== SESSIONS TABLE ====================
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    host_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT TRUE,
    current_song_id UUID,
    lyrics_display_mode VARCHAR(50) DEFAULT 'both',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_host_id ON sessions(host_id);
CREATE INDEX IF NOT EXISTS idx_sessions_is_active ON sessions(is_active);


-- ==================== QUEUE ITEMS TABLE ====================
CREATE TABLE IF NOT EXISTS queue_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    song_id VARCHAR(255) NOT NULL,
    song_name VARCHAR(255) NOT NULL,
    artist_name VARCHAR(255) NOT NULL,
    album_name VARCHAR(255),
    duration_ms INTEGER,
    spotify_uri VARCHAR(255) NOT NULL,
    image_url TEXT,
    added_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    is_playing BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_queue_items_session_id ON queue_items(session_id);
CREATE INDEX IF NOT EXISTS idx_queue_items_position ON queue_items(session_id, position);


-- ==================== SESSION PARTICIPANTS TABLE ====================
CREATE TABLE IF NOT EXISTS session_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(session_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_participants_session_id ON session_participants(session_id);
CREATE INDEX IF NOT EXISTS idx_participants_user_id ON session_participants(user_id);


-- ==================== LYRICS CACHE TABLE ====================
CREATE TABLE IF NOT EXISTS lyrics_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    song_id VARCHAR(255) UNIQUE NOT NULL,
    song_name VARCHAR(255) NOT NULL,
    artist_name VARCHAR(255) NOT NULL,
    language VARCHAR(50),
    original_lyrics JSONB NOT NULL,
    romanized_lyrics JSONB,
    synced BOOLEAN DEFAULT FALSE,
    source VARCHAR(50) DEFAULT 'lrclib',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lyrics_cache_song_id ON lyrics_cache(song_id);


-- =========================================
-- AUTO-UPDATE TIMESTAMPS
-- =========================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_sessions_updated_at ON sessions;
CREATE TRIGGER update_sessions_updated_at
    BEFORE UPDATE ON sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_lyrics_cache_updated_at ON lyrics_cache;
CREATE TRIGGER update_lyrics_cache_updated_at
    BEFORE UPDATE ON lyrics_cache
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- =========================================
-- SESSION CODE COLUMN (SHAREABLE CODES)
-- =========================================

-- Add a short shareable code to sessions
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS code VARCHAR(6) UNIQUE;

-- Backfill existing sessions with random codes
UPDATE sessions
SET code = UPPER(SUBSTR(MD5(RANDOM()::TEXT), 1, 6))
WHERE code IS NULL;

-- Make code NOT NULL after backfill
ALTER TABLE sessions ALTER COLUMN code SET NOT NULL;

-- Set default for new rows
ALTER TABLE sessions
ALTER COLUMN code SET DEFAULT UPPER(SUBSTR(MD5(RANDOM()::TEXT), 1, 6));


-- =========================================
-- GUEST USER SUPPORT
-- =========================================

-- Flag to distinguish guest users from Spotify-authenticated users
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_guest BOOLEAN DEFAULT FALSE;

-- Store host's Spotify refresh token so guests can use the host's Spotify account
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS host_refresh_token TEXT;

-- Track last queue activity for inactivity cleanup
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();


-- ==================== PLAYBACK STATE TABLE ====================
-- Stores real-time playback position so guests can sync lyrics with the host.
-- One row per session, upserted every ~1s by the host's browser.
CREATE TABLE IF NOT EXISTS playback_state (
    session_id UUID PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,
    is_playing BOOLEAN DEFAULT FALSE,
    position_ms INTEGER DEFAULT 0,
    song_id VARCHAR(255),
    countdown INTEGER DEFAULT NULL,  -- null = no countdown, 5..1 = seconds left
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

DROP TRIGGER IF EXISTS update_playback_state_updated_at ON playback_state;
CREATE TRIGGER update_playback_state_updated_at
    BEFORE UPDATE ON playback_state
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

