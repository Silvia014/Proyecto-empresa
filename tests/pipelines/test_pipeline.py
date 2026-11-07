from decimal import Decimal

from data.pipelines.pipeline import (
    aggregate_weekly_location_metrics,
    calculate_weekly_location_kpis,
    validate_weekly_location_events,
)


def test_validate_weekly_location_events_normalizes_valid_event():
    extracted = {
        "locations": [{"id": "bogota-1", "country": "CO", "currency": "COP"}],
        "events": [{
            "event_id": "event-1",
            "event_timestamp": "2026-11-03T10:00:00Z",
            "event_type": "inbound_order_created",
            "properties": {
                "location_id": "bogota-1",
                "unit_cost": "10",
                "total_cost": "100",
            },
            "properties_invalid": False,
        }],
    }

    result = validate_weekly_location_events.fn(extracted)

    assert result["events"][0]["week_start"] == "2026-11-02"
    assert result["events"][0]["total_cost"] == Decimal("100")
    assert result["quality_issues"] == []


def test_aggregate_weekly_location_metrics_sums_costs_and_counts():
    validated = {
        "events": [
            {
                "location_id": "bogota-1",
                "week_start": "2026-11-02",
                "country": "CO",
                "currency": "COP",
                "event_type": "inbound_order_created",
                "total_cost": Decimal("100"),
            },
            {
                "location_id": "bogota-1",
                "week_start": "2026-11-02",
                "country": "CO",
                "currency": "COP",
                "event_type": "stock_waste_registered",
                "total_cost": Decimal("25"),
            },
            {
                "location_id": "bogota-1",
                "week_start": "2026-11-02",
                "country": "CO",
                "currency": "COP",
                "event_type": "stock_threshold_triggered",
                "total_cost": None,
            },
            {
                "location_id": "bogota-1",
                "week_start": "2026-11-02",
                "country": "CO",
                "currency": "COP",
                "event_type": "ingredient_price_variance_detected",
                "total_cost": None,
            },
        ],
        "blocked_location_weeks": [],
        "quality_issues": [],
        "quality_warnings": [],
        "rows_skipped": 0,
        "duplicate_event_count": 0,
        "missing_event_id_count": 0,
    }

    result = aggregate_weekly_location_metrics.fn(validated)
    row = result["aggregates"][0]

    assert row["total_purchase_cost"] == Decimal("100")
    assert row["total_waste_cost"] == Decimal("25")
    assert row["stockout_events_count"] == 1
    assert row["price_alert_events_count"] == 1
    assert result["rows_processed"] == 4


def test_calculate_weekly_location_kpis_computes_waste_ratio():
    aggregated = {
        "aggregates": [{
            "location_id": "bogota-1",
            "country": "CO",
            "week_start": "2026-11-02",
            "currency": "COP",
            "total_purchase_cost": Decimal("100"),
            "total_waste_cost": Decimal("25"),
            "stockout_events_count": 1,
            "price_alert_events_count": 2,
        }],
        "rows_processed": 4,
        "blocked_location_weeks": [],
        "quality_issues": [],
        "quality_warnings": [],
        "rows_skipped": 0,
        "duplicate_event_count": 0,
        "missing_event_id_count": 0,
    }

    result = calculate_weekly_location_kpis.fn(aggregated)
    row = result["rows"][0]

    assert row["waste_ratio"] == 0.25
    assert row["total_purchase_cost"] == 100.0
    assert row["total_waste_cost"] == 25.0


def test_validate_weekly_location_events_rejects_event_without_id():
    extracted = {
        "locations": [],
        "events": [{
            "event_id": None,
            "event_timestamp": "2026-11-03T10:00:00Z",
            "event_type": "inbound_order_created",
            "properties": {},
            "properties_invalid": False,
        }],
    }

    result = validate_weekly_location_events.fn(extracted)

    assert result["events"] == []
    assert result["missing_event_id_count"] == 1
    assert result["quality_issues"] == [
        "Event rejected because event_id is missing."
    ]