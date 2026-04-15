"""Auth Service — FastAPI Application."""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.presentation.api.v1.auth_router import router as auth_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("[Auth Service] Starting up")
    yield
    print("[Auth Service] Shutting down")


app = FastAPI(title="Rambot Auth Service", version="1.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
app.include_router(auth_router, prefix="/api/v1/auth", tags=["Auth"])


@app.get("/health")
async def health():
    return {"status": "ok", "service": "auth-service"}
