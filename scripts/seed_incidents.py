import csv
from datetime import datetime, timezone
from pathlib import Path

from packages.shared.validation import validate_record
from services.api.app.database import incidents_table
from services.api.app.incidents.models import (
    Incident,
    IncidentCreate,
    IncidentOrigin,
    IncidentStatus,
)


CSV_PATH = Path("scripts/incidents-brasaland.csv")


CATEGORY_MAPPING = {
    "CUSTOMER_COMPLAINT": "customer_complaint",
    "EQUIPMENT": "equipment_failure",
    "SUPPLY": "supply_issue",
    "FOOD_QUALITY": "customer_complaint",
    "STAFF": "staff_issue",
}

STATUS_MAPPING = {
    "OPEN": "open",
    "CLOSED": "resolved",
    "DISCARDED": "discarded",
}

BRANCH_MAPPING = {
    "COL-01": "medellin_centro",
    "COL-02": "medellin_laureles",
    "COL-03": "medellin_envigado",
    "COL-04": "medellin_bello",
    "COL-05": "medellin_itagui",
    "COL-06": "bogota_chapinero",
    "COL-07": "bogota_usaquen",
    "COL-08": "cali_granada",
    "COL-09": "barranquilla_norte",
    "COL-10": "central",
    "FLA-01": "miami_doral",
    "FLA-02": "miami_hialeah",
    "FLA-03": "miami_kendall",
    "FLA-04": "orlando_international",
}


def parse_created_at(date_value: str) -> datetime:
    return datetime.strptime(
        date_value, "%Y-%m-%d"
    ).replace(tzinfo=timezone.utc)


def build_incident(row: dict) -> IncidentCreate:
    description = row["description"]
    title = description[:120].strip()

    return IncidentCreate(
        title=title,
        description=description,
        category=CATEGORY_MAPPING[row["category"]],
        origin=IncidentOrigin.CUSTOMER,
        branch=BRANCH_MAPPING.get(row["location_id"], "central"),
    )


def seed_incidents() -> None:
    inserted = 0
    skipped = 0
    invalid = 0

    existing_records = incidents_table.all()

    # Recover source IDs for records that were inserted by the
    # previous version of this seed script.
    unmatched_records = list(existing_records)
    source_ids = set()

    with CSV_PATH.open(newline="", encoding="utf-8") as csv_file:
        rows = list(csv.DictReader(csv_file))

    for row in rows:
        if validate_record(row):
            continue

        try:
            incident_data = build_incident(row)
            created_at = parse_created_at(row["date"])
        except (KeyError, ValueError):
            continue

        matching_record = None

        for record in unmatched_records:
            if (
                record.get("description") == incident_data.description
                and record.get("created_at") == created_at.isoformat()
                and record.get("branch") == incident_data.branch
            ):
                matching_record = record
                break

        if matching_record is not None:
            incidents_table.update(
                {"_source_incident_id": row["incident_id"]},
                doc_ids=[matching_record.doc_id],
            )
            source_ids.add(row["incident_id"])
            unmatched_records.remove(matching_record)

    for row in rows:
        errors = validate_record(row)

        if errors:
            invalid += 1
            print(
                f"SKIPPED {row.get('incident_id', 'unknown')}: "
                f"{', '.join(errors)}"
            )
            continue

        incident_id = row["incident_id"]

        if incident_id in source_ids:
            skipped += 1
            print(f"SKIPPED {incident_id}: already seeded")
            continue

        try:
            incident_data = build_incident(row)
            created_at = parse_created_at(row["date"])
        except (KeyError, ValueError) as error:
            invalid += 1
            print(f"SKIPPED {incident_id}: {error}")
            continue

        incident = Incident(
            id=0,
            title=incident_data.title,
            description=incident_data.description,
            category=incident_data.category,
            status=IncidentStatus(STATUS_MAPPING[row["status"]]),
            origin=incident_data.origin,
            branch=incident_data.branch,
            created_at=created_at,
            updated_at=created_at,
        )

        data = incident.model_dump(mode="json")
        data.pop("id")

        # Keep the CSV identifier as seed metadata for idempotency.
        data["_source_incident_id"] = incident_id

        incidents_table.insert(data)

        source_ids.add(incident_id)
        inserted += 1

    print("=" * 50)
    print("BRASALAND INCIDENT SEED")
    print("=" * 50)
    print(f"Inserted: {inserted}")
    print(f"Skipped:  {skipped}")
    print(f"Invalid:  {invalid}")
    print("=" * 50)


if __name__ == "__main__":
    seed_incidents()