#!/usr/bin/env python3
"""Build a debug packet for each failing interaction test.

    ./interaction_triage.py <project> [number]
    ./interaction_triage.py <project> --find        # locate the last errored build
    ./interaction_triage.py <project> 189 --out ./triage
    ./interaction_triage.py <project> 189 --json

For every BROKEN test this pulls the capture error apart into the pieces you
actually debug with, which the raw API response buries in one giant string:

  * the error name and message, and the query the test was waiting on
  * the **rendered DOM at the moment of failure** (the single most useful
    artifact — it shows what was on screen instead of what the test expected)
  * the stack with runtime frames dropped, so only app frames remain
  * the repo source files those frames point at, bundle hashes stripped

The DOM is written to `dom.html` per failure rather than printed, because it runs
to tens of kilobytes. The visible text of that DOM *is* printed — mismatches
between what the test queried and what rendered are usually obvious there.

Proposing the fix is a judgement call made after reading those pieces; see
references/triage-playbook.md.
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

import repo
from chromatic_api import ChromaticAPI, resolve_project_id, run_cli
from test_errors import ERRORED_TESTS_QUERY, FIND_ERRORED_QUERY, LATEST_QUERY, collect

STACK_FRAME = re.compile(r"^\s+at\s+(?P<fn>.+?)\s+\((?P<loc>.+?)\)\s*$")
BARE_FRAME = re.compile(r"^\s+at\s+(?P<loc>\S+)\s*$")
# Storybook/Testing Library runtime chunks — noise, not app code.
RUNTIME_BUNDLE = re.compile(r"/(iframe|runtime|vendor|chunk)-[A-Za-z0-9_-]+\.js")
# "Unable to find an element with the text: /foo/i" / "...with the role: button"
QUERY_HINT = re.compile(r"element (?:with|by) the (?P<kind>[\w\s]+?):\s*(?P<value>.+?)(?:\.\s|\.$|$)")


def split_stack(stack: str) -> tuple[str, list[str]]:
    """Separate the embedded DOM dump from the actual stack frames."""
    if not stack:
        return "", []
    lines = stack.splitlines()
    first_frame = next((i for i, line in enumerate(lines)
                        if STACK_FRAME.match(line) or BARE_FRAME.match(line)), len(lines))
    head, frames = lines[:first_frame], lines[first_frame:]

    dom_start = next((i for i, line in enumerate(head)
                      if line.startswith("<") or line.startswith("Ignored nodes:")), None)
    dom = "\n".join(head[dom_start:]).strip() if dom_start is not None else ""
    return dom, [line.rstrip() for line in frames if line.strip()]


def app_frames(frames: list[str]) -> list[dict]:
    """Frames that point at application bundles, resolved back to repo files."""
    resolved = []
    for line in frames:
        match = STACK_FRAME.match(line) or BARE_FRAME.match(line)
        if not match:
            continue
        loc = match.groupdict().get("loc", "")
        if RUNTIME_BUNDLE.search(loc):
            continue
        bundle = loc.rsplit("/", 1)[-1].split("?")[0]
        stem = repo.bundle_to_stem(re.sub(r":\d+:\d+$", "", bundle))
        if not stem:
            continue
        resolved.append({
            "function": match.groupdict().get("fn") or "(anonymous)",
            "bundle": bundle,
            "stem": stem,
            "sources": repo.find_sources(stem, limit=3),
        })
    return resolved


def dom_text(dom: str, limit: int = 60) -> list[str]:
    """Visible text nodes from the serialized DOM dump.

    The serializer puts text content on its own lines, so anything that is not a
    tag, attribute or closing bracket is rendered text.
    """
    texts = []
    for raw in dom.splitlines():
        line = raw.strip()
        if not line or line.startswith(("<", "/>", ">", "Ignored nodes:")):
            continue
        # Attribute lines: `class="x"`, `xlink:href="y"`, `data-testid="z"`,
        # and the opening line of a multi-line value. Namespaced and dashed
        # attribute names both need to be caught here.
        if re.match(r'^[\w:.\-]+=', line) or line.endswith("="):
            continue
        texts.append(line)
        if len(texts) >= limit:
            break
    return texts


def analyse(row: dict) -> dict:
    dom, frames = split_stack(row.get("stack") or "")
    hint = QUERY_HINT.search(row.get("errorMessage") or "")
    return {
        **row,
        "dom": dom,
        "domText": dom_text(dom),
        "frames": frames,
        "appFrames": app_frames(frames),
        "queriedBy": hint.group("kind").strip() if hint else None,
        "queriedFor": hint.group("value").strip() if hint else None,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("project", help="project id or exact name")
    parser.add_argument("number", nargs="?", type=int, help="build number (default: latest)")
    parser.add_argument("--find", action="store_true", help="locate the last errored build")
    parser.add_argument("--out", help="write dom.html files here "
                                      "(default: ./chromatic-triage/<project>-<n>-interactions)")
    parser.add_argument("--json", action="store_true", help="emit JSON (omits the DOM blob)")
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
        print(f"\nRun: ./interaction_triage.py {args.project} {build['number']}")
        return

    project = api.query(LATEST_QUERY, {"id": project_id}).get("project")
    if project is None:
        raise SystemExit(f"error: project({project_id}) returned null.")
    number = args.number
    if number is None:
        if not project.get("lastBuild"):
            raise SystemExit(f"error: project '{project['name']}' has no builds.")
        number = project["lastBuild"]["number"]

    tests = api.paginate(ERRORED_TESTS_QUERY, {"id": project_id, "n": number},
                         path="project.build.tests")
    packets = [analyse(row) for row in collect(tests)]

    if args.json:
        print(json.dumps({
            "project": project["name"], "build": number,
            "failures": [{k: v for k, v in p.items() if k not in ("dom", "stack")}
                         for p in packets],
        }, indent=2))
        return

    print(f"{project['name']} build #{number} — {len(packets)} failing interaction test(s)\n")
    if not packets:
        print("No BROKEN tests. (Use --find to locate the last build that had some.)")
        return

    out_dir = Path(args.out) if args.out else (
        Path.cwd() / "chromatic-triage" / f"{number}-interactions")
    if any(p["dom"] for p in packets):
        out_dir.mkdir(parents=True, exist_ok=True)

    for index, packet in enumerate(packets, 1):
        print(f"── {index}. {packet['story']}  [{packet['viewport']}, {packet['browser']}]")
        print(f"   {packet['type']}  kind={packet['kind']}"
              + (f"  timeoutMs={packet['timeoutMs']}" if packet["timeoutMs"] else ""))
        if packet["errorName"]:
            print(f"   {packet['errorName']}: {(packet['errorMessage'] or '').strip().splitlines()[0]}")
        if packet["queriedFor"]:
            print(f"   queried by {packet['queriedBy']}: {packet['queriedFor']}")
        print(f"   {packet['testUrl']}")

        if packet["appFrames"]:
            print("   app frames:")
            for frame in packet["appFrames"][:4]:
                sources = ", ".join(frame["sources"]) or "(no repo match)"
                print(f"     {frame['function']:<24} {frame['stem']} -> {sources}")

        if packet["dom"]:
            dom_path = out_dir / f"{index:02d}-{re.sub(r'[^A-Za-z0-9]+', '-', packet['story'])}-dom.html"
            dom_path.write_text(packet["dom"])
            print(f"   DOM at failure ({len(packet['dom']):,} chars) -> {dom_path}")
            if packet["domText"]:
                print("   rendered text:")
                for text in packet["domText"][:12]:
                    print(f"     | {text}")
                if len(packet["domText"]) > 12:
                    print(f"     | ... ({len(packet['domText']) - 12} more)")
        print()

    print("Compare `queried by` against `rendered text` — a near-miss there "
          "(punctuation, casing, an ellipsis character) is the usual cause.")


if __name__ == "__main__":
    run_cli(main)
