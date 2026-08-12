#!/usr/bin/env python3
"""Download visual changes from a build so they can be looked at and judged.

    ./visual_triage.py <project> [number]              # unreviewed changes
    ./visual_triage.py <project> 252 --limit 5
    ./visual_triage.py <project> 252 --story Badge     # substring filter
    ./visual_triage.py <project> 252 --all             # include EQUAL/ADDED too
    ./visual_triage.py <project> 252 --out ./triage

Writes `baseline.png`, `head.png`, `diff.png` and `focus.png` per changed
comparison, plus `manifest.json` and an `INDEX.md` listing every set with the
component, story, viewport and the source files it probably came from.

This script only gathers evidence — deciding whether a change is intended is a
judgement call made by reading the images afterwards. See the triage playbook in
references/triage-playbook.md.

Signed image URLs expire in ~60 minutes, so images are downloaded immediately
rather than stored as links.
"""

from __future__ import annotations

import argparse
import json
import re
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import repo
from chromatic_api import ChromaticAPI, resolve_project_id, run_cli

TESTS_QUERY = """query($id: ID!, $n: Int!, $first: Int!, $after: ID) {
  project(id: $id) {
    name
    build(number: $n) {
      ... on CompletedBuild {
        branch commit webUrl
        tests(first: $first, after: $after) {
          pageInfo { hasNextPage endCursor }
          edges { node {
            id status result webUrl
            mode { name }
            story { name component { name } }
            visualComparisons {
              result
              viewport { name width }
              platform { name }
              baseCapture { captureImage { imageUrl imageWidth imageHeight } }
              headCapture { captureImage { imageUrl imageWidth imageHeight } }
              diff {
                result
                diffImage { imageUrl imageWidth imageHeight }
                focusImage { imageUrl }
              }
            }
          } }
        }
      }
    }
  }
}"""

BUILD_META_QUERY = """query($id: ID!, $n: Int!) {
  project(id: $id) { name build(number: $n) {
    ... on CompletedBuild { branch commit webUrl } } } }"""

LATEST_QUERY = "query($id: ID!) { project(id: $id) { name lastBuild { number } } }"

CHANGED_RESULTS = {"CHANGED", "ADDED", "REMOVED"}


def slug(text: str) -> str:
    return re.sub(r"[^A-Za-z0-9]+", "-", (text or "")).strip("-") or "unnamed"


