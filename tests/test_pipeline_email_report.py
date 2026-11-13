from data.pipelines import pipeline


def test_weekly_report_defaults_to_owner_email(monkeypatch):
    monkeypatch.delenv("REPORT_EMAIL_TO", raising=False)
    assert pipeline.get_report_recipients() == ["roldansilvi@gmail.com"]


def test_weekly_report_email_uses_owner_and_summary(monkeypatch):
    monkeypatch.setenv("REPORT_EMAIL_TO", "roldansilvi@gmail.com")
    payload = pipeline.build_weekly_report_email(
        week_start="2026-11-02",
        status="completed",
        rows_loaded=42,
        rows_rejected=0,
        source_metrics={"locations_seen": 14, "countries": ["CO", "US"]},
    )

    assert payload["to"] == ["roldansilvi@gmail.com"]
    assert "2026-11-02" in payload["subject"]
    assert "42" in payload["html"]
    assert "14" in payload["text"]
