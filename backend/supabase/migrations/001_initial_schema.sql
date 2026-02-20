-- Initial database schema for Karaoke Player
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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

CREATE INDEX idx_users_spotify_id ON users(spotify_id);

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

CREATE INDEX idx_sessions_host_id ON sessions(host_id);
CREATE INDEX idx_sessions_is_active ON sessions(is_active);

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

CREATE INDEX idx_queue_items_session_id ON queue_items(session_id);
CREATE INDEX idx_queue_items_position ON queue_items(session_id, position);

-- ==================== SESSION PARTICIPANTS TABLE ====================
CREATE TABLE IF NOT EXISTS session_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(session_id, user_id)
);

CREATE INDEX idx_participants_session_id ON session_participants(session_id);
CREATE INDEX idx_participants_user_id ON session_participants(user_id);

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

CREATE INDEX idx_lyrics_cache_song_id ON lyrics_cache(song_id);
CREATE INDEX idx_lyrics_cache_song_artist ON lyrics_cache(song_name, artist_name);

-- ==================== FUNCTIONS ====================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sessions_updated_at
    BEFORE UPDATE ON sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lyrics_cache_updated_at
    BEFORE UPDATE ON lyrics_cache
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ==================== ROW LEVEL SECURITY ====================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE queue_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE lyrics_cache ENABLE ROW LEVEL SECURITY;

-- Users can read their own data
CREATE POLICY "Users can read own data"
    ON users FOR SELECT
    USING (auth.uid()::text = id::text);

-- Users can update their own data
CREATE POLICY "Users can update own data"
    ON users FOR UPDATE
    USING (auth.uid()::text = id::text);

-- Anyone can read active sessions
CREATE POLICY "Anyone can read active sessions"
    ON sessions FOR SELECT
    USING (is_active = TRUE);

-- Users can create sessions
CREATE POLICY "Users can create sessions"
    ON sessions FOR INSERT
    WITH CHECK (auth.uid()::text = host_id::text);

-- Session hosts can update/delete their sessions
CREATE POLICY "Hosts can manage their sessions"
    ON sessions FOR ALL
    USING (auth.uid()::text = host_id::text);

-- Anyone can read queue items
CREATE POLICY "Anyone can read queue items"
    ON queue_items FOR SELECT
    USING (TRUE);

-- Authenticated users can add to queue
CREATE POLICY "Authenticated users can add to queue"
    ON queue_items FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- Users can delete their own queue items or session host can delete
CREATE POLICY "Users can manage queue items"
    ON queue_items FOR DELETE
    USING (
        auth.uid()::text = added_by::text
        OR
        EXISTS (
            SELECT 1 FROM sessions
            WHERE sessions.id = queue_items.session_id
            AND sessions.host_id::text = auth.uid()::text
        )
    );

-- Anyone can read session participants
CREATE POLICY "Anyone can read participants"
    ON session_participants FOR SELECT
    USING (TRUE);

-- Users can join sessions
CREATE POLICY "Users can join sessions"
    ON session_participants FOR INSERT
    WITH CHECK (auth.uid()::text = user_id::text);

-- Users can leave sessions
CREATE POLICY "Users can leave sessions"
    ON session_participants FOR DELETE
    USING (auth.uid()::text = user_id::text);

-- Anyone can read lyrics cache
CREATE POLICY "Anyone can read lyrics cache"
    ON lyrics_cache FOR SELECT
    USING (TRUE);

-- Service role can manage lyrics cache
CREATE POLICY "Service can manage lyrics cache"
    ON lyrics_cache FOR ALL
    USING (TRUE);
