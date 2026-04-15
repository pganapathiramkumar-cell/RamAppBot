from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str


@router.get("", response_model=HealthResponse)
async def health_check():
    return HealthResponse(status="ok", service="api-gateway", version="1.0.0")


@router.get("/live")
async def liveness():
    return {"alive": True}


@router.get("/ready")
async def readiness():
    return {"ready": True}
