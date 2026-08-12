#!/usr/bin/env python3
"""Report errored tests in a build — interaction failures, JS errors, timeouts.

    ./test_errors.py <project>                # latest build
    ./test_errors.py <project> 189
    ./test_errors.py <project> 189 --stack    # include the full stack/DOM dump
    ./test_errors.py <project> 189 --json
    ./test_errors.py <project> --find         # find the last errored build

A failing interaction test surfaces as a *capture* error, not as a distinct test
entity: the story's capture aborts, `Test.result` becomes CAPTURE_ERROR, and
`Test.status` becomes BROKEN. The detail lives on `Capture.captureError`, a
CaptureError interface — you must spread the concrete types to read the payload.
`CaptureErrorInteractionFailure.error` is the Testing Library / play-function
error as a JSONObject: name, message, and a stack that embeds a full DOM dump.
"""

from __future__ import annotations

import argparse
import json

from chromatic_api import ChromaticAPI, resolve_project_id, run_cli

# Every CaptureError implementor that carries a payload beyond `kind`.
ERROR_FRAGMENTS = """
  __typename kind
  ... on CaptureErrorInteractionFailure { error }
  ... on CaptureErrorInteractionTestTimeout { timeoutMs }
  ... on CaptureErrorJSError { error }
  ... on CaptureErrorFailedJS { error }
  ... on CaptureErrorImageTooLarge { maxImagePixels }
"""

ERRORED_TESTS_QUERY = f"""query($id: ID!, $n: Int!, $first: Int!, $after: ID) {{
  project(id: $id) {{
    build(number: $n) {{
      ... on CompletedBuild {{
        tests(first: $first, after: $after, statuses: [BROKEN]) {{
          pageInfo {{ hasNextPage endCursor }}
          edges {{ node {{
            status result webUrl
            mode {{ name }}
            story {{ name component {{ name }} }}
            visualComparisons {{
              viewport {{ name }} platform {{ name }}
              headCapture {{ result captureError {{{ERROR_FRAGMENTS}}} }}
            }}
          }} }}
        }}
      }}
    }}
  }}
}}"""

LATEST_QUERY = "query($id: ID!) { project(id: $id) { name lastBuild { number } } }"

FIND_ERRORED_QUERY = """query($id: ID!) { project(id: $id) {
  name
  lastBuild(results: [CAPTURE_ERROR, SYSTEM_ERROR, TIMEOUT]) {
    number ... on CompletedBuild { result webUrl testCount(results: [CAPTURE_ERROR, SYSTEM_ERROR]) }
  } } }"""


def collect(tests: list[dict]) -> list[dict]:
    rows = []
    for test in tests:
        story = test["story"]
        component = (story.get("component") or {}).get("name") or "—"
        for comparison in test.get("visualComparisons") or []:
            capture = comparison.get("headCapture") or {}
            error = capture.get("captureError")
            if not error:
                continue
            payload = error.get("error") or {}
            rows.append({
                "story": f"{component} / {story['name']}",
                "mode": (test.get("mode") or {}).get("name"),
                "viewport": (comparison.get("viewport") or {}).get("name"),
                "browser": (comparison.get("platform") or {}).get("name"),
                "testUrl": test["webUrl"],
                "result": test["result"],
                "type": error.get("__typename"),
                "kind": error.get("kind"),
                "timeoutMs": error.get("timeoutMs"),
                "errorName": payload.get("name"),
                "errorMessage": payload.get("message"),
                "stack": payload.get("stack"),
            })
    return rows


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("project", help="project id or exact name")
    parser.add_argument("number", nargs="?", type=int, help="build number (default: latest)")
    parser.add_argument("--find", action="store_true",
                        help="report the most recent errored build instead")
    parser.add_argument("--stack", action="store_true", help="print full stack traces")
    parser.add_argument("--json", action="store_true", help="emit JSON")
    args = parser.parse_args()

    api = ChromaticAPI()
    project_id = resolve_project_id(api, args.project)

    if args.find:
        project = api.query(FIND_ERRORED_QUERY, {"id": project_id}).get("project") or {}
        build = project.get("lastBuild")
        if not build:
            print(f"{project.get('name')}: no errored build found.")
            return
        print(f"{project['name']} last errored build: #{build['number']} "
              f"result={build.get('result')} errored_tests={build.get('testCount')}")
        print(f"  {build.get('webUrl')}")
        return

    number = args.number
    project = api.query(LATEST_QUERY, {"id": project_id}).get("project")
    if project is None:
        raise SystemExit(f"error: project({project_id}) returned null.")
    if number is None:
        if not project.get("lastBuild"):
            raise SystemExit(f"error: project '{project['name']}' has no builds.")
        number = project["lastBuild"]["number"]

    tests = api.paginate(ERRORED_TESTS_QUERY, {"id": project_id, "n": number},
                         path="project.build.tests")
    rows = collect(tests)

    if args.json:
        print(json.dumps({"project": project["name"], "build": number, "errors": rows}, indent=2))
        return

    print(f"{project['name']} build #{number} — errored tests: {len(rows)}\n")
    if not rows:
        print("No BROKEN tests. (Use --find to locate the last build that had some.)")
        return

    for row in rows:
        print(f"  {row['story']}  [mode={row['mode']}, vp={row['viewport']}, {row['browser']}]")
        print(f"    {row['type']}  kind={row['kind']}"
              + (f"  timeoutMs={row['timeoutMs']}" if row["timeoutMs"] else ""))
        if row["errorName"]:
            message = (row["errorMessage"] or "").strip().splitlines()
            print(f"    {row['errorName']}: {message[0] if message else ''}")
            for line in message[1:4]:
                print(f"      {line}")
        print(f"    {row['testUrl']}")
        if args.stack and row["stack"]:
            print("    --- stack ---")
            for line in row["stack"].splitlines():
                print(f"    {line}")
        print()

    if not args.stack and any(r["stack"] for r in rows):
        print("Pass --stack for full traces (they embed a complete DOM dump — very long).")


if __name__ == "__main__":
    run_cli(main)