def download(url: str, dest: Path) -> str | None:
    """Fetch one image. Returns an error string on failure, None on success."""
    try:
        with urllib.request.urlopen(url) as response:
            dest.write_bytes(response.read())
        return None
    except Exception as exc:  # noqa: BLE001 - report, never abort the batch
        return f"{type(exc).__name__}: {exc}"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("project", help="project id or exact name")
    parser.add_argument("number", nargs="?", type=int, help="build number (default: latest)")
    parser.add_argument("--out", help="output directory (default: ./chromatic-triage/<project>-<n>)")
    parser.add_argument("--limit", type=int, default=10,
                        help="max comparisons to download (default 10; 0 = no limit)")
    parser.add_argument("--story", help="only stories whose component/name contains this")
    parser.add_argument("--all", action="store_true",
                        help="include unchanged comparisons, not just CHANGED/ADDED/REMOVED")
    args = parser.parse_args()

    api = ChromaticAPI()
    project_id = resolve_project_id(api, args.project)

    project = api.query(LATEST_QUERY, {"id": project_id}).get("project")
    if project is None:
        raise SystemExit(f"error: project({project_id}) returned null.")
    number = args.number
    if number is None:
        if not project.get("lastBuild"):
            raise SystemExit(f"error: project '{project['name']}' has no builds.")
        number = project["lastBuild"]["number"]

    meta = ((api.query(BUILD_META_QUERY, {"id": project_id, "n": number})
             .get("project") or {}).get("build")) or {}
    tests = api.paginate(TESTS_QUERY, {"id": project_id, "n": number},
                         path="project.build.tests")

    # Flatten to comparisons worth looking at.
    items = []
    for test in tests:
        story = test["story"]
        component = (story.get("component") or {}).get("name") or "—"
        label = f"{component} / {story['name']}"
        if args.story and args.story.lower() not in label.lower():
            continue
        for comparison in test.get("visualComparisons") or []:
            if not args.all and comparison["result"] not in CHANGED_RESULTS:
                continue
            items.append((test, component, story, comparison))

    total_found = len(items)
    if args.limit and len(items) > args.limit:
        items = items[: args.limit]

    out_dir = Path(args.out) if args.out else Path.cwd() / "chromatic-triage" / f"{slug(project['name'])}-{number}"
    out_dir.mkdir(parents=True, exist_ok=True)

    jobs, entries = [], []
    for index, (test, component, story, comparison) in enumerate(items, 1):
        viewport = (comparison.get("viewport") or {}).get("name") or "vp"
        browser = (comparison.get("platform") or {}).get("name") or "browser"
        stem = f"{index:02d}-{slug(component)}--{slug(story['name'])}--{slug(viewport)}--{slug(browser)}"
        folder = out_dir / stem
        folder.mkdir(exist_ok=True)

        diff = comparison.get("diff") or {}
        sources = {
            "baseline": ((comparison.get("baseCapture") or {}).get("captureImage") or {}).get("imageUrl"),
            "head": ((comparison.get("headCapture") or {}).get("captureImage") or {}).get("imageUrl"),
            "diff": (diff.get("diffImage") or {}).get("imageUrl"),
            "focus": (diff.get("focusImage") or {}).get("imageUrl"),
        }
        files = {}
        for kind, url in sources.items():
            if not url:
                continue
            dest = folder / f"{kind}.png"
            files[kind] = str(dest.relative_to(out_dir))
            jobs.append((url, dest, f"{stem}/{kind}"))

        entries.append({
            "index": index,
            "component": component,
            "story": story["name"],
            "mode": (test.get("mode") or {}).get("name"),
            "viewport": viewport,
            "browser": browser,
            "comparisonResult": comparison["result"],
            "diffResult": diff.get("result"),
            "testStatus": test["status"],
            "testResult": test["result"],
            "testUrl": test["webUrl"],
            "dir": stem,
            "files": files,
            "sourceCandidates": repo.find_component_sources(component),
            "storyFileCandidates": repo.find_component_sources(component, story_file=True),
        })

    failures = []
    if jobs:
        with ThreadPoolExecutor(max_workers=8) as pool:
            results = pool.map(lambda job: (job[2], download(job[0], job[1])), jobs)
            failures = [(name, err) for name, err in results if err]

    commit = repo.commit_summary(meta.get("commit") or "")
    manifest = {
        "project": project["name"],
        "projectId": project_id,
        "build": number,
        "branch": meta.get("branch"),
        "commit": meta.get("commit"),
        "buildUrl": meta.get("webUrl"),
        "commitInfo": commit,
        "totalChangedFound": total_found,
        "downloaded": len(entries),
        "entries": entries,
        "downloadFailures": [{"file": n, "error": e} for n, e in failures],
    }
    (out_dir / "manifest.json").write_text(json.dumps(manifest, indent=2))

    # Human/agent-readable index.
    lines = [
        f"# Visual triage — {project['name']} build #{number}", "",
        f"- Build: {meta.get('webUrl')}",
        f"- Branch: `{meta.get('branch')}`  Commit: `{(meta.get('commit') or '')[:12]}`",
    ]
    if commit:
        lines.append(f"- Commit subject: **{commit['subject']}** ({commit['author']})")
        lines.append(f"- Files changed: {', '.join(f'`{f}`' for f in commit['files'])}")
    lines += [
        f"- Comparisons downloaded: {len(entries)} of {total_found} changed", "",
        "Read `diff.png` first (changed pixels highlighted), then `baseline.png` vs "
        "`head.png` to judge intent.", "",
    ]
    for entry in entries:
        lines += [
            f"## {entry['index']}. {entry['component']} / {entry['story']}", "",
            f"- Result: `{entry['comparisonResult']}` · viewport {entry['viewport']} · "
            f"{entry['browser']} · mode `{entry['mode']}`",
            f"- Test: {entry['testUrl']}",
            f"- Images: " + ", ".join(f"`{p}`" for p in entry["files"].values()),
        ]
        if entry["sourceCandidates"]:
            lines.append(f"- Source: " + ", ".join(f"`{p}`" for p in entry["sourceCandidates"][:3]))
        lines.append("")
    (out_dir / "INDEX.md").write_text("\n".join(lines))

    print(f"{project['name']} build #{number} — {total_found} changed comparisons"
          + (f", downloaded {len(entries)}" if total_found != len(entries) else ""))
    print(f"  branch {meta.get('branch')}  commit {(meta.get('commit') or '')[:12]}")
    if commit:
        print(f"  commit: {commit['subject']}")
        print(f"  changed: {', '.join(commit['files'])}")
    print(f"  -> {out_dir}")
    print()
    for entry in entries:
        print(f"  {entry['index']:2d}. {entry['component']} / {entry['story']}"
              f"  [{entry['comparisonResult']}, {entry['viewport']}, {entry['browser']}]")
        print(f"      {entry['dir']}/")
    if failures:
        print(f"\n  {len(failures)} image(s) failed to download:")
        for name, err in failures[:10]:
            print(f"    {name}: {err}")
    if total_found > len(entries):
        print(f"\n  {total_found - len(entries)} more not downloaded (--limit {args.limit}; "
              f"use --limit 0 for all).")
    print(f"\nNext: read {out_dir}/INDEX.md, then the diff.png files.")


if __name__ == "__main__":
    run_cli(main)
