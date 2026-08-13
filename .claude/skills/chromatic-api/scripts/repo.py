"""Map Chromatic entities back onto files in the local git repo.

Chromatic reports components, stories and bundle names; triage needs the source
files behind them. Everything here is best-effort and read-only — it never fails
the caller, it just returns fewer candidates.
"""

from __future__ import annotations

import re
import subprocess
from functools import lru_cache
from pathlib import Path

# Vite/Rollup bundle names carry a content hash: `Foo.stories-Bx-j4EKp.js`.
BUNDLE_HASH = re.compile(r"-[A-Za-z0-9_-]{6,12}\.js$")

# Directories that mirror source but are build output or vendored copies.
EXCLUDED_PARTS = ("node_modules", "chromatic-archives", "storybook-static",
                  "dist", "build", "test-results", "cypress/downloads")


def _git(*args: str, cwd: Path | None = None) -> str:
    try:
        return subprocess.run(["git", *args], capture_output=True, text=True,
                              check=True, cwd=cwd).stdout
    except (subprocess.CalledProcessError, FileNotFoundError):
        return ""


@lru_cache(maxsize=1)
def repo_root() -> Path | None:
    out = _git("rev-parse", "--show-toplevel").strip()
    return Path(out) if out else None


@lru_cache(maxsize=1)
def tracked_files() -> tuple[str, ...]:
    root = repo_root()
    if not root:
        return ()
    files = _git("ls-files", cwd=root).splitlines()
    return tuple(f for f in files if not any(part in f for part in EXCLUDED_PARTS))


def bundle_to_stem(bundle: str) -> str:
    """`RestaurantDetailPage.stories-Bx-j4EKp.js` -> `RestaurantDetailPage.stories`."""
    return BUNDLE_HASH.sub("", bundle.rsplit("/", 1)[-1]).removesuffix(".js")


def find_sources(stem: str, limit: int = 5) -> list[str]:
    """Repo-relative paths whose basename starts with `stem`.

    Exact basename matches sort first, then shortest path — the real source file
    beats a test or a nested variant.
    """
    if not stem:
        return []
    matches = []
    for path in tracked_files():
        name = path.rsplit("/", 1)[-1]
        base = name.split(".")[0]
        if base == stem or name.startswith(stem + "."):
            matches.append(path)
    matches.sort(key=lambda p: (p.rsplit("/", 1)[-1].split(".")[0] != stem, len(p)))
    return matches[:limit]


def find_component_sources(component: str, story_file: bool = False) -> list[str]:
    """Candidate files for a Chromatic component name, optionally its stories file."""
    candidates = find_sources(component)
    if story_file:
        return [p for p in candidates if ".stories." in p] or candidates
    return [p for p in candidates if ".stories." not in p and ".test." not in p] or candidates


def commit_summary(sha: str) -> dict[str, str | list[str]]:
    """Subject, author and changed files for a commit, if it is present locally."""
    if not sha or not _git("cat-file", "-t", sha).strip() == "commit":
        return {}
    subject = _git("log", "-1", "--format=%s", sha).strip()
    author = _git("log", "-1", "--format=%an", sha).strip()
    files = _git("show", "--name-only", "--format=", sha).split()
    return {"sha": sha, "subject": subject, "author": author, "files": files}


def commit_diff(sha: str, path: str | None = None, max_lines: int = 200) -> str:
    """The patch for a commit, optionally scoped to one path."""
    args = ["show", "--format=", sha]
    if path:
        args += ["--", path]
    lines = _git(*args).splitlines()
    if len(lines) > max_lines:
        lines = lines[:max_lines] + [f"... ({len(lines) - max_lines} more lines)"]
    return "\n".join(lines)
