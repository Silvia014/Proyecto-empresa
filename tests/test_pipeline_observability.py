from __future__ import annotations

import json
from contextlib import contextmanager
from datetime import datetime, timezone

from data.pipelines import pipeline


def _sample_source_data():
    return {
        "rows_extracted": 3,
        "locations": [
            {"id": "CO-MDE-01", "country": "Colombia", "currency": "COP"},
            {"id": "US-MIA-01", "country": "USA", "currency": "USD"},
            {"id": "US-ORL-02", "country": "USA", "currency": "USD"},
        ],
        "events": [
            {
                "event_id": "purchase-1",
                "event_type": "inbound_order_created",
                "event_timestamp": "2026-11-02T10:00:00Z",
                "properties": {
                    "location_id": "CO-MDE-01",
                    "unit_cost": 100,
                    "total_cost": 200,
                },
            },
            {
                "event_id": "outbound-1",
                "event_type": "outbound_order_created",
                "event_timestamp": "2026-11-02T11:00:00Z",
                "properties": {"location_id": "CO-MDE-01"},
            },
            {
                "event_id": "bad-timestamp",
                "event_type": "stock_threshold_triggered",
                "event_timestamp": "not-a-date",
                "properties": {"location_id": "US-MIA-01"},
            },
        ],
    }


def test_source_metrics_capture_event_counts_location_coverage_and_watermarks():
    metrics = pipeline.build_source_metrics(_sample_source_data())

    assert metrics["rows_extracted"] == 3
    assert metrics["event_type_counts"]["inbound_order_created"] == 1
    assert metrics["event_type_counts"]["outbound_order_created"] == 1
    assert metrics["event_type_counts"]["stock_threshold_triggered"] == 1
    assert metrics["distinct_location_count"] == 2
    assert metrics["distinct_locations_seen"] == ["CO-MDE-01", "US-MIA-01"]
    assert metrics["expected_location_count"] == 3
    assert metrics["locations_without_events"] == ["US-ORL-02"]
    assert metrics["max_event_timestamp_by_location_type"]["CO-MDE-01"][
        "inbound_order_created"
    ] == "2026-11-02T10:00:00+00:00"
    assert metrics["invalid_timestamp_count"] == 1
    # The source does not expose a drop counter; unknown must not become zero.
    assert metrics["dropped_event_count"] is None
    assert metrics["drop_signal_available"] is False


def test_source_metrics_include_transform_quality_details():
    transformed = {
        "rows_processed": 4,
        "rows_rejected": 2,
        "rows_skipped": 1,
        "duplicate_event_count": 1,
        "missing_event_id_count": 1,
        "quality_issues": ["invalid cost"],
        "quality_warnings": ["duplicate ignored"],
        "blocked_location_weeks": [
            {"location_id": "CO-MDE-01", "week_start": "2026-11-02"}
        ],
        "transform_revision": "test-revision",
    }

    metrics = pipeline.build_source_metrics(_sample_source_data(), transformed)

    assert metrics["rows_processed"] == 4
    assert metrics["rows_rejected"] == 2
    assert metrics["rows_skipped"] == 1
    assert metrics["duplicate_event_count"] == 1
    assert metrics["missing_event_id_count"] == 1
    assert metrics["quality_issues"] == ["invalid cost"]
    assert metrics["blocked_location_weeks"] == transformed[
        "blocked_location_weeks"
    ]
    assert metrics["transform_revision"] == "test-revision"


def test_transform_counts_duplicates_and_rejects_missing_event_ids():
    data = {
        "locations": [
            {"id": "CO-MDE-01", "country": "Colombia", "currency": "COP"}
        ],
        "events": [
            {
                "event_id": "stock-1",
                "event_type": "stock_threshold_triggered",
                "event_timestamp": "2026-11-02T10:00:00Z",
                "properties": {"location_id": "CO-MDE-01"},
            },
            {
                "event_id": "stock-1",
                "event_type": "stock_threshold_triggered",
                "event_timestamp": "2026-11-02T10:00:00Z",
                "properties": {"location_id": "CO-MDE-01"},
            },
            {
                "event_id": None,
                "event_type": "stock_threshold_triggered",
                "event_timestamp": "2026-11-02T10:00:00Z",
                "properties": {"location_id": "CO-MDE-01"},
            },
        ],
    }

    result = pipeline.aggregate_weekly_location_kpis.fn(data)

    assert result["rows_processed"] == 1
    assert result["rows_skipped"] == 1
    assert result["rows_rejected"] == 1
    assert result["duplicate_event_count"] == 1
    assert result["missing_event_id_count"] == 1
    assert result["rows"][0]["stockout_events_count"] == 1
    assert any("event_id is missing" in issue for issue in result["quality_issues"])


class _RecordingConnection:
    def __init__(self):
        self.calls = []

    def execute(self, statement, parameters=None):
        self.calls.append((str(statement), parameters or {}))
        return None


class _RecordingEngine:
    def __init__(self):
        self.connection = _RecordingConnection()

    @contextmanager
    def begin(self):
        yield self.connection


def test_pipeline_audit_serializes_source_metrics_for_jsonb(monkeypatch):
    engine = _RecordingEngine()
    monkeypatch.setattr(pipeline, "get_engine", lambda: engine)
    metrics = {
        "rows_extracted": 7,
        "event_type_counts": {"inbound_order_created": 2},
        "dropped_event_count": None,
    }

    pipeline.save_pipeline_run.fn(
        run_id="12345678-1234-5678-1234-567812345678",
        week_start="2026-11-02",
        started_at=datetime(2026, 11, 5, 10, 0, tzinfo=timezone.utc),
        status="completed",
        watermark_from=datetime(2026, 10, 12, tzinfo=timezone.utc),
        watermark_to=datetime(2026, 11, 9, tzinfo=timezone.utc),
        source_metrics=metrics,
    )

    assert len(engine.connection.calls) == 1
    sql, parameters = engine.connection.calls[0]
    assert "CAST(:source_metrics AS JSONB)" in sql
    assert json.loads(parameters["source_metrics"]) == metrics


def test_blocked_location_week_delete_is_executed_even_without_valid_rows(
    monkeypatch,
):
    engine = _RecordingEngine()
    monkeypatch.setattr(pipeline, "get_engine", lambda: engine)

    loaded = pipeline.upsert_weekly_location_performance.fn(
        rows=[],
        blocked_location_weeks=[
            {"location_id": "CO-MDE-01", "week_start": "2026-11-02"}
        ],
    )

    assert loaded == 0
    assert len(engine.connection.calls) == 1
    sql, parameters = engine.connection.calls[0]
    assert "DELETE FROM reporting.weekly_location_performance" in sql
    assert parameters == {
        "location_id": "CO-MDE-01",
        "week_start": "2026-11-02",
    }
