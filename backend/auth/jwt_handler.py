from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
import bcrypt
import jwt
from jwt import PyJWKClient, PyJWKClientError, PyJWTError
from fastapi import HTTPException, status
from config import settings

SUPABASE_AUDIENCE = "authenticated"

_jwks_client: Optional[PyJWKClient] = None


def get_jwks_client() -> Optional[PyJWKClient]:
    """Returns a singleton PyJWKClient configured for Supabase JWKS with 5s timeout and 10m cache."""
    global _jwks_client
    if _jwks_client is None:
        supabase_url = (settings.SUPABASE_URL or "").rstrip("/")
        if not supabase_url:
            return None
        jwks_url = f"{supabase_url}/auth/v1/.well-known/jwks.json"
        _jwks_client = PyJWKClient(
            jwks_url,
            cache_jwk_set=True,
            lifespan=600,   # ~10 minute cache TTL
            timeout=5,       # 5 second timeout
        )
    return _jwks_client


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
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM or "HS256")
    return encoded_jwt


def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    """Decodes and validates a JWT access token.

    For Supabase tokens:
      - Uses PyJWKClient to fetch public keys from f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json"
      - 5s HTTP timeout and ~10 minute TTL cache
      - Selects key by token header kid (auto-refetches once if missing)
      - Verifies algorithms=["ES256"], audience="authenticated", and issuer
      - Raises clean 401 HTTPException if verification or key fetch fails

    For backend-issued tokens (e.g., local login/tests without kid):
      - Verifies signature against backend JWT_SECRET with HS256
    """
    clean_401 = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials or token expired",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        header = jwt.get_unverified_header(token)
    except Exception as e:
        print(f"JWT Header Parse Error: {e}")
        raise clean_401

    kid = header.get("kid")
    alg = header.get("alg")

    # Supabase ES256 tokens carry a kid header and/or alg='ES256'
    if kid or alg == "ES256":
        client = get_jwks_client()
        if client is None:
            print("JWKS Error: SUPABASE_URL not configured")
            raise clean_401

        try:
            signing_key = client.get_signing_key_from_jwt(token)
        except (PyJWKClientError, Exception) as e:
            print(f"JWKS Key Fetch Error: {e}")
            raise clean_401

        supabase_url = (settings.SUPABASE_URL or "").rstrip("/")
        expected_issuers = [
            f"{supabase_url}/auth/v1",
            "supabase",
        ]

        try:
            payload = jwt.decode(
                token,
                signing_key.key,
                algorithms=["ES256"],
                audience="authenticated",
                issuer=expected_issuers,
            )
            return payload
        except PyJWTError as e:
            print(f"JWT ES256 Verification Error: {e}")
            raise clean_401

    # Fallback for backend-issued HS256 tokens (login / tests)
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=["HS256"],
            options={"verify_aud": False},
        )
        return payload
    except PyJWTError as e:
        print(f"Backend JWT HS256 Verification Error: {e}")
        raise clean_401
