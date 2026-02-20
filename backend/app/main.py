from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os

# Load environment variables
load_dotenv()

# Import routers
from app.routers import auth, lyrics, queue, romanization, spotify

app = FastAPI(
    title="Karaoke Player API",
    description="Backend API for multilingual karaoke player with Spotify integration",
    version="1.0.0"
)

# CORS Configuration
cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health check endpoint
@app.get("/")
async def root():
    return {
        "message": "Karaoke Player API",
        "status": "running",
        "version": "1.0.0"
    }

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

# Include routers
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(spotify.router, prefix="/api/spotify", tags=["Spotify"])
app.include_router(lyrics.router, prefix="/api/lyrics", tags=["Lyrics"])
app.include_router(queue.router, prefix="/api/queue", tags=["Queue"])
app.include_router(romanization.router, prefix="/api/romanization", tags=["Romanization"])

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=port,
        reload=True
    )
