from supabase import create_client, Client
from app.config import settings


class Database:
    """Supabase database client wrapper"""

    def __init__(self):
        self.client: Client = create_client(
            settings.SUPABASE_URL,
            settings.SUPABASE_KEY
        )

    def get_client(self) -> Client:
        """Get Supabase client instance"""
        return self.client


# Global database instance
db = Database()


def get_db() -> Client:
    """Dependency function to get database client"""
    return db.get_client()
