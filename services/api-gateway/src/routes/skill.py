"""Reverse-proxy routes: API Gateway → Skill Service."""

from fastapi import APIRouter, Request, Response
import httpx

from src.config.settings import settings

router = APIRouter()
_client = httpx.AsyncClient(base_url=settings.SKILL_SERVICE_URL, timeout=30.0)


async def _proxy(request: Request, path: str) -> Response:
    url = f"/api/v1/skill{path}"
    body = await request.body()
    upstream = await _client.request(
        method=request.method,
        url=url,
        headers={k: v for k, v in request.headers.items() if k.lower() != "host"},
        params=request.query_params,
        content=body,
    )
    return Response(content=upstream.content, status_code=upstream.status_code, headers=dict(upstream.headers))


@router.api_route("/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
async def skill_proxy(path: str, request: Request):
    return await _proxy(request, f"/{path}" if path else "")
