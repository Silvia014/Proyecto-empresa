from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from kombu.exceptions import OperationalError
from pydantic import BaseModel, ConfigDict

from app.auth.supabase_dependencies import get_current_inventory_user
from data.pipelines.pipeline import (
    get_latest_pipeline_run,
    get_weekly_location_performance,
)
from services.tasks import run_weekly_business_report


router = APIRouter(prefix="/reporting", tags=["Reporting"])


class PipelineRunRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    week_start: date | None = None


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
    current_user=Depends(get_current_inventory_user),
):
    if request.week_start and request.week_start.weekday() != 0:
        raise HTTPException(
            status_code=400,
            detail="week_start must be a Monday.",
        )

    week_start = request.week_start.isoformat() if request.week_start else None

    try:
        task = run_weekly_business_report.apply_async(
            kwargs={"week_start": week_start}
        )
    except OperationalError as exc:
        raise HTTPException(
            status_code=503,
            detail="The task queue is unavailable.",
        ) from exc

    return {
        "task_id": task.id,
        "status": "pending",
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