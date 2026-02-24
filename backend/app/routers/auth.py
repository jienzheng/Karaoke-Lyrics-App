from fastapi import APIRouter, HTTPException, Depends, Query, Body
from fastapi.responses import RedirectResponse
from app.models.schemas import SpotifyAuthURL, SpotifyToken, User, GuestJoinRequest, GuestJoinResponse
from app.services.spotify_auth import SpotifyAuthService
from app.models.database import get_db
from typing import Optional
from urllib.parse import urlencode
import uuid

router = APIRouter()
spotify_auth = SpotifyAuthService()


@router.get("/login")
async def login():
    """
    Redirect user to Spotify authorization page
    """
    try:
        auth_url = spotify_auth.get_auth_url()
        return RedirectResponse(url=auth_url)
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

        # Get user profile from Spotify
        user_data = spotify_auth.get_user_profile(token_data["access_token"])

        # Upsert user in database
        db = get_db()
        spotify_id = user_data["id"]
        display_name = user_data.get("display_name", "Unknown")
        email = user_data.get("email")
        image_url = user_data.get("images", [{}])[0].get("url") if user_data.get("images") else None

        existing = db.table("users").select("id").eq("spotify_id", spotify_id).execute()

        if existing.data:
            user_id = existing.data[0]["id"]
            db.table("users").update({
                "display_name": display_name,
                "email": email,
                "image_url": image_url,
            }).eq("id", user_id).execute()
        else:
            result = db.table("users").insert({
                "spotify_id": spotify_id,
                "display_name": display_name,
                "email": email,
                "image_url": image_url,
            }).execute()
            user_id = result.data[0]["id"]

        # Redirect to frontend with token and user_id
        from app.config import settings
        params = urlencode({
            "access_token": token_data["access_token"],
            "refresh_token": token_data.get("refresh_token", ""),
            "user_id": user_id,
        })
        redirect_url = f"{settings.FRONTEND_URL}/auth/callback?{params}"

        return RedirectResponse(url=redirect_url)

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Authentication failed: {str(e)}")


@router.post("/refresh", response_model=SpotifyToken)
async def refresh_token(refresh_token: str = Body(..., embed=True)):
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


@router.post("/guest-join", response_model=GuestJoinResponse)
async def guest_join(request: GuestJoinRequest):
    """
    Join a session as a guest user (no Spotify account needed).
    Creates a guest user record and adds them to the session.
    """
    db = get_db()

    # Find active session by code
    session_result = db.table("sessions").select("*").eq("code", request.session_code.upper()).eq("is_active", True).execute()
    if not session_result.data:
        raise HTTPException(status_code=404, detail="Session not found or not active")

    session_data = session_result.data[0]

    # Create guest user
    guest_spotify_id = f"guest_{uuid.uuid4().hex[:12]}"
    user_result = db.table("users").insert({
        "spotify_id": guest_spotify_id,
        "display_name": request.display_name,
        "is_guest": True,
    }).execute()

    if not user_result.data:
        raise HTTPException(status_code=500, detail="Failed to create guest user")

    guest_user_id = user_result.data[0]["id"]

    # Add guest to session participants
    try:
        db.table("session_participants").insert({
            "session_id": session_data["id"],
            "user_id": guest_user_id,
        }).execute()
    except Exception:
        pass  # Already in session

    return GuestJoinResponse(
        user_id=guest_user_id,
        session_id=session_data["id"],
        is_guest=True,
    )
