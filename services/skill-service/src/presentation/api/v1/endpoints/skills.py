"""
Skill API Endpoints — fully wired via FastAPI Depends.
All use cases are injected; no stubs or 501 placeholders.
"""

from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status

from src.application.commands.skill_commands import (
    CreateSkillCommand,
    UpdateSkillMetricsCommand,
)
from src.application.queries.get_skills import GetSkillByIdQuery, GetSkillsQuery, SearchSkillsQuery
from src.application.use_cases.approve_skill import ApproveSkillUseCase
from src.application.use_cases.create_skill import CreateSkillUseCase
from src.application.use_cases.deploy_skill import DeploySkillUseCase
from src.application.use_cases.deprecate_skill import DeprecateSkillUseCase
from src.application.use_cases.submit_skill_for_review import SubmitSkillForReviewUseCase
from src.application.use_cases.update_skill_metrics import UpdateSkillMetricsUseCase
from src.dependencies import (
    get_approve_use_case,
    get_create_use_case,
    get_deploy_use_case,
    get_deprecate_use_case,
    get_skill_by_id_query,
    get_skills_query,
    get_search_query,
    get_submit_review_use_case,
    get_update_metrics_use_case,
)
from src.domain.entities.skill import SkillCategory, SkillStatus
from src.presentation.schemas.skill_schemas import (
    CreateSkillRequest,
    SkillResponse,
    UpdateSkillMetricsRequest,
)

router = APIRouter()


@router.post("", response_model=SkillResponse, status_code=status.HTTP_201_CREATED, summary="Create a new Skill")
async def create_skill(
    request: CreateSkillRequest,
    use_case: CreateSkillUseCase = Depends(get_create_use_case),
):
    command = CreateSkillCommand(
        name=request.name,
        description=request.description,
        category=request.category,
        organization_id=request.organization_id,
        created_by=request.created_by,
        proficiency_level=request.proficiency_level,
        tags=request.tags,
        metadata=request.metadata,
    )
    dto = await use_case.execute(command)
    return SkillResponse.from_dto(dto)


@router.get("", response_model=List[SkillResponse], summary="List Skills for an organization")
async def list_skills(
    organization_id: UUID = Query(...),
    category: Optional[SkillCategory] = Query(None),
    skill_status: Optional[SkillStatus] = Query(None, alias="status"),
    search: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    list_query: GetSkillsQuery = Depends(get_skills_query),
    search_query: SearchSkillsQuery = Depends(get_search_query),
):
    if search:
        dtos = await search_query.execute(query=search, organization_id=organization_id)
    else:
        dtos = await list_query.execute(
            organization_id=organization_id,
            category=category,
            status=skill_status,
            limit=limit,
            offset=offset,
        )
    return [SkillResponse.from_dto(d) for d in dtos]


@router.get("/{skill_id}", response_model=SkillResponse, summary="Get a Skill by ID")
async def get_skill(
    skill_id: UUID,
    query: GetSkillByIdQuery = Depends(get_skill_by_id_query),
):
    dto = await query.execute(skill_id)
    if dto is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Skill not found")
    return SkillResponse.from_dto(dto)


@router.post("/{skill_id}/submit-review", response_model=SkillResponse, summary="Submit Skill for review")
async def submit_for_review(
    skill_id: UUID,
    use_case: SubmitSkillForReviewUseCase = Depends(get_submit_review_use_case),
):
    try:
        dto = await use_case.execute(skill_id)
    except ValueError as exc:
        detail = str(exc)
        code = status.HTTP_404_NOT_FOUND if "not found" in detail else status.HTTP_422_UNPROCESSABLE_ENTITY
        raise HTTPException(status_code=code, detail=detail)
    return SkillResponse.from_dto(dto)


@router.post("/{skill_id}/approve", response_model=SkillResponse, summary="Approve a Skill")
async def approve_skill(
    skill_id: UUID,
    use_case: ApproveSkillUseCase = Depends(get_approve_use_case),
):
    try:
        dto = await use_case.execute(skill_id)
    except ValueError as exc:
        detail = str(exc)
        code = status.HTTP_404_NOT_FOUND if "not found" in detail else status.HTTP_422_UNPROCESSABLE_ENTITY
        raise HTTPException(status_code=code, detail=detail)
    return SkillResponse.from_dto(dto)


@router.post("/{skill_id}/deploy", response_model=SkillResponse, summary="Deploy a Skill")
async def deploy_skill(
    skill_id: UUID,
    use_case: DeploySkillUseCase = Depends(get_deploy_use_case),
):
    try:
        dto = await use_case.execute(skill_id)
    except ValueError as exc:
        detail = str(exc)
        code = status.HTTP_404_NOT_FOUND if "not found" in detail else status.HTTP_422_UNPROCESSABLE_ENTITY
        raise HTTPException(status_code=code, detail=detail)
    return SkillResponse.from_dto(dto)


@router.patch("/{skill_id}/metrics", response_model=SkillResponse, summary="Update Skill AI metrics")
async def update_metrics(
    skill_id: UUID,
    request: UpdateSkillMetricsRequest,
    use_case: UpdateSkillMetricsUseCase = Depends(get_update_metrics_use_case),
):
    command = UpdateSkillMetricsCommand(
        skill_id=skill_id,
        accuracy_score=request.accuracy_score,
        latency_ms=request.latency_ms,
    )
    try:
        dto = await use_case.execute(command)
    except ValueError as exc:
        detail = str(exc)
        code = status.HTTP_404_NOT_FOUND if "not found" in detail else status.HTTP_422_UNPROCESSABLE_ENTITY
        raise HTTPException(status_code=code, detail=detail)
    return SkillResponse.from_dto(dto)


@router.delete("/{skill_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Deprecate a Skill")
async def deprecate_skill(
    skill_id: UUID,
    reason: str = Query("Deprecated by administrator"),
    use_case: DeprecateSkillUseCase = Depends(get_deprecate_use_case),
):
    try:
        await use_case.execute(skill_id, reason=reason)
    except ValueError as exc:
        detail = str(exc)
        code = status.HTTP_404_NOT_FOUND if "not found" in detail else status.HTTP_422_UNPROCESSABLE_ENTITY
        raise HTTPException(status_code=code, detail=detail)
