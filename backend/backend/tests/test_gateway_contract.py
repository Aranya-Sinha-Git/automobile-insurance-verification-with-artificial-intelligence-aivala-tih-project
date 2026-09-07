from __future__ import annotations

import os
import sys
import uuid
from pathlib import Path

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

HERE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(HERE))
os.environ.setdefault("AIVALA_SECURITY_DB", str(Path(__file__).parent / "test-security.sqlite3"))

from fraud_pipeline import AivalaFraudPipeline
from legacy_evidence import canonical_json, generate_audit_receipt
from main import _safe_inference_payload
from main import app
from auth import verify_bearer


def test_serpapi_key_is_not_hard_coded() -> None:
    """Reverse-search credentials must come from the environment, never source."""
    source = (HERE / "fraud_pipeline.py").read_text(encoding="utf-8")
    assert 'serpapi_key: str = "' not in source
    assert 'os.getenv("SERPAPI_KEY", "' not in source


def test_inference_payload_requires_a_detection_list() -> None:
    with pytest.raises(ValueError):
        _safe_inference_payload({"summary": "missing"})
    with pytest.raises(ValueError):
        _safe_inference_payload({"detections": [{"bbox": [1, 2]}]})
    assert _safe_inference_payload({"detections": []}) == {"detections": []}


def test_local_reverse_search_is_truthful_skip() -> None:
    passed, detail = AivalaFraudPipeline().layer_5_reverse_search_hook("does-not-exist.mp4")
    assert passed is True
    assert detail["status"] == "SKIPPED"
    assert detail["evidence"]["external_provider_called"] is False


def test_receipt_canonicalization_and_idempotency(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("AIVALA_AUDIT_SECRET", "test-secret")
    payload = {"b": 2, "a": [1, 2]}
    assert canonical_json(payload) == canonical_json({"a": [1, 2], "b": 2})
    claim_id = f"receipt-{uuid.uuid4()}"
    first = generate_audit_receipt(claim_id, payload)
    second = generate_audit_receipt(claim_id, {"a": [1, 2], "b": 2})
    assert first == second
    with pytest.raises(ValueError):
        generate_audit_receipt(claim_id, {"a": "tampered"})


def test_authentication_is_enforced_when_enabled(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("AIVALA_AUTH_REQUIRED", "true")
    with pytest.raises(HTTPException) as error:
        verify_bearer(None)
    assert error.value.status_code == 401


def test_cors_allows_configured_local_origin() -> None:
    response = TestClient(app).options(
        "/verify-claim/",
        headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "POST"},
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"
