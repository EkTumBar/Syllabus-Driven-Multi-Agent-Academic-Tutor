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

    Uses HS256 algorithm and options={"verify_aud": False} to accept
    both Supabase Auth tokens (aud="authenticated") and backend-issued tokens.
    Logs debug information on any failure so the exact cause appears in Render logs.
    """
    algorithm = settings.JWT_ALGORITHM or "HS256"
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[algorithm],
            options={"verify_aud": False},
        )
        return payload
    except Exception as e:
        print(f"JWT Decode Error: {e}")
        return None

