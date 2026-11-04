from datetime import date
import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel, ConfigDict

from app.auth.supabase_dependencies import get_current_inventory_user
from data.pipelines.pipeline import (
    get_latest_pipeline_run,
    get_weekly_location_performance,
    trigger_weekly_location_cost_waste_flow,
)

router = APIRouter(prefix="/reporting", tags=["Reporting"])


class PipelineRunRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    week_start: date | None = None


def _run_pipeline_in_background(week_start: str | None, run_id: str):
    trigger_weekly_location_cost_waste_flow(
        week_start=week_start,
        trigger_source="manual",
        run_id=run_id,
    )


@router.get("/pipeline-runs/latest")
def latest_pipeline_run(
    current_user=Depends(get_current_inventory_user),
):
    try:
        return {"run": get_latest_pipeline_run()}
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail="Reporting run history is temporarily unavailable.",
        ) from exc


@router.post("/pipeline-runs", status_code=202)
def trigger_pipeline_run(
    request: PipelineRunRequest,
    background_tasks: BackgroundTasks,
    current_user=Depends(get_current_inventory_user),
):
    if request.week_start and request.week_start.weekday() != 0:
        raise HTTPException(
            status_code=400,
            detail="week_start must be a Monday.",
        )

    run_id = str(uuid.uuid4())
    week_start = request.week_start.isoformat() if request.week_start else None
    background_tasks.add_task(
        _run_pipeline_in_background,
        week_start,
        run_id,
    )
    return {
        "status": "accepted",
        "run_id": run_id,
        "week_start": week_start,
        "trigger_source": "manual",
    }


@router.get("/weekly-location-performance")
def weekly_location_performance(
    week_start: date | None = None,
    location_id: str | None = None,
    country: str | None = None,
    limit: int = 100,
    current_user=Depends(get_current_inventory_user),
):
    if week_start and week_start.weekday() != 0:
        raise HTTPException(
            status_code=400,
            detail="week_start must be a Monday.",
        )
    if limit < 1 or limit > 1000:
        raise HTTPException(
            status_code=400,
            detail="limit must be between 1 and 1000.",
        )
    if country and country.upper() not in {"CO", "US"}:
        raise HTTPException(
            status_code=400,
            detail="country must be CO or US.",
        )

    try:
        return get_weekly_location_performance(
            week_start=week_start,
            location_id=location_id,
            country=country,
            limit=limit,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail="Weekly location performance is temporarily unavailable.",
        ) from exc
