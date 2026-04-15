"""
Presentation Layer: Steer Goals API Endpoints
All use cases are injected via FastAPI Depends — no stubs.
"""

from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status

from src.application.commands.steer_commands import CreateSteerGoalCommand, UpdateSteerGoalCommand
from src.application.queries.get_steer_goals import GetSteerGoalByIdQuery, GetSteerGoalsQuery
from src.application.use_cases.activate_steer_goal import ActivateSteerGoalUseCase
from src.application.use_cases.complete_steer_goal import CompleteSteerGoalUseCase
from src.application.use_cases.create_steer_goal import CreateSteerGoalUseCase
from src.application.use_cases.update_steer_goal import UpdateSteerGoalUseCase
from src.dependencies import (
    get_activate_use_case,
    get_by_id_query,
    get_complete_use_case,
    get_create_use_case,
    get_list_query,
    get_update_use_case,
)
from src.domain.entities.steer_goal import SteerGoalStatus, SteerGoalType
from src.presentation.schemas.steer_schemas import (
    CreateSteerGoalRequest,
    SteerGoalResponse,
    UpdateSteerGoalRequest,
)

router = APIRouter()


@router.post(
    "",
    response_model=SteerGoalResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new Steer Goal",
)
async def create_steer_goal(
    request: CreateSteerGoalRequest,
    use_case: CreateSteerGoalUseCase = Depends(get_create_use_case),
):
    command = CreateSteerGoalCommand(
        title=request.title,
        description=request.description,
        goal_type=request.goal_type,
        priority=request.priority,
        owner_id=request.owner_id,
        organization_id=request.organization_id,
        target_date=request.target_date,
        success_criteria=request.success_criteria,
    )
    result = await use_case.execute(command)
    return SteerGoalResponse.from_dto(result)


@router.get(
    "",
    response_model=List[SteerGoalResponse],
    summary="List Steer Goals for an organization",
)
async def list_steer_goals(
    organization_id: UUID = Query(...),
    goal_status: Optional[SteerGoalStatus] = Query(None, alias="status"),
    goal_type: Optional[SteerGoalType] = Query(None),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    query: GetSteerGoalsQuery = Depends(get_list_query),
):
    dtos = await query.execute(
        organization_id=organization_id,
        status=goal_status,
        goal_type=goal_type,
        limit=limit,
        offset=offset,
    )
    return [SteerGoalResponse.from_dto(d) for d in dtos]


@router.get("/{goal_id}", response_model=SteerGoalResponse, summary="Get a Steer Goal by ID")
async def get_steer_goal(
    goal_id: UUID,
    query: GetSteerGoalByIdQuery = Depends(get_by_id_query),
):
    dto = await query.execute(goal_id)
    if dto is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found")
    return SteerGoalResponse.from_dto(dto)


@router.patch("/{goal_id}", response_model=SteerGoalResponse, summary="Update a Steer Goal")
async def update_steer_goal(
    goal_id: UUID,
    request: UpdateSteerGoalRequest,
    use_case: UpdateSteerGoalUseCase = Depends(get_update_use_case),
):
    command = UpdateSteerGoalCommand(
        goal_id=goal_id,
        title=request.title,
        description=request.description,
        priority=request.priority,
        target_date=request.target_date,
        success_criteria=request.success_criteria,
    )
    try:
        dto = await use_case.execute(command)
    except ValueError as exc:
        detail = str(exc)
        code = status.HTTP_404_NOT_FOUND if "not found" in detail else status.HTTP_422_UNPROCESSABLE_ENTITY
        raise HTTPException(status_code=code, detail=detail)
    return SteerGoalResponse.from_dto(dto)


@router.post("/{goal_id}/activate", response_model=SteerGoalResponse, summary="Activate a Steer Goal")
async def activate_steer_goal(
    goal_id: UUID,
    use_case: ActivateSteerGoalUseCase = Depends(get_activate_use_case),
):
    try:
        dto = await use_case.execute(goal_id)
    except ValueError as exc:
        detail = str(exc)
        code = status.HTTP_404_NOT_FOUND if "not found" in detail else status.HTTP_422_UNPROCESSABLE_ENTITY
        raise HTTPException(status_code=code, detail=detail)
    return SteerGoalResponse.from_dto(dto)


@router.post("/{goal_id}/complete", response_model=SteerGoalResponse, summary="Complete a Steer Goal")
async def complete_steer_goal(
    goal_id: UUID,
    use_case: CompleteSteerGoalUseCase = Depends(get_complete_use_case),
):
    try:
        dto = await use_case.execute(goal_id)
    except ValueError as exc:
        detail = str(exc)
        code = status.HTTP_404_NOT_FOUND if "not found" in detail else status.HTTP_422_UNPROCESSABLE_ENTITY
        raise HTTPException(status_code=code, detail=detail)
    return SteerGoalResponse.from_dto(dto)
