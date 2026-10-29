from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
import bcrypt
from jose import jwt, JWTError
from config import settings

# Supabase always stamps user session JWTs with aud="authenticated".
# python-jose raises JWTClaimsError (a JWTError subclass) when the token
# carries an 'aud' claim but no audience is passed to jwt.decode().
# We must tell jose what audience to expect for Supabase tokens.
SUPABASE_AUDIENCE = "authenticated"


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies a plain text password against a bcrypt hashed password."""
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            hashed_password.encode("utf-8")
        )
    except Exception:
        return False


def get_password_hash(password: str) -> str:
    """Hashes a plain text password using bcrypt."""
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")


def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """Creates a signed JWT access token with an expiration timestamp."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
    return encoded_jwt


def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    """Decodes and validates a JWT access token.

    Handles two token issuers transparently:
    - Supabase Auth tokens: always carry ``aud='authenticated'``; decoded
      with ``audience=SUPABASE_AUDIENCE`` so python-jose does not raise
      ``JWTClaimsError: Invalid audience``.
    - Backend-issued tokens (login/signup): no ``aud`` claim; decoded without
      an audience argument.

    Returns the decoded payload dict on success, or ``None`` on any failure.
    """
    try:
        # First attempt: treat as a Supabase token (aud='authenticated')
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM],
            audience=SUPABASE_AUDIENCE,
        )
        return payload
    except JWTError:
        pass

    try:
        # Second attempt: treat as a backend-issued token (no aud claim)
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM],
        )
        return payload
    except JWTError:
        return None
