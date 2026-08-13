#!/usr/bin/env python3
"""Summarise a build.

    ./build.py <project>              # latest build
    ./build.py <project> 252          # by number
    ./build.py <project> 252 --json

<project> is a project id or an exact project name.
"""

from __future__ import annotations

import argparse
import json

from chromatic_api import ChromaticAPI, resolve_project_id, run_cli

BUILD_FIELDS = """
    __typename number status branch commit committedAt
    ... on CompletedBuild {
      result webUrl storybookUrl
      testCount specCount componentCount docsCount
      isLimited isSuperseded
      browsers { name version }
      completedAt
    }
"""

BY_NUMBER = f"query($id: ID!, $n: Int!) {{ project(id: $id) {{ name webUrl build(number: $n) {{{BUILD_FIELDS}}} }} }}"
LATEST = f"query($id: ID!) {{ project(id: $id) {{ name webUrl lastBuild {{{BUILD_FIELDS}}} }} }}"


def fetch_build(api: ChromaticAPI, project_id: str, number: int | None) -> tuple[dict, dict]:
    """Return (project, build). Raises if either is missing."""
    if number is None:
        data = api.query(LATEST, {"id": project_id})
        project, key = data.get("project"), "lastBuild"
    else:
        data = api.query(BY_NUMBER, {"id": project_id, "n": number})
        project, key = data.get("project"), "build"

    if project is None:
        raise SystemExit(
            f"error: project({project_id}) returned null — wrong id, or the token's "
            f"account cannot see it. (A project id is not an account id.)"
        )
    build = project[key]
    if build is None:
        raise SystemExit(f"error: no build {number} in project '{project['name']}'.")
    return project, build


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("project", help="project id or exact name")
    parser.add_argument("number", nargs="?", type=int, help="build number (default: latest)")
    parser.add_argument("--json", action="store_true", help="emit JSON")
    args = parser.parse_args()

    api = ChromaticAPI()
    project, build = fetch_build(api, resolve_project_id(api, args.project), args.number)

    if args.json:
        print(json.dumps({"project": project["name"], "build": build}, indent=2))
        return

    print(f"{project['name']} build #{build['number']}  [{build['__typename']}]")
    print(f"  status      {build['status']}  result={build.get('result', '—')}")
    print(f"  branch      {build['branch']}")
    print(f"  commit      {build['commit']}")
    if build.get("webUrl"):
        print(f"  url         {build['webUrl']}")
    if build.get("testCount") is not None:
        print(f"  tests       {build['testCount']} "
              f"({build['specCount']} specs, {build['componentCount']} components)")
    if build.get("browsers"):
        browsers = ", ".join(f"{b['name']} {b['version']}" for b in build["browsers"])
        print(f"  browsers    {browsers}")
    if build.get("isSuperseded"):
        print("  note        superseded by a newer build on this branch")
    if build.get("isLimited"):
        print("  note        LIMITED — results truncated by plan limits")
    if build["__typename"] != "CompletedBuild":
        print(f"\n  Build is {build['__typename']}, not CompletedBuild — "
              f"tests and a11y data are unavailable until it completes.")


if __name__ == "__main__":
    run_cli(main)
