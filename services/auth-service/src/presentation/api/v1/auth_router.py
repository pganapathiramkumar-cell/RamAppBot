"""Auth API endpoints: login, register, refresh, me."""

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, EmailStr

router = APIRouter()


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    organization_id: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int = 3600


class RefreshRequest(BaseModel):
    refresh_token: str


@router.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest):
    # TODO: inject LoginUseCase
    raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="DI not wired yet")


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(request: RegisterRequest):
    # TODO: inject RegisterUseCase
    raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="DI not wired yet")


@router.post("/refresh", response_model=TokenResponse)
async def refresh(request: RefreshRequest):
    # TODO: inject RefreshTokenUseCase
    raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="DI not wired yet")


@router.get("/me")
async def me():
    # TODO: extract user from JWT via dependency
    raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="DI not wired yet")
