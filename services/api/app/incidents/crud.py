from datetime import datetime, timezone
from typing import Optional

from ..database import incidents_table
from .models import Incident, IncidentCreate, IncidentStatus


def create_incident(incident_data: IncidentCreate) -> Incident:
    now = datetime.now(timezone.utc)

    incident = Incident(
        id=0,
        title=incident_data.title,
        description=incident_data.description,
        category=incident_data.category,
        status=IncidentStatus.OPEN,
        origin=incident_data.origin,
        branch=incident_data.branch,
        created_at=now,
        updated_at=now,
    )

    data = incident.model_dump(mode="json")
    data.pop("id")

    incident_id = incidents_table.insert(data)

    return Incident(
        id=incident_id,
        **data,
    )


def get_incident(incident_id: int) -> Optional[Incident]:
    record = incidents_table.get(doc_id=incident_id)

    if record is None:
        return None

    return Incident(
        id=record.doc_id,
        **record,
    )


def list_incidents(
    status: Optional[IncidentStatus] = None,
    origin: Optional[str] = None,
    branch: Optional[str] = None,
    category: Optional[str] = None,
) -> list[Incident]:
    records = incidents_table.all()

    incidents = [
        Incident(
            id=record.doc_id,
            **record,
        )
        for record in records
    ]

    if status is not None:
        incidents = [
            incident
            for incident in incidents
            if incident.status == status
        ]

    if origin is not None:
        incidents = [
            incident
            for incident in incidents
            if incident.origin.value == origin
        ]

    if branch is not None:
        incidents = [
            incident
            for incident in incidents
            if incident.branch == branch
        ]

    if category is not None:
        incidents = [
            incident
            for incident in incidents
            if incident.category.value == category
        ]

    return incidents


def update_incident_status(
    incident_id: int,
    new_status: IncidentStatus,
) -> Optional[Incident]:
    record = incidents_table.get(doc_id=incident_id)

    if record is None:
        return None

    updated_at = datetime.now(timezone.utc).isoformat()

    incidents_table.update(
        {
            "status": new_status.value,
            "updated_at": updated_at,
        },
        doc_ids=[incident_id],
    )

    return get_incident(incident_id)
