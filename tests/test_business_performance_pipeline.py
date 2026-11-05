from data.pipelines.pipeline import aggregate_weekly_location_kpis


def _transform(data):
    return aggregate_weekly_location_kpis.fn(data)


def test_aggregates_costs_and_uses_location_reference_for_country_currency():
    data = {
        "locations": [{
            "id": "CO-MDE-01",
            "country": "Colombia",
            "currency": "COP",
        }],
        "events": [
            {
                "event_id": "purchase-1",
                "event_type": "inbound_order_created",
                "event_timestamp": "2026-11-02T10:00:00Z",
                "properties": {
                    "location_id": "CO-MDE-01",
                    "quantity": 2,
                    "unit_cost": 10000,
                    "total_cost": 20000,
                },
            },
            {
                "event_id": "waste-1",
                "event_type": "stock_waste_registered",
                "event_timestamp": "2026-11-03T10:00:00Z",
                "properties": {
                    "location_id": "CO-MDE-01",
                    "unit_cost": 10000,
                    "total_cost": 5000,
                },
            },
            {
                "event_id": "stockout-1",
                "event_type": "stock_threshold_triggered",
                "event_timestamp": "2026-11-03T11:00:00Z",
                "properties": {"location_id": "CO-MDE-01"},
            },
            {
                "event_id": "price-1",
                "event_type": "ingredient_price_variance_detected",
                "event_timestamp": "2026-11-03T12:00:00Z",
                "properties": {"location_id": "CO-MDE-01"},
            },
        ],
    }

    result = _transform(data)
    assert result["rows_rejected"] == 0
    assert result["rows"][0]["country"] == "CO"
    assert result["rows"][0]["currency"] == "COP"
    assert result["rows"][0]["week_start"] == "2026-11-02"
    assert result["rows"][0]["total_purchase_cost"] == 20000.0
    assert result["rows"][0]["total_waste_cost"] == 5000.0
    assert result["rows"][0]["waste_ratio"] == 0.25
    assert result["rows"][0]["stockout_events_count"] == 1
    assert result["rows"][0]["price_alert_events_count"] == 1


def test_invalid_cost_blocks_only_affected_location_week():
    data = {
        "locations": [
            {"id": "CO-MDE-01", "country": "Colombia", "currency": "COP"},
            {"id": "US-MIA-01", "country": "USA", "currency": "USD"},
        ],
        "events": [
            {
                "event_id": "bad-purchase",
                "event_type": "inbound_order_created",
                "event_timestamp": "2026-11-02T10:00:00Z",
                "properties": {"location_id": "CO-MDE-01"},
            },
            {
                "event_id": "valid-us-stockout",
                "event_type": "stock_threshold_triggered",
                "event_timestamp": "2026-11-02T11:00:00Z",
                "properties": {"location_id": "US-MIA-01"},
            },
        ],
    }

    result = _transform(data)
    assert result["rows_rejected"] == 1
    assert len(result["rows"]) == 1
    assert result["rows"][0]["location_id"] == "US-MIA-01"
    assert result["blocked_location_weeks"] == [
        {"location_id": "CO-MDE-01", "week_start": "2026-11-02"}
    ]


def test_outbound_and_demo_events_are_skipped():
    data = {
        "locations": [{"id": "US-MIA-01", "country": "USA", "currency": "USD"}],
        "events": [
            {
                "event_id": "outbound",
                "event_type": "outbound_order_created",
                "event_timestamp": "2026-11-02T10:00:00Z",
                "properties": {"location_id": "US-MIA-01"},
            },
            {
                "event_id": "demo",
                "event_type": "stock_threshold_triggered",
                "event_timestamp": "2026-11-02T11:00:00Z",
                "properties": {"location_id": "US-MIA-01", "demo_record": True},
            },
        ],
    }
    result = _transform(data)
    assert result["rows"] == []
    assert result["rows_rejected"] == 0
    assert result["rows_skipped"] == 2
def test_rejects_country_currency_mismatch():
    data = {
        "locations": [
            {
                "id": "CO-MDE-01",
                "country": "Colombia",
                "currency": "USD",
            }
        ],
        "events": [
            {
                "event_id": "invalid-currency",
                "event_type": "stock_threshold_triggered",
                "event_timestamp": "2026-11-02T10:00:00Z",
                "properties": {
                    "location_id": "CO-MDE-01",
                },
            }
        ],
    }

    result = _transform(data)

    assert result["rows"] == []
    assert result["rows_rejected"] == 1
    assert result["blocked_location_weeks"] == [
        {
            "location_id": "CO-MDE-01",
            "week_start": "2026-11-02",
        }
    ]
    assert "Invalid country/currency combination" in (
        result["quality_issues"][0]
    )