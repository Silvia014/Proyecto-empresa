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
    """
    Validate one incident according to the CSV context.

    Returns a list of validation errors.
    """
    errors = []

    if (
        not record.get("location_id")
        or record["location_id"] not in VALID_LOCATIONS
    ):
        errors.append("missing_location_id")

    if (
        not record.get("category")
        or record["category"] not in VALID_CATEGORIES
    ):
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
