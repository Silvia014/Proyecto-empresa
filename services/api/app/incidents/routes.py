from fastapi import APIRouter, HTTPException, Query
from pydantic import ValidationError
from typing import Optional

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


@router.post("", response_model=Incident, status_code=201)
def create_incident_endpoint(incident_data: IncidentCreate):
    try:
        return create_incident(incident_data)
    except ValidationError as error:
        raise HTTPException(
            status_code=400,
            detail=error.errors(),
        )


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


@router.get("/summary")
def incident_summary():
    incidents = list_incidents()

    return {
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

    return updated_incident