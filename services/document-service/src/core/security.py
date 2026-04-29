"""JWT decode / encode utilities."""

from datetime import datetime, timedelta

import jwt

from src.core.config import settings
from src.core.exceptions import (
    JWTExpiredError,
    JWTInvalidAlgorithmError,
    JWTSignatureError,
)

_ALGORITHM = "HS256"
_ALLOWED = ["HS256"]


def decode_token(token: str) -> dict:
    """
    Decode and validate a JWT.

    Raises:
        JWTInvalidAlgorithmError: alg=none or unknown algorithm
        JWTExpiredError: token has expired
        JWTSignatureError: signature mismatch or malformed token
    """
    try:
        header = jwt.get_unverified_header(token)
    except jwt.DecodeError:
        raise JWTSignatureError()

    if header.get("alg", "") == "none":
        raise JWTInvalidAlgorithmError()
    if header.get("alg") not in _ALLOWED:
        raise JWTInvalidAlgorithmError()

    try:
        payload = jwt.decode(
            token,
            settings.SUPABASE_JWT_SECRET,
            algorithms=_ALLOWED,
        )
    except jwt.ExpiredSignatureError:
        raise JWTExpiredError()
    except jwt.ImmatureSignatureError:
        # Token has a future iat — PyJWT raises this since v2.4
        raise JWTSignatureError()
    except (jwt.InvalidSignatureError, jwt.DecodeError):
        raise JWTSignatureError()

    return payload


def create_test_token(user_id: str, *, expired: bool = False) -> str:
    """Generate a signed JWT for use in tests only."""
    now = datetime.utcnow()
    payload = {
        "sub": user_id,
        "iat": now,
        "exp": (now - timedelta(hours=1)) if expired else (now + timedelta(hours=1)),
    }
    return jwt.encode(payload, settings.SUPABASE_JWT_SECRET, algorithm=_ALGORITHM)
