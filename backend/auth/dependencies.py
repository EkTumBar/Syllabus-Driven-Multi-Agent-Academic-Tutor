from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from db.database import get_db
from db import crud
from db.models import User
from auth.jwt_handler import decode_access_token, get_password_hash
import logging

logger = logging.getLogger("auth.dependencies")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> User:
    """Authenticates current user from JWT Bearer token.

    Accepts both:
    - Backend-issued JWTs (created by /auth/login or /auth/signup)
    - Supabase Auth JWTs (created by Supabase when users sign in via the
      frontend Supabase client, including Google OAuth)

    For Supabase tokens the ``sub`` claim is the Supabase auth UUID.  If a
    corresponding row does not yet exist in the local ``users`` table, one is
    auto-provisioned using the Supabase UUID as the primary key so that the
    user is created transparently on their very first API call.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials or token expired",
        headers={"WWW-Authenticate": "Bearer"},
    )
    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception

    user_id: str = payload.get("sub")
    if user_id is None:
        raise credentials_exception

    user = crud.get_user_by_id(db, user_id=user_id)

    if user is None:
        # The token decoded successfully but no matching user row exists.
        # This happens when a Supabase Auth session token is used for the
        # first time: the Supabase UUID is not yet in the backend DB.
        # Auto-provision the user so the request can proceed.
        email: str = payload.get("email")
        if not email:
            # Without an email we cannot safely create the user
            raise credentials_exception

        # Check if a user with this email already exists under a different ID
        # (e.g. created via /auth/signup before linking a Supabase account)
        existing_by_email = crud.get_user_by_email(db, email=email)
        if existing_by_email:
            # Return the existing user; the IDs won't match but the email does
            logger.info(
                "Supabase token sub=%s matched existing backend user by email: %s",
                user_id, email,
            )
            return existing_by_email

        # Derive display name from Supabase user_metadata if available
        full_name: str = payload.get("user_metadata", {}).get("full_name", "") if isinstance(payload.get("user_metadata"), dict) else ""
        name_parts = full_name.split(" ") if full_name else []
        role = payload.get("role") or "student"
        # Supabase role claim on user tokens is always 'authenticated', not app roles
        if role == "authenticated":
            role = "student"

        logger.info(
            "Auto-provisioning backend user for Supabase sub=%s email=%s",
            user_id, email,
        )
        # Use a placeholder hashed password — Supabase handles credential
        # verification; the backend never needs the plaintext password for
        # OAuth users.
        placeholder_hash = get_password_hash(f"supabase-sso-{user_id}")
        user = crud.create_user(
            db,
            email=email,
            hashed_password=placeholder_hash,
            role=role,
            first_name=name_parts[0] if name_parts else None,
            last_name=" ".join(name_parts[1:]) if len(name_parts) > 1 else None,
            username=None,
            phone_number=None,
            location=None,
            avatar_url=payload.get("user_metadata", {}).get("avatar_url") if isinstance(payload.get("user_metadata"), dict) else None,
            preferences_json=None,
        )
        # Patch the auto-generated UUID to match the Supabase sub so future
        # lookups by ID also work.
        try:
            user.id = user_id
            db.commit()
            db.refresh(user)
        except Exception:
            db.rollback()
            # If the ID update fails (e.g. duplicate), fall back to email lookup
            user = crud.get_user_by_email(db, email=email)
            if user is None:
                raise credentials_exception

    return user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Ensures that the current authenticated user has an 'admin' role."""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required to access this resource"
        )
    return current_user
