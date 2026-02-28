import asyncio
import logging
import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Load environment variables
load_dotenv()

# Import routers (must come after load_dotenv so config picks up env vars)
from app.config import settings  # noqa: E402
from app.routers import auth, lyrics, queue, romanization, spotify  # noqa: E402
from app.services.queue_service import QueueService  # noqa: E402

logger = logging.getLogger(__name__)

CLEANUP_INTERVAL_SECONDS = 5 * 60  # 5 minutes


async def _session_cleanup_loop():
    """Background task that cleans up inactive sessions every 5 minutes."""
    while True:
        await asyncio.sleep(CLEANUP_INTERVAL_SECONDS)
        try:
            deleted = await QueueService.cleanup_inactive_sessions()
            if deleted:
                logger.info("Session cleanup: deleted %d inactive session(s)", deleted)
        except Exception as e:
            logger.warning("Session cleanup error: %s", e)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("CORS origins: %s", settings.cors_origins_list)
    task = asyncio.create_task(_session_cleanup_loop())
    yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


app = FastAPI(
    title="Karaoke Player API",
    description="Backend API for multilingual karaoke player with Spotify integration",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS Configuration
cors_origins = settings.cors_origins_list

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
    return {"message": "Karaoke Player API", "status": "running", "version": "1.0.0"}


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
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=True)
