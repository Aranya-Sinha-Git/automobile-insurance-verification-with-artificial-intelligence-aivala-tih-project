"""Small server-side authentication boundary for the evidence gateway.

Firebase Admin verification is used when it is configured.  Local development
can explicitly opt out; production must set AIVALA_AUTH_REQUIRED=1.
"""
from __future__ import annotations

import os
import json
from typing import Any

from fastapi import HTTPException


_REVOCATION_CHECK_AVAILABLE: bool | None = None


def _truthy(value: str | None) -> bool:
    return (value or "").strip().lower() in {"1", "true", "yes", "on"}


def _firebase_project_id() -> str:
    return os.getenv("FIREBASE_PROJECT_ID", "aivala-15349").strip()


def _initialize_firebase() -> bool:
    """Initialize Firebase and return whether revocation checks are available.

    Verifying an ID-token signature only needs Firebase's public signing keys and
    the project ID. Checking revocation additionally calls the Firebase Admin
    user API, which requires a service account or Application Default Credentials.
    """
    global _REVOCATION_CHECK_AVAILABLE

    import firebase_admin  # type: ignore
    from firebase_admin import credentials  # type: ignore

    try:
        firebase_admin.get_app()
        if _REVOCATION_CHECK_AVAILABLE is None:
            # An app initialized outside this module is expected to be a managed
            # Firebase Admin app and therefore supports revocation checks.
            _REVOCATION_CHECK_AVAILABLE = True
        return _REVOCATION_CHECK_AVAILABLE
    except ValueError:
        pass

    project_id = _firebase_project_id()
    options = {"projectId": project_id} if project_id else None
    service_account = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON", "").strip()
    if service_account:
        firebase_admin.initialize_app(
            credentials.Certificate(json.loads(service_account)),
            options=options,
        )
        _REVOCATION_CHECK_AVAILABLE = True
        return True

    if _truthy(os.getenv("FIREBASE_USE_ADC")):
        firebase_admin.initialize_app(options=options)
        _REVOCATION_CHECK_AVAILABLE = True
        return True

    # Local tunnel development often has no Google ADC configured. Anonymous
    # credentials are sufficient for public-key ID-token verification; they are
    # deliberately not treated as sufficient for revocation checks.
    from google.auth.credentials import AnonymousCredentials  # type: ignore

    firebase_admin.initialize_app(AnonymousCredentials(), options=options)
    _REVOCATION_CHECK_AVAILABLE = False
    return False


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

        check_revoked = _initialize_firebase()
        decoded = auth.verify_id_token(token, check_revoked=check_revoked)
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Authentication token is invalid or expired.") from exc
    return {"uid": str(decoded.get("uid", "")), "operator": bool(decoded.get("operator") or decoded.get("admin"))}


def require_operator(authorization: str | None) -> dict[str, Any]:
    identity = verify_bearer(authorization)
    if not identity.get("operator"):
        raise HTTPException(status_code=403, detail="Operator access is required.")
    return identity
