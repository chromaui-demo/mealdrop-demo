#!/usr/bin/env python3
"""Report the accessibility findings for a build.

    ./a11y_report.py <project>                 # latest build
    ./a11y_report.py <project> 252
    ./a11y_report.py <project> 252 --markdown
    ./a11y_report.py <project> 252 --json
    ./a11y_report.py <project> 252 --selectors # include full CSS selectors

IMPORTANT — this data is a DIFF, not an audit.

`Test.accessibilityComparisons` is the only a11y surface in the schema, and it
reports axe rules as a change against the build's baseline:

    new      violation present in head, absent in baseline  -> regression
    existing violation present in both                      -> pre-existing
    removed  violation absent in head, present in baseline  -> fixed

A comparison whose `diff` is null contributes nothing. That happens for ADDED
comparisons (a new story, so there is no baseline to diff) and for many EQUAL
ones. Violations inside those are invisible here, so the totals are a floor, not
a guaranteed complete count. The report prints exactly how many it could not see.
"""

from __future__ import annotations

import argparse
import json
from collections import defaultdict

from chromatic_api import ChromaticAPI, resolve_project_id, run_cli

TESTS_QUERY = """query($id: ID!, $n: Int!, $first: Int!, $after: ID) {
  project(id: $id) {
    build(number: $n) {
      ... on CompletedBuild {
        tests(first: $first, after: $after) {
          pageInfo { hasNextPage endCursor }
          edges { node {
            id status result webUrl
            mode { name }
            story { name component { name } }
            accessibilityComparisons {
              id result
              viewport { name width }
              platform { name }
              diff {
                result
                rules {
                  rule title description helpUrl change
                  new { selector }
                  removed { selector }
                  existing { selector }
                }
              }
            }
          } }
        }
      }
    }
  }
}"""

LATEST_NUMBER_QUERY = "query($id: ID!) { project(id: $id) { name lastBuild { number } } }"

STATES = ("new", "existing", "removed")


def collect(tests: list[dict]) -> dict:
    """Flatten tests into per-state findings plus the blind-spot tally."""
    findings = []          # one entry per (test, comparison, rule)
    blind_spots = defaultdict(list)   # comparison.result -> [story label]
    comparison_results = defaultdict(int)

    for test in tests:
        story = test["story"]
        component = (story.get("component") or {}).get("name") or "—"
        label = f"{component} / {story['name']}"

        for comparison in test.get("accessibilityComparisons") or []:
            comparison_results[comparison["result"]] += 1
            diff = comparison.get("diff")
            if diff is None:
                blind_spots[comparison["result"]].append(label)
                continue
            for rule in diff.get("rules") or []:
                elements = {s: [e["selector"] for e in (rule.get(s) or [])] for s in STATES}
                if not any(elements.values()):
                    continue
                findings.append({
                    "story": label,
                    "component": component,
                    "mode": (test.get("mode") or {}).get("name"),
                    "viewport": (comparison.get("viewport") or {}).get("name"),
                    "browser": (comparison.get("platform") or {}).get("name"),
                    "testUrl": test["webUrl"],
                    "testStatus": test["status"],
                    "testResult": test["result"],
                    "rule": rule["rule"],
                    "title": rule["title"],
                    "description": rule["description"],
                    "helpUrl": rule["helpUrl"],
                    "change": rule["change"],
                    "elements": elements,
                })

    return {
        "findings": findings,
        "blindSpots": dict(blind_spots),
        "comparisonResults": dict(comparison_results),
    }


def format_comparisons(results: dict[str, int]) -> str:
    """`{'EQUAL': 80, 'ADDED': 2}` -> `80 EQUAL, 2 ADDED` (total 82)."""
    order = ["CHANGED", "ADDED", "EQUAL"]
    ranked = sorted(results.items(), key=lambda kv: order.index(kv[0])
                    if kv[0] in order else len(order))
    return (", ".join(f"{count} {name}" for name, count in ranked)
            + f"  (total {sum(results.values())})")


def totals(findings: list[dict]) -> dict[str, int]:
    return {s: sum(len(f["elements"][s]) for f in findings) for s in STATES}


def by_rule(findings: list[dict]) -> dict[str, dict]:
    rules: dict[str, dict] = {}
    for finding in findings:
        entry = rules.setdefault(finding["rule"], {
            "title": finding["title"],
            "description": finding["description"],
            "helpUrl": finding["helpUrl"],
            "stories": set(),
            **{s: 0 for s in STATES},
        })
        entry["stories"].add(finding["story"])
        for state in STATES:
            entry[state] += len(finding["elements"][state])
    return rules


