from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.responses import RedirectResponse
from app.models.schemas import SpotifyAuthURL, SpotifyToken, User
from app.services.spotify_auth import SpotifyAuthService
from typing import Optional

router = APIRouter()
spotify_auth = SpotifyAuthService()


@router.get("/login", response_model=SpotifyAuthURL)
async def login():
    """
    Generate Spotify authorization URL for OAuth flow
    """
    try:
        auth_url = spotify_auth.get_auth_url()
        return SpotifyAuthURL(auth_url=auth_url)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate auth URL: {str(e)}")


@router.get("/callback")
async def callback(
    code: Optional[str] = Query(None),
    error: Optional[str] = Query(None)
):
    """
    Handle Spotify OAuth callback
    """
    if error:
        raise HTTPException(status_code=400, detail=f"Spotify auth error: {error}")

    if not code:
        raise HTTPException(status_code=400, detail="No authorization code provided")

    try:
        # Exchange code for access token
        token_data = spotify_auth.get_access_token(code)

        # Get user profile
        user_data = spotify_auth.get_user_profile(token_data["access_token"])

        # Store user in database (to be implemented)
        # user = await create_or_update_user(user_data, token_data)

        # Redirect to frontend with token
        from app.config import settings
        redirect_url = f"{settings.FRONTEND_URL}/auth/callback?access_token={token_data['access_token']}&refresh_token={token_data.get('refresh_token', '')}"

        return RedirectResponse(url=redirect_url)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Authentication failed: {str(e)}")


@router.post("/refresh", response_model=SpotifyToken)
async def refresh_token(refresh_token: str):
    """
    Refresh Spotify access token
    """
    try:
        token_data = spotify_auth.refresh_access_token(refresh_token)
        return SpotifyToken(**token_data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Token refresh failed: {str(e)}")


@router.get("/me", response_model=User)
async def get_current_user(access_token: str = Query(...)):
    """
    Get current user profile
    """
    try:
        user_data = spotify_auth.get_user_profile(access_token)
        return User(
            id=user_data["id"],
            spotify_id=user_data["id"],
            display_name=user_data.get("display_name", "Unknown"),
            email=user_data.get("email"),
            image_url=user_data.get("images", [{}])[0].get("url") if user_data.get("images") else None
        )
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid access token: {str(e)}")
