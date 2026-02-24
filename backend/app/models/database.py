from app.config import settings
from supabase import Client, create_client

# Error message when Supabase env is missing or invalid (e.g. on Railway)
SUPABASE_ENV_HINT = (
    "Check SUPABASE_URL and SUPABASE_KEY in your environment "
    "(e.g. Railway project → Variables). Use the project URL and anon key from "
    "https://supabase.com/dashboard → Project Settings → API."
)


class Database:
    """Supabase database client wrapper (lazy-initialized so app can start before env is ready)."""

    def __init__(self):
        self._client: Client | None = None

    def get_client(self) -> Client:
        """Get Supabase client instance, creating it on first use."""
        if self._client is None:
            try:
                self._client = create_client(
                    settings.SUPABASE_URL,
                    settings.SUPABASE_SERVICE_KEY,
                )
            except Exception as e:
                if "Invalid API key" in str(e) or "invalid" in str(e).lower():
                    raise RuntimeError(
                        f"Supabase configuration is invalid: {e}. {SUPABASE_ENV_HINT}"
                    ) from e
                raise
        return self._client


# Global database instance (client created on first get_client() call)
db = Database()


def get_db() -> Client:
    """Dependency function to get database client"""
    return db.get_client()
