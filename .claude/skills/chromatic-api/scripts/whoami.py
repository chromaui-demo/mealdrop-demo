#!/usr/bin/env python3
"""Verify credentials end-to-end: fetch a token, decode it, hit the API.

Run this first when anything looks wrong — it separates "bad credentials" from
"bad query" in one step.

    ./whoami.py [--json]
"""

from __future__ import annotations

import argparse
import datetime as dt
import json

from chromatic_api import ChromaticAPI, list_projects, run_cli, strip_type_prefix


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--json", action="store_true", help="emit JSON")
    args = parser.parse_args()

    api = ChromaticAPI()
    claims = api.claims()
    account = list_projects(api)

    expires_at = dt.datetime.fromtimestamp(claims["exp"], dt.timezone.utc)
    remaining = expires_at - dt.datetime.now(dt.timezone.utc)

    if args.json:
        print(json.dumps({
            "clientId": claims["clientId"],
            "accountId": claims["accountId"],
            "accountName": account["name"],
            "scopes": api.scopes,
            "expiresAt": expires_at.isoformat(),
            "secondsRemaining": int(remaining.total_seconds()),
            "projectCount": len(account["projects"]),
        }, indent=2))
        return

    print(f"client id   {claims['clientId']}")
    print(f"account     {account['name']} ({claims['accountId']})")
    print(f"audience    {claims.get('aud')}")
    print(f"expires     {expires_at:%Y-%m-%d %H:%M:%S} UTC "
          f"({int(remaining.total_seconds() // 60)} min left)")
    print(f"scopes      {' '.join(api.scopes)}")
    print(f"projects    {len(account['projects'])}")
    print()
    for project in sorted(account["projects"], key=lambda p: p["name"]):
        print(f"  {strip_type_prefix(project['id'])}  {project['name']}")


if __name__ == "__main__":
    run_cli(main)
