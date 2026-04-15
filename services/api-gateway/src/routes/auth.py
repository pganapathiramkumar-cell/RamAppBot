"""Reverse-proxy routes: API Gateway → Auth Service."""

from fastapi import APIRouter, Request, Response
import httpx

from src.config.settings import settings

router = APIRouter()
_client = httpx.AsyncClient(base_url=settings.AUTH_SERVICE_URL, timeout=15.0)


@router.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE"])
async def auth_proxy(path: str, request: Request):
    url = f"/api/v1/auth/{path}"
    body = await request.body()
    upstream = await _client.request(
        method=request.method,
        url=url,
        headers={k: v for k, v in request.headers.items() if k.lower() != "host"},
        params=request.query_params,
        content=body,
    )
    return Response(content=upstream.content, status_code=upstream.status_code, headers=dict(upstream.headers))
