"""JWT auth middleware — validates Bearer tokens on protected routes."""

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse
from jose import JWTError, jwt

from src.config.settings import settings

PUBLIC_PATHS = {"/health", "/health/live", "/health/ready", "/docs", "/redoc", "/openapi.json", "/api/v1/auth/login", "/api/v1/auth/register", "/api/v1/auth/refresh"}


class AuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.url.path in PUBLIC_PATHS or request.url.path.startswith("/health"):
            return await call_next(request)

        authorization = request.headers.get("Authorization", "")
        if not authorization.startswith("Bearer "):
            return JSONResponse({"detail": "Missing or invalid Authorization header"}, status_code=401)

        token = authorization.removeprefix("Bearer ").strip()
        try:
            payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
            request.state.user_id = payload.get("sub")
            request.state.organization_id = payload.get("org_id")
            request.state.roles = payload.get("roles", [])
        except JWTError:
            return JSONResponse({"detail": "Invalid or expired token"}, status_code=401)

        return await call_next(request)
