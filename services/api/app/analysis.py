import csv
from collections import Counter
from io import StringIO


VALID_LOCATIONS = {
    *(f"COL-{i:02d}" for i in range(1, 11)),
    *(f"FLA-{i:02d}" for i in range(1, 5)),
}

VALID_CATEGORIES = {
    "CUSTOMER_COMPLAINT",
    "EQUIPMENT",
    "SUPPLY",
    "FOOD_QUALITY",
    "STAFF",
}

VALID_STATUSES = {
    "OPEN",
    "CLOSED",
    "DISCARDED",
}

REQUIRED_FIELDS = {
    "incident_id",
    "date",
    "location_id",
    "category",
    "description",
    "status",
    "reporter_id",
}


def validate_record(record):
    errors = []

    if not record.get("location_id") or record["location_id"] not in VALID_LOCATIONS:
        errors.append("missing_location_id")

    if not record.get("category") or record["category"] not in VALID_CATEGORIES:
        errors.append("invalid_category")

    description = record.get("description", "").strip()

    if len(description) < 5:
        errors.append("empty_description")

    if not record.get("reporter_id"):
        errors.append("missing_reporter_id")

    status = record.get("status", "").strip()

    if status not in VALID_STATUSES:
        errors.append("invalid_status")

    score = record.get("satisfaction_score", "").strip()

    if status == "CLOSED" and not score:
        errors.append("closed_without_score")

    if score:
        try:
            score_value = int(score)

            if score_value < 1 or score_value > 5:
                errors.append("score_out_of_range")

        except ValueError:
            errors.append("score_out_of_range")

    return errors


def analyse_csv_content(csv_content):
    """
    Analyse CSV content received by the API.
    """

    reader = csv.DictReader(StringIO(csv_content))

    if reader.fieldnames is None:
        raise ValueError("CSV file does not contain a header.")

    missing_fields = REQUIRED_FIELDS - set(reader.fieldnames)

    if missing_fields:
        raise ValueError(
            "Missing required fields: "
            + ", ".join(sorted(missing_fields))
        )

    records = list(reader)

    total_records = len(records)

    valid_records = []
    invalid_records = []

    invalid_counts = Counter()

    for record in records:
        errors = validate_record(record)

        if errors:
            invalid_records.append(
                {
                    "record": record,
                    "errors": errors,
                }
            )

            for error in errors:
                invalid_counts[error] += 1

        else:
            valid_records.append(record)

    category_counts = Counter(
        record["category"]
        for record in valid_records
    )

    status_counts = Counter(
        record["status"]
        for record in valid_records
    )

    closed_records = [
        record
        for record in valid_records
        if record["status"] == "CLOSED"
    ]

    satisfaction_scores = [
        int(record["satisfaction_score"])
        for record in closed_records
        if record["satisfaction_score"].strip()
    ]

    satisfaction_counts = Counter(satisfaction_scores)

    satisfaction_average = (
        sum(satisfaction_scores) / len(satisfaction_scores)
        if satisfaction_scores
        else 0
    )

    return {
        "total": total_records,
        "valid": len(valid_records),
        "invalid": len(invalid_records),
        "invalid_counts": dict(invalid_counts),
        "categories": dict(category_counts),
        "statuses": dict(status_counts),
        "closed_records": len(closed_records),
        "satisfaction_scores": dict(satisfaction_counts),
        "satisfaction_count": len(satisfaction_scores),
        "satisfaction_average": satisfaction_average,
        "invalid_records": invalid_records,
    }
