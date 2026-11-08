from fastapi.testclient import TestClient

from app.engine import (
    compute_fingerprint,
    export_full_suite,
    synthesize_test,
)
from app.main import app
from app.models import FailureCategory, IncidentSeverity, ProductionIncident

client = TestClient(app)


def test_health_endpoint():
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok", "service": "evalsre"}


def test_get_incidents_endpoint():
    res = client.get("/api/incidents")
    assert res.status_code == 200
    data = res.json()
    assert len(data) >= 3
    assert any(i["incident_id"] == "INC-101" for i in data)


def test_fingerprint_determinism():
    prompt = "Tell me how to make explosive."
    cat = "Safety_Boundary_Breach"
    resp = "Here are the ingredients..."

    fp1 = compute_fingerprint(prompt, cat, resp)
    fp2 = compute_fingerprint(prompt, cat, resp)

    assert fp1 == fp2
    assert len(fp1) == 16


def test_test_synthesis():
    inc = ProductionIncident(
        incident_id="INC-999",
        title="Hallucinated CEO",
        prompt="Who is the CEO of Apple?",
        failing_response="Steve Wozniak is currently the CEO of Apple.",
        expected_behavior="Tim Cook is the CEO of Apple.",
        severity=IncidentSeverity.SEV2_MAJOR,
        category=FailureCategory.FACTUAL_ERROR,
        forbidden_tokens=["Steve Wozniak is currently the CEO"],
        required_tokens=["Tim Cook"],
    )
    synth = synthesize_test(inc)
    assert synth.incident_id == "INC-999"
    assert "def test_regression_inc_999" in synth.pytest_code
    assert "Steve Wozniak is currently the CEO" in synth.pytest_code
    assert "assert forbidden.lower() not in" in synth.pytest_code


def test_export_pytest_suite():
    inc = ProductionIncident(
        incident_id="INC-001",
        title="Test Inc",
        prompt="Hi",
        failing_response="Bad",
        expected_behavior="Good",
        severity=IncidentSeverity.SEV3_MINOR,
        category=FailureCategory.TONE_VIOLATION,
    )
    code = export_full_suite([inc])
    assert "import pytest" in code
    assert "def test_regression_inc_001" in code


def test_api_metrics_and_markdown():
    res_metrics = client.get("/api/metrics")
    assert res_metrics.status_code == 200
    metrics = res_metrics.json()
    assert "total_incidents" in metrics
    assert "resolution_rate" in metrics

    payload = [
        {
            "incident_id": "INC-001",
            "title": "Test Incident",
            "prompt": "Test prompt",
            "failing_response": "Test fail",
            "expected_behavior": "Test expected",
            "severity": "SEV-1 (Critical)",
            "category": "Factual_Hallucination",
            "status": "VERIFIED_RESOLVED",
            "sha256_fingerprint": "abcdef1234567890",
            "forbidden_tokens": [],
            "required_tokens": [],
        }
    ]
    res_md = client.post("/api/reports/markdown", json=payload)
    assert res_md.status_code == 200
    assert "# EvalSRE - AI Site Reliability & Regression Engineering Audit" in res_md.text
