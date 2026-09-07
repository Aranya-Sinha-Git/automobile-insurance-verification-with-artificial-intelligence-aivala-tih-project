#!/usr/bin/env python3
"""AIVALA Video Audit CLI Tool.

Usage:
    python3 process_video.py <path_to_video> [claim_id]
"""

import sys
import os
from pathlib import Path

# Use the canonical backend implementation.
ROOT_DIR = Path(__file__).resolve().parent

# Auto-include .venv site-packages if present
venv_site = ROOT_DIR / ".venv" / "lib" / f"python{sys.version_info.major}.{sys.version_info.minor}" / "site-packages"
if venv_site.exists() and str(venv_site) not in sys.path:
    sys.path.insert(0, str(venv_site))

sys.path.insert(0, str(ROOT_DIR / "backend" / "backend"))

from fraud_pipeline import (
    AivalaFraudPipeline,
    fingerprint_video,
    get_all_historical_fingerprints,
    get_all_historical_phashes,
    store_fingerprint,
)

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 process_video.py <path_to_video> [claim_id] [location]")
        print("Example: python3 process_video.py demo/1.mp4 CLM-101 'Mumbai, India'")
        sys.exit(1)

    video_path = sys.argv[1]
    claim_id = sys.argv[2] if len(sys.argv) > 2 else "CLM-LOCAL-VIDEO"
    location = sys.argv[3] if len(sys.argv) > 3 else None

    if not os.path.exists(video_path):
        print(f"Error: Video file not found at '{video_path}'")
        sys.exit(1)

    print("=" * 60)
    print("         AIVALA 5-LAYER FRAUD DETECTION AUDIT")
    print("=" * 60)
    print(f"• Video File : {os.path.basename(video_path)}")
    print(f"• Full Path  : {os.path.abspath(video_path)}")
    print(f"• Claim ID   : {claim_id}")
    if location:
        print(f"• Location   : {location}")
    print("-" * 60)
    print("Running 5-layer forensic analysis...")

    pipeline = AivalaFraudPipeline()
    historical_db = get_all_historical_fingerprints()
    result = pipeline.run_5_layer_audit(video_path, historical_db, declared_location=location)


    print("-" * 60)
    if result.get("passed"):
        print("• Status  : APPROVED_AUTHENTIC")
        print(f"• pHash   : {result.get('phash')}")
        print("• Message : All 5 forensic layers passed successfully")
        
        # Save fingerprint to database to prevent future duplicate submissions
        try:
            fp = fingerprint_video(video_path)
            store_fingerprint(claim_id, fp)
            print(f"• Database: Fingerprint saved for Claim '{claim_id}' (Duplicate shield ACTIVE)")
        except Exception as store_err:
            print(f"• Database Warning: Unable to persist fingerprint: {store_err}")
    else:
        print("• Status       : REJECTED_FRAUD")
        print(f"• Failed Layer : Layer {result.get('failed_layer')}")
        print(f"• Reason       : {result.get('reason')}")

    print("=" * 60)

if __name__ == "__main__":
    main()
