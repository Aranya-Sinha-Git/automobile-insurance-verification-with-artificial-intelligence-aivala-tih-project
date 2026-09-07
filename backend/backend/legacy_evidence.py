"""Receipt helpers shared by the gateway and the forensic database.

Receipts deliberately are not a sixth forensic layer.  They bind an already
completed decision to the evidence and are written by the caller's transaction.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import os
from datetime import datetime, timezone
from typing import Any

from fraud_pipeline import _connect as _connect_pipeline


def canonical_json(value: Any) -> str:
    """Stable JSON representation used for signing and later verification."""
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def _connect() -> Any:
    connection = _connect_pipeline()
    connection.execute(
        """CREATE TABLE IF NOT EXISTS audit_receipts (
            claim_id TEXT PRIMARY KEY,
            receipt TEXT NOT NULL,
            algorithm TEXT NOT NULL,
            key_id TEXT,
            payload_json TEXT NOT NULL,
            created_at TEXT NOT NULL
        )"""
    )
    columns = {row[1] for row in connection.execute("PRAGMA table_info(audit_receipts)")}
    if "key_id" not in columns:
        connection.execute("ALTER TABLE audit_receipts ADD COLUMN key_id TEXT")
    return connection


def generate_audit_receipt(
    claim_id: str, payload: dict[str, Any], *, connection: Any | None = None
) -> dict[str, str]:
    """Create and persist a versioned receipt without silently replacing one.

    A configured secret produces a HMAC receipt.  Unsigned development digests
    are retained only as explicitly-labelled SHA-256 receipts.
    """
    serialized = canonical_json(payload)
    secret = os.getenv("AIVALA_AUDIT_SECRET", "").encode("utf-8")
    key_id = os.getenv("AIVALA_AUDIT_KEY_ID", "").strip() or None
    if secret:
        algorithm = "HMAC-SHA256"
        receipt = hmac.new(secret, serialized.encode("utf-8"), hashlib.sha256).hexdigest()
    else:
        algorithm = "SHA-256-UNSIGNED-DEVELOPMENT"
        receipt = hashlib.sha256(serialized.encode("utf-8")).hexdigest()

    owns_connection = connection is None
    conn = connection or _connect()
    try:
        existing = conn.execute(
            "SELECT receipt, algorithm, key_id, payload_json FROM audit_receipts WHERE claim_id = ?",
            (claim_id,),
        ).fetchone()
        if existing:
            if existing[3] != serialized:
                raise ValueError("claim_id is already finalized with different evidence")
            return {"receipt": existing[0], "algorithm": existing[1], "key_id": existing[2] or ""}
        conn.execute(
            "INSERT INTO audit_receipts (claim_id, receipt, algorithm, key_id, payload_json, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (claim_id, receipt, algorithm, key_id, serialized, datetime.now(timezone.utc).isoformat()),
        )
        if owns_connection:
            conn.commit()
        return {"receipt": receipt, "algorithm": algorithm, "key_id": key_id or ""}
    finally:
        if owns_connection:
            conn.close()
