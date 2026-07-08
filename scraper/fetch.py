"""Fetch the bin collection schedule for a Scottish Borders Council address
from the Bartec Municipal portal and write it to docs/data/collections.json.

Requires env vars SBC_POSTCODE and SBC_UPRN.
"""
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import requests

BASE = "https://scotborders-live-portal.bartecmunicipal.com/Embeddable/CollectionCalendar"
OUTPUT_PATH = Path(__file__).resolve().parent.parent / "docs" / "data" / "collections.json"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
    ),
    "Referer": BASE,
    "Origin": "https://scotborders-live-portal.bartecmunicipal.com",
}

TOKEN_RE = re.compile(
    r'name="__RequestVerificationToken"\s+type="hidden"\s+value="([^"]+)"'
)
EVENT_RE = re.compile(r'\{[^{}]*"Subject"[^{}]*\}')

# Bin type -> display colour, used by the app for the card accent.
BIN_COLOURS = {
    "General Waste": "#4a4a4a",
    "Recycling": "#1b6ea5",
    "Food": "#2f8f4e",
    "Garden": "#7a5230",
}


def extract_token(html: str) -> Optional[str]:
    m = TOKEN_RE.search(html)
    return m.group(1) if m else None


def fetch_schedule(postcode: str, uprn: str) -> list[dict]:
    session = requests.Session()

    r1 = session.get(BASE, headers=HEADERS, timeout=30)
    r1.raise_for_status()
    token = extract_token(r1.text)
    if not token:
        raise RuntimeError("Could not find verification token on initial page")

    r2 = session.post(
        f"{BASE}?handler=SearchPostcode",
        headers=HEADERS,
        data={"__RequestVerificationToken": token, "SelectedPostcode": postcode},
        timeout=30,
    )
    r2.raise_for_status()
    token = extract_token(r2.text) or token

    r3 = session.post(
        f"{BASE}?handler=SelectPrem",
        headers=HEADERS,
        data={
            "__RequestVerificationToken": token,
            "SelectedPostcode": postcode,
            "SelectedPremises": uprn,
        },
        timeout=30,
    )
    r3.raise_for_status()

    events = []
    for block in EVENT_RE.findall(r3.text):
        try:
            obj = json.loads(block)
        except json.JSONDecodeError:
            continue
        subject = obj.get("Subject")
        start = obj.get("StartTime")
        if not subject or not start:
            continue
        date = start.split("T")[0]
        events.append({"date": date, "type": subject})

    if not events:
        raise RuntimeError(
            "No collection events found — portal markup may have changed, "
            "or the postcode/UPRN pair is invalid"
        )

    # de-dupe and sort
    unique = {(e["date"], e["type"]) for e in events}
    events = [{"date": d, "type": t} for d, t in sorted(unique)]
    return events


def main() -> int:
    postcode = os.environ.get("SBC_POSTCODE")
    uprn = os.environ.get("SBC_UPRN")
    if not postcode or not uprn:
        print("SBC_POSTCODE and SBC_UPRN env vars are required", file=sys.stderr)
        return 1

    events = fetch_schedule(postcode, uprn)

    payload = {
        "updated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "colours": BIN_COLOURS,
        "collections": events,
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(payload, indent=2) + "\n")
    print(f"Wrote {len(events)} events to {OUTPUT_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
