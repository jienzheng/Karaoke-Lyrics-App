"""
Spotify authentication service
Handles OAuth flow, token management, and user profile retrieval
"""

import base64
from urllib.parse import urlencode

import httpx

from app.config import settings


class SpotifyAuthService:
    """Service for Spotify OAuth authentication"""

    def __init__(self):
        self.client_id = settings.SPOTIFY_CLIENT_ID
        self.client_secret = settings.SPOTIFY_CLIENT_SECRET
        self.redirect_uri = settings.SPOTIFY_REDIRECT_URI
        self.auth_url = "https://accounts.spotify.com/authorize"
        self.token_url = "https://accounts.spotify.com/api/token"
        self.api_base_url = "https://api.spotify.com/v1"

    def get_auth_url(self, state: str | None = None) -> str:
        """
        Generate Spotify authorization URL

        Args:
            state: Optional state parameter for CSRF protection

        Returns:
            Authorization URL string
        """
        scopes = [
            "user-read-email",
            "user-read-private",
            "user-read-playback-state",
            "user-modify-playback-state",
            "streaming",
            "user-library-read",
        ]

        params = {
            "client_id": self.client_id,
            "response_type": "code",
            "redirect_uri": self.redirect_uri,
            "scope": " ".join(scopes),
        }

        if state:
            params["state"] = state

        return f"{self.auth_url}?{urlencode(params)}"

    def get_access_token(self, code: str) -> dict:
        """
        Exchange authorization code for access token

        Args:
            code: Authorization code from callback

        Returns:
            Token data dictionary
        """
        # Encode client credentials
        credentials = f"{self.client_id}:{self.client_secret}"
        encoded_credentials = base64.b64encode(credentials.encode()).decode()

        headers = {
            "Authorization": f"Basic {encoded_credentials}",
            "Content-Type": "application/x-www-form-urlencoded",
        }

        data = {"grant_type": "authorization_code", "code": code, "redirect_uri": self.redirect_uri}

        response = httpx.post(self.token_url, headers=headers, data=data)
        response.raise_for_status()

        return response.json()

    def refresh_access_token(self, refresh_token: str) -> dict:
        """
        Refresh access token using refresh token

        Args:
            refresh_token: Refresh token

        Returns:
            New token data dictionary
        """
        credentials = f"{self.client_id}:{self.client_secret}"
        encoded_credentials = base64.b64encode(credentials.encode()).decode()

        headers = {
            "Authorization": f"Basic {encoded_credentials}",
            "Content-Type": "application/x-www-form-urlencoded",
        }

        data = {"grant_type": "refresh_token", "refresh_token": refresh_token}

        response = httpx.post(self.token_url, headers=headers, data=data)
        response.raise_for_status()

        return response.json()

    def get_user_profile(self, access_token: str) -> dict:
        """
        Get user profile from Spotify

        Args:
            access_token: Valid access token

        Returns:
            User profile data
        """
        headers = {"Authorization": f"Bearer {access_token}"}

        response = httpx.get(f"{self.api_base_url}/me", headers=headers)
        response.raise_for_status()

        return response.json()
