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


SUPABASE_JWT_SECRET = settings.SUPABASE_JWT_SECRET


def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    """Decodes and validates a JWT access token.

    Accepts HS256 tokens with audience='authenticated' (Supabase) as well as
    tokens that specify other standard algorithms or omit the audience claim.
    """
    try:
        try:
            unverified_header = jwt.get_unverified_header(token)
            token_alg = unverified_header.get("alg") or "HS256"
            print(f"JWT Header: {unverified_header}")
        except Exception:
            token_alg = "HS256"

        allowed_algorithms = list(dict.fromkeys(["HS256", token_alg, "RS256", "ES256", "HS384", "HS512"]))

        try:
            payload = jwt.decode(
                token,
                SUPABASE_JWT_SECRET,
                algorithms=allowed_algorithms,
                audience="authenticated",
            )
            return payload
        except JWTError:
            payload = jwt.decode(
                token,
                SUPABASE_JWT_SECRET,
                algorithms=allowed_algorithms,
                options={"verify_aud": False},
            )
            return payload
    except Exception as e:
        print(f"JWT Decode Error: {e}")
        return None


