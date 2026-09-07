"""Conservative SQLite inventory and merge utility for AIVALA security data.

It never moves or overwrites a database.  ``--apply`` inserts only primary-key
rows that are absent at the destination and reports conflicts for review.
"""
from __future__ import annotations

import argparse
import json
import shutil
import sqlite3
from pathlib import Path
from typing import Any

from fraud_pipeline import _get_canonical_db_path


def inventory(path: Path) -> dict[str, Any]:
    if not path.is_file():
        return {"path": str(path), "exists": False}
    with sqlite3.connect(f"file:{path.as_posix()}?mode=ro", uri=True) as connection:
        tables = [row[0] for row in connection.execute("SELECT name FROM sqlite_master WHERE type='table'")]
        return {"path": str(path), "exists": True, "integrity": connection.execute("PRAGMA integrity_check").fetchone()[0], "tables": {table: connection.execute(f"SELECT COUNT(*) FROM [{table}]").fetchone()[0] for table in tables}}


def merge(source: Path, destination: Path, apply: bool) -> dict[str, Any]:
    report = {"source": inventory(source), "destination": inventory(destination), "inserted": 0, "conflicts": []}
    if not source.is_file():
        return report
    destination.parent.mkdir(parents=True, exist_ok=True)
    if not destination.exists() and apply:
        shutil.copy2(source, destination)
        report["copied"] = True
        return report
    if not destination.exists():
        report["would_copy"] = True
        return report
    with sqlite3.connect(source) as src, sqlite3.connect(destination) as dst:
        src_rows = src.execute("SELECT claim_id, frame_index, file_sha256, phash, created_at FROM evidence_fingerprints").fetchall()
        for row in src_rows:
            current = dst.execute("SELECT file_sha256, phash FROM evidence_fingerprints WHERE claim_id=? AND frame_index=?", row[:2]).fetchone()
            if current and current != (row[2], row[3]):
                report["conflicts"].append({"claim_id": row[0], "frame_index": row[1]})
            elif not current and apply:
                # Schema-aware copy: only columns present in both databases are transferred.
                dst.execute("INSERT INTO evidence_fingerprints (claim_id, frame_index, file_sha256, phash, created_at) VALUES (?, ?, ?, ?, ?)", row)
                report["inserted"] += 1
        if apply:
            dst.commit()
    return report


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--destination", type=Path, default=_get_canonical_db_path())
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    print(json.dumps(merge(args.source, args.destination, args.apply), indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
