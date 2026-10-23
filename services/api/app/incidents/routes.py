from fastapi import APIRouter, HTTPException, Query
from pydantic import ValidationError
from typing import Optional
from threading import Lock
from time import monotonic

from .crud import (
    create_incident,
    get_incident,
    list_incidents,
    update_incident_status,
)
from .models import (
    Incident,
    IncidentCategory,
    IncidentCreate,
    IncidentOrigin,
    IncidentStatus,
    IncidentSummaryResponse,
)


router = APIRouter(prefix="/api/incidents", tags=["incidents"])


VALID_TRANSITIONS = {
    IncidentStatus.OPEN: {
        IncidentStatus.IN_PROGRESS,
        IncidentStatus.DISCARDED,
    },
    IncidentStatus.IN_PROGRESS: {
        IncidentStatus.RESOLVED,
        IncidentStatus.DISCARDED,
    },
    IncidentStatus.RESOLVED: set(),
    IncidentStatus.DISCARDED: set(),
}

SUMMARY_CACHE_TTL = 30
_summary_cache = {"expires_at": 0.0, "data": None}
_summary_cache_lock = Lock()


def invalidate_summary_cache():
    with _summary_cache_lock:
        _summary_cache["expires_at"] = 0.0
        _summary_cache["data"] = None

@router.post("", response_model=Incident, status_code=201)
def create_incident_endpoint(incident_data: IncidentCreate):
    try:
        incident = create_incident(incident_data)
    except ValidationError as error:
        raise HTTPException(
            status_code=400,
            detail=error.errors(),
        )

    invalidate_summary_cache()
    return incident

@router.get("", response_model=list[Incident])
def list_incidents_endpoint(
    status: Optional[IncidentStatus] = Query(default=None),
    origin: Optional[IncidentOrigin] = Query(default=None),
    branch: Optional[str] = Query(default=None),
    category: Optional[IncidentCategory] = Query(default=None),
):
    return list_incidents(
        status=status,
        origin=origin.value if origin else None,
        branch=branch,
        category=category.value if category else None,
    )


@router.get("/summary", response_model=IncidentSummaryResponse)
def incident_summary():
    now = monotonic()

    with _summary_cache_lock:
        if (
            _summary_cache["data"] is not None
            and now < _summary_cache["expires_at"]
        ):
            return _summary_cache["data"]

    incidents = list_incidents()

    summary = {
        "total": len(incidents),
        "by_status": {
            status.value: sum(
                1 for incident in incidents if incident.status == status
            )
            for status in IncidentStatus
        },
        "by_origin": {
            origin.value: sum(
                1 for incident in incidents if incident.origin == origin
            )
            for origin in IncidentOrigin
        },
        "by_category": {
            category.value: sum(
                1 for incident in incidents if incident.category == category
            )
            for category in IncidentCategory
        },
    }

    with _summary_cache_lock:
        _summary_cache["data"] = summary
        _summary_cache["expires_at"] = monotonic() + SUMMARY_CACHE_TTL

    return summary

@router.get("/{incident_id}", response_model=Incident)
def get_incident_endpoint(incident_id: int):
    incident = get_incident(incident_id)

    if incident is None:
        raise HTTPException(
            status_code=404,
            detail="Incident not found",
        )

    return incident


@router.patch("/{incident_id}/status", response_model=Incident)
def update_status_endpoint(
    incident_id: int,
    status: IncidentStatus,
):
    incident = get_incident(incident_id)

    if incident is None:
        raise HTTPException(
            status_code=404,
            detail="Incident not found",
        )

    allowed_statuses = VALID_TRANSITIONS[incident.status]

    if status not in allowed_statuses:
        raise HTTPException(
            status_code=400,
            detail={
                "field": "status",
                "message": (
                    f"Cannot change status from "
                    f"'{incident.status.value}' to '{status.value}'."
                ),
            },
        )

    updated_incident = update_incident_status(
        incident_id,
        status,
    )
    invalidate_summary_cache()


    return updated_incident