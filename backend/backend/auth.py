"""Small server-side authentication boundary for the evidence gateway.

Firebase Admin verification is used when it is configured.  Local development
can explicitly opt out; production must set AIVALA_AUTH_REQUIRED=1.
"""
from __future__ import annotations

import os
from typing import Any

from fastapi import HTTPException


def _required() -> bool:
    return os.getenv("AIVALA_AUTH_REQUIRED", "false").lower() in {"1", "true", "yes"}


def verify_bearer(authorization: str | None) -> dict[str, Any]:
    if not _required():
        return {"uid": "local-development", "operator": True}
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication is required.")
    token = authorization.removeprefix("Bearer ").strip()
    try:
        from firebase_admin import auth  # type: ignore
        decoded = auth.verify_id_token(token, check_revoked=True)
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Authentication token is invalid or expired.") from exc
    return {"uid": str(decoded.get("uid", "")), "operator": bool(decoded.get("operator") or decoded.get("admin"))}


def require_operator(authorization: str | None) -> dict[str, Any]:
    identity = verify_bearer(authorization)
    if not identity.get("operator"):
        raise HTTPException(status_code=403, detail="Operator access is required.")
    return identity
