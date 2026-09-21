#!/usr/bin/env python3

import csv
import sys
from collections import Counter


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
    Validate one incident according to CONTEXT.md.

    Returns a list of validation errors.
    """
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


def analyse_csv(file_path):
    """
    Read and analyse the incidents CSV.

    Returns a dictionary containing the complete analysis.
    """

    records = []

    with open(file_path, "r", encoding="utf-8", newline="") as csv_file:
        reader = csv.DictReader(csv_file)

        if reader.fieldnames is None:
            raise ValueError("CSV file does not contain a header.")

        missing_fields = REQUIRED_FIELDS - set(reader.fieldnames)

        if missing_fields:
            raise ValueError(
                "Missing required fields: "
                + ", ".join(sorted(missing_fields))
            )

        for row in reader:
            records.append(row)

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
        record["category"] for record in valid_records
    )

    status_counts = Counter(
        record["status"] for record in valid_records
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
        "invalid_counts": invalid_counts,
        "categories": category_counts,
        "statuses": status_counts,
        "closed_records": len(closed_records),
        "satisfaction_scores": satisfaction_counts,
        "satisfaction_count": len(satisfaction_scores),
        "satisfaction_average": satisfaction_average,
        "invalid_records": invalid_records,
    }


def percentage(value, total):
    if total == 0:
        return 0

    return value / total * 100


def print_analysis(results, source_file):
    """
    Print the analysis in a human-readable format.
    """

    print("=" * 60)
    print("  BRASALAND — INCIDENT REPORT ANALYSIS")
    print(f"  Source file: {source_file}")
    print("=" * 60)

    print()

    print(f"TOTAL RECORDS IN FILE .......... {results['total']}")
    print(f"  ├─ Valid records .............. {results['valid']}")
    print(f"  └─ Invalid / incomplete ....... {results['invalid']}")

    print()

    print("INVALID RECORDS BREAKDOWN")
    print(
        f"  ├─ Missing location_id ......... "
        f"{results['invalid_counts']['missing_location_id']}"
    )
    print(
        f"  ├─ Invalid or missing category . "
        f"{results['invalid_counts']['invalid_category']}"
    )
    print(
        f"  ├─ Empty description ........... "
        f"{results['invalid_counts']['empty_description']}"
    )
    print(
        f"  └─ Closed case, no score ....... "
        f"{results['invalid_counts']['closed_without_score']}"
    )

    print()

    print("BREAKDOWN BY CATEGORY (valid records)")

    category_order = [
        "CUSTOMER_COMPLAINT",
        "EQUIPMENT",
        "SUPPLY",
        "FOOD_QUALITY",
        "STAFF",
    ]

    for index, category in enumerate(category_order):
        prefix = "└─" if index == len(category_order) - 1 else "├─"

        count = results["categories"][category]

        print(
            f"  {prefix} {category:<22} "
            f"{count:>3} "
            f"({percentage(count, results['valid']):.1f}%)"
        )

    print()

    print("BREAKDOWN BY STATUS (valid records)")

    status_order = [
        "OPEN",
        "CLOSED",
        "DISCARDED",
    ]

    for index, status in enumerate(status_order):
        prefix = "└─" if index == len(status_order) - 1 else "├─"

        count = results["statuses"][status]

        print(
            f"  {prefix} {status:<25} "
            f"{count:>3} "
            f"({percentage(count, results['valid']):.1f}%)"
        )

    print()

    print("SATISFACTION INDEX (closed cases)")
    print(
        f"  Scored cases: "
        f"{results['satisfaction_count']} "
        f"of {results['closed_records']}"
    )

    print(
        f"  Average score: "
        f"{results['satisfaction_average']:.2f} / 5.00"
    )

    score_labels = {
        1: "Very dissatisfied",
        2: "Dissatisfied",
        3: "Neutral",
        4: "Satisfied",
        5: "Very satisfied",
    }

    for score in range(1, 6):
        prefix = "└─" if score == 5 else "├─"

        print(
            f"  {prefix} Score {score} "
            f"({score_labels[score]:<17}) "
            f"{results['satisfaction_scores'][score]}"
        )

    print()

    print("=" * 60)


def export_results(results, output_file="results.csv"):
    """
    Export the main metrics as one row per metric.
    """

    valid_total = results["valid"]

    rows = [
        {
            "metric": "total_records",
            "value": results["total"],
            "percentage": "",
        },
        {
            "metric": "valid_records",
            "value": results["valid"],
            "percentage": percentage(
                results["valid"],
                results["total"],
            ),
        },
        {
            "metric": "invalid_records",
            "value": results["invalid"],
            "percentage": percentage(
                results["invalid"],
                results["total"],
            ),
        },
    ]

    for category, count in results["categories"].items():
        rows.append(
            {
                "metric": f"category_{category}",
                "value": count,
                "percentage": percentage(
                    count,
                    valid_total,
                ),
            }
        )

    for status, count in results["statuses"].items():
        rows.append(
            {
                "metric": f"status_{status}",
                "value": count,
                "percentage": percentage(
                    count,
                    valid_total,
                ),
            }
        )

    rows.append(
        {
            "metric": "satisfaction_average",
            "value": f"{results['satisfaction_average']:.2f}",
            "percentage": "",
        }
    )

    with open(
        output_file,
        "w",
        encoding="utf-8",
        newline="",
    ) as csv_file:

        fieldnames = [
            "metric",
            "value",
            "percentage",
        ]

        writer = csv.DictWriter(
            csv_file,
            fieldnames=fieldnames,
        )

        writer.writeheader()
        writer.writerows(rows)

    print(f"\nResults exported to: {output_file}")


def main():
    if len(sys.argv) != 2:
        print(
            "Usage: python3 scripts/analyze.py "
            "scripts/incidents-brasaland.csv"
        )
        sys.exit(1)

    file_path = sys.argv[1]

    try:
        results = analyse_csv(file_path)

        print_analysis(
            results,
            file_path,
        )

        answer = input(
            "Export results to CSV? [y / n]: "
        ).strip().lower()

        if answer == "y":
            export_results(results)

    except FileNotFoundError:
        print(f"Error: file not found: {file_path}")
        sys.exit(1)

    except ValueError as error:
        print(f"Error: {error}")
        sys.exit(1)

    except OSError as error:
        print(f"Error reading file: {error}")
        sys.exit(1)


if __name__ == "__main__":
    main()
