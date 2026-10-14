
from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Session, select

from ..database import engine
from .models import (
    Incident,
    IncidentCategory,
    IncidentCreate,
    IncidentOrigin,
    IncidentRecord,
    IncidentStatus,
)


def _to_incident(record: IncidentRecord) -> Incident:
    return Incident(
        id=record.id,
        title=record.title,
        description=record.description,
        category=IncidentCategory(record.category),
        status=IncidentStatus(record.status),
        origin=IncidentOrigin(record.origin),
        branch=record.branch,
        created_at=record.created_at,
        updated_at=record.updated_at,
    )


def create_incident(incident_data: IncidentCreate) -> Incident:
    now = datetime.now(timezone.utc)

    record = IncidentRecord(
        title=incident_data.title,
        description=incident_data.description,
        category=incident_data.category.value,
        status=IncidentStatus.OPEN.value,
        origin=incident_data.origin.value,
        branch=incident_data.branch,
        created_at=now,
        updated_at=now,
    )

    with Session(engine) as session:
        session.add(record)
        session.commit()
        session.refresh(record)
        return _to_incident(record)


def get_incident(incident_id: int) -> Optional[Incident]:
    with Session(engine) as session:
        record = session.get(IncidentRecord, incident_id)
        return _to_incident(record) if record else None


def list_incidents(
    status: Optional[IncidentStatus] = None,
    origin: Optional[str] = None,
    branch: Optional[str] = None,
    category: Optional[str] = None,
) -> list[Incident]:
    statement = select(IncidentRecord)

    if status is not None:
        statement = statement.where(
            IncidentRecord.status == status.value
        )
    if origin is not None:
        statement = statement.where(IncidentRecord.origin == origin)
    if branch is not None:
        statement = statement.where(IncidentRecord.branch == branch)
    if category is not None:
        statement = statement.where(IncidentRecord.category == category)

    with Session(engine) as session:
        records = session.exec(statement).all()
        return [_to_incident(record) for record in records]


def update_incident_status(
    incident_id: int,
    new_status: IncidentStatus,
) -> Optional[Incident]:
    with Session(engine) as session:
        record = session.get(IncidentRecord, incident_id)

        if record is None:
            return None

        record.status = new_status.value
        record.updated_at = datetime.now(timezone.utc)

        session.add(record)
        session.commit()
        session.refresh(record)

        return _to_incident(record)