def render_text(report: dict, project: str, number: int, selectors: bool) -> None:
    findings, counts = report["findings"], totals(report["findings"])

    print(f"{project} build #{number} — accessibility")
    print(f"  comparisons   {format_comparisons(report['comparisonResults'])}")
    print(f"  elements      new={counts['new']} existing={counts['existing']} "
          f"removed={counts['removed']}")
    print(f"  tests flagged {len({f['story'] for f in findings})}")
    print()

    if not findings:
        print("No axe rule changes against the baseline.")
    else:
        for rule, info in sorted(by_rule(findings).items(), key=lambda kv: -kv[1]["new"]):
            print(f"[{rule}] {info['title']}")
            print(f"  {info['description']}")
            print(f"  new={info['new']} existing={info['existing']} removed={info['removed']}"
                  f"  across {len(info['stories'])} stories")
            print(f"  {info['helpUrl']}")
            for finding in sorted(findings, key=lambda f: f["story"]):
                if finding["rule"] != rule:
                    continue
                parts = [f"{s}={len(finding['elements'][s])}"
                         for s in STATES if finding["elements"][s]]
                print(f"    - {finding['story']}  [mode={finding['mode']}, "
                      f"vp={finding['viewport']}, {finding['browser']}]  {' '.join(parts)}")
                if selectors:
                    for state in STATES:
                        for sel in finding["elements"][state]:
                            print(f"        {state}: {sel}")
                    print(f"        {finding['testUrl']}")
            print()

    render_blind_spots(report, prefix="")


def render_blind_spots(report: dict, prefix: str = "") -> None:
    blind = report["blindSpots"]
    if not blind:
        return
    total = sum(len(v) for v in blind.values())
    print(f"{prefix}Blind spots: {total} comparisons had no diff object, so any "
          f"violations in them are not reported.")
    for result, stories in sorted(blind.items()):
        note = " (new story — no baseline to diff against)" if result == "ADDED" else ""
        print(f"{prefix}  {result}: {len(stories)}{note}")
        if result == "ADDED":
            for story in stories:
                print(f"{prefix}    - {story}")
    print(f"{prefix}Counts above are a floor, not a guaranteed total. Check the "
          f"build UI for absolute violations.")


def render_markdown(report: dict, project: str, number: int, url: str | None) -> None:
    findings, counts = report["findings"], totals(report["findings"])
    print(f"## {project} build #{number} — accessibility\n")
    if url:
        print(f"{url}\n")
    print(f"- Comparisons: {format_comparisons(report['comparisonResults'])}")
    print(f"- Elements: **{counts['new']} new**, {counts['existing']} existing, "
          f"{counts['removed']} removed")
    print(f"- Stories flagged: {len({f['story'] for f in findings})}\n")

    if not findings:
        print("No axe rule changes against the baseline.\n")
    for rule, info in sorted(by_rule(findings).items(), key=lambda kv: -kv[1]["new"]):
        print(f"### `{rule}` — {info['title']}\n")
        print(f"> {info['description']}\n>\n> {info['helpUrl']}\n")
        print(f"new={info['new']} · existing={info['existing']} · removed={info['removed']}\n")
        print("| Story | Mode | Viewport | new | existing | removed |")
        print("|---|---|---|---:|---:|---:|")
        for finding in sorted(findings, key=lambda f: f["story"]):
            if finding["rule"] != rule:
                continue
            elements = finding["elements"]
            print(f"| {finding['story']} | {finding['mode']} | {finding['viewport']} | "
                  f"{len(elements['new'])} | {len(elements['existing'])} | "
                  f"{len(elements['removed'])} |")
        print()
    render_blind_spots(report)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("project", help="project id or exact name")
    parser.add_argument("number", nargs="?", type=int, help="build number (default: latest)")
    parser.add_argument("--json", action="store_true", help="emit the full findings as JSON")
    parser.add_argument("--markdown", action="store_true", help="emit a Markdown report")
    parser.add_argument("--selectors", action="store_true",
                        help="include full CSS selectors in text output")
    args = parser.parse_args()

    api = ChromaticAPI()
    project_id = resolve_project_id(api, args.project)

    latest = api.query(LATEST_NUMBER_QUERY, {"id": project_id}).get("project")
    if latest is None:
        raise SystemExit(f"error: project({project_id}) returned null.")
    project_name = latest["name"]
    number = args.number
    if number is None:
        if not latest.get("lastBuild"):
            raise SystemExit(f"error: project '{project_name}' has no builds.")
        number = latest["lastBuild"]["number"]

    tests = api.paginate(TESTS_QUERY, {"id": project_id, "n": number},
                         path="project.build.tests")
    report = collect(tests)
    report["project"] = project_name
    report["build"] = number
    report["testCount"] = len(tests)

    url = f"https://www.chromatic.com/build?appId={project_id}&number={number}"
    if args.json:
        print(json.dumps({**report, "webUrl": url}, indent=2))
    elif args.markdown:
        render_markdown(report, project_name, number, url)
    else:
        render_text(report, project_name, number, args.selectors)


if __name__ == "__main__":
    run_cli(main)
