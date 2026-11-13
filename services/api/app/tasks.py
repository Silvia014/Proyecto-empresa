from celery.result import AsyncResult
from fastapi import APIRouter, Depends

from app.auth.supabase_dependencies import get_current_inventory_user
from services.celery_app import celery_app


router = APIRouter(prefix="/tasks", tags=["Tasks"])


@router.get("/{task_id}")
def get_task_status(
    task_id: str,
    current_user=Depends(get_current_inventory_user),
):
    task = AsyncResult(task_id, app=celery_app)

    status = {
        "PENDING": "pending",
        "RECEIVED": "pending",
        "RETRY": "pending",
        "STARTED": "started",
        "SUCCESS": "success",
        "FAILURE": "failure",
        "REVOKED": "failure",
    }.get(task.state, "pending")

    result = None
    if status == "success":
        result = task.result
    elif status == "failure":
        result = {"error": str(task.result)}

    return {
        "task_id": task_id,
        "status": status,
        "result": result,
    }