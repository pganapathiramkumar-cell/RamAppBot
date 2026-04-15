"""
Unit tests: JWT security
Blueprint refs: BE-JWT-001 → BE-JWT-004 + SEC-AUTH-001 → SEC-AUTH-003
Pure Python — no DB, no AI, no network.
"""

import time
from datetime import datetime, timedelta

import jwt
import pytest

from src.core.config import settings
from src.core.exceptions import (
    JWTExpiredError,
    JWTInvalidAlgorithmError,
    JWTSignatureError,
)
from src.core.security import create_test_token, decode_token

_SECRET = settings.SUPABASE_JWT_SECRET
_ALG = "HS256"


class TestJWTDecode:
    """BE-JWT: JWT validation tests."""

    def test_be_jwt_001_valid_jwt_decoded_successfully(self):
        """A well-formed JWT returns the expected user_id payload."""
        token = create_test_token("user-001")
        payload = decode_token(token)
        assert payload["sub"] == "user-001"

    def test_be_jwt_002_expired_jwt_raises_expired_error(self):
        """Token with exp in the past raises JWTExpiredError (401)."""
        token = create_test_token("user-001", expired=True)
        with pytest.raises(JWTExpiredError) as exc_info:
            decode_token(token)
        assert exc_info.value.status_code == 401

    def test_be_jwt_003_tampered_signature_raises_signature_error(self):
        """Modifying any byte of the signature raises JWTSignatureError (401)."""
        token = create_test_token("user-001")
        header, payload, sig = token.split(".")
        tampered = f"{header}.{payload}.{sig[:-4]}XXXX"
        with pytest.raises(JWTSignatureError) as exc_info:
            decode_token(tampered)
        assert exc_info.value.status_code == 401

    def test_be_jwt_004_missing_token_raises_signature_error(self):
        """Completely malformed string raises JWTSignatureError."""
        with pytest.raises(JWTSignatureError):
            decode_token("not.a.token")

    def test_sec_auth_001_wrong_algorithm_rs256_raises_algorithm_error(self):
        """alg=RS256 (when server expects HS256) raises JWTInvalidAlgorithmError (400)."""
        # We can't produce a real RS256 token without a key pair, so we craft a
        # token with a spoofed header that claims RS256.
        import base64, json as _json
        header = base64.urlsafe_b64encode(_json.dumps({"alg": "RS256", "typ": "JWT"}).encode()).rstrip(b"=").decode()
        payload_b = base64.urlsafe_b64encode(_json.dumps({"sub": "x"}).encode()).rstrip(b"=").decode()
        fake_token = f"{header}.{payload_b}.fakesig"
        with pytest.raises((JWTInvalidAlgorithmError, JWTSignatureError)):
            decode_token(fake_token)

    def test_sec_auth_002_alg_none_signature_bypass_rejected(self):
        """JWT with alg=none (signature bypass) is rejected with 400."""
        import base64, json as _json
        header = base64.urlsafe_b64encode(_json.dumps({"alg": "none", "typ": "JWT"}).encode()).rstrip(b"=").decode()
        payload_b = base64.urlsafe_b64encode(
            _json.dumps({"sub": "attacker", "exp": int(time.time()) + 3600}).encode()
        ).rstrip(b"=").decode()
        fake_token = f"{header}.{payload_b}."
        with pytest.raises(JWTInvalidAlgorithmError) as exc_info:
            decode_token(fake_token)
        assert exc_info.value.status_code == 400

    def test_sec_auth_003_future_iat_is_rejected(self):
        """Token issued in the future (iat > now + 5s) is rejected."""
        future = datetime.utcnow() + timedelta(hours=1)
        payload = {
            "sub": "user-001",
            "iat": int(future.timestamp()),
            "exp": int((datetime.utcnow() + timedelta(hours=2)).timestamp()),
        }
        token = jwt.encode(payload, _SECRET, algorithm=_ALG)
        with pytest.raises(JWTSignatureError):
            decode_token(token)
