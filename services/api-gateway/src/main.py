"""
Rambot Enterprise - API Gateway
Central entry point: routing, auth, rate-limiting, observability.
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from src.config.settings import settings
from src.middleware.auth import AuthMiddleware
from src.middleware.rate_limiter import RateLimitMiddleware
from src.middleware.logging import LoggingMiddleware
from src.routes import steer, skill, auth, health, document


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print(f"[API Gateway] Starting on {settings.HOST}:{settings.PORT}")
    yield
    # Shutdown
    print("[API Gateway] Shutting down")


app = FastAPI(
    title="Rambot Enterprise API Gateway",
    description="Unified gateway for Steer & Skill AI Platform",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.ENVIRONMENT != "production" else None,
    redoc_url="/redoc" if settings.ENVIRONMENT != "production" else None,
)

# ─── Middleware (order matters — outermost first) ─────────────────────────────
app.add_middleware(LoggingMiddleware)
app.add_middleware(RateLimitMiddleware)
app.add_middleware(AuthMiddleware)
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Routes ──────────────────────────────────────────────────────────────────
app.include_router(health.router, prefix="/health", tags=["Health"])
app.include_router(auth.router, prefix="/api/v1/auth", tags=["Auth"])
app.include_router(steer.router, prefix="/api/v1/steer", tags=["Steer"])
app.include_router(skill.router, prefix="/api/v1/skill", tags=["Skill"])
app.include_router(document.router, prefix="/api/v1/documents", tags=["Documents"])
