"""Chromatic GraphQL API client: OAuth M2M token handling + query execution.

Stdlib only, no dependencies. Import this from the sibling CLI scripts, or use
directly:

    from chromatic_api import ChromaticAPI
    api = ChromaticAPI()
    data = api.query("query($id: ID!) { project(id: $id) { name } }", {"id": ...})

Credentials are read from, in order:
  1. CHROMATIC_CLIENT_ID / CHROMATIC_CLIENT_SECRET environment variables
  2. the env file at $CHROMATIC_ENV_FILE
  3. .env.chromatic at the git repo root
"""

from __future__ import annotations

import base64
import hashlib
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

TOKEN_URL = "https://www.chromatic.com/token"
API_URL = "https://www.chromatic.com/api"
RESOURCE = "https://www.chromatic.com/api"

# Refresh a little before the hour is up so a long-running script never races expiry.
EXPIRY_SKEW_SECONDS = 120


class ChromaticError(RuntimeError):
    """Raised for auth failures and GraphQL `errors` responses."""


def _repo_root() -> Path | None:
    try:
        out = subprocess.run(
            ["git", "rev-parse", "--show-toplevel"],
            capture_output=True, text=True, check=True,
        ).stdout.strip()
        return Path(out) if out else None
    except (subprocess.CalledProcessError, FileNotFoundError):
        return None


def _load_env_file(path: Path) -> dict[str, str]:
    """Parse a minimal KEY=VALUE env file. Supports `export ` prefixes and quotes."""
    values: dict[str, str] = {}
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        line = line.removeprefix("export ").strip()
        key, sep, value = line.partition("=")
        if not sep:
            continue
        values[key.strip()] = value.strip().strip("'\"")
    return values


def _resolve_credentials() -> tuple[str, str]:
    client_id = os.environ.get("CHROMATIC_CLIENT_ID")
    client_secret = os.environ.get("CHROMATIC_CLIENT_SECRET")
    if client_id and client_secret:
        return client_id, client_secret

    candidates = []
    if os.environ.get("CHROMATIC_ENV_FILE"):
        candidates.append(Path(os.environ["CHROMATIC_ENV_FILE"]).expanduser())
    root = _repo_root()
    if root:
        candidates.append(root / ".env.chromatic")

    for candidate in candidates:
        if candidate.is_file():
            values = _load_env_file(candidate)
            client_id = client_id or values.get("CHROMATIC_CLIENT_ID")
            client_secret = client_secret or values.get("CHROMATIC_CLIENT_SECRET")
            if client_id and client_secret:
                return client_id, client_secret

    raise ChromaticError(
        "Missing credentials. Set CHROMATIC_CLIENT_ID and CHROMATIC_CLIENT_SECRET, "
        "or create .env.chromatic at the repo root (see this skill's SKILL.md)."
    )


def decode_jwt_claims(token: str) -> dict[str, Any]:
    """Decode a JWT payload without verifying the signature.

    Only for reading our own token's `accountId`, `scope` and `exp` claims — never
    for trusting a token we did not just receive from the token endpoint.
    """
    payload = token.split(".")[1]
    payload += "=" * (-len(payload) % 4)
    return json.loads(base64.urlsafe_b64decode(payload))


class ChromaticAPI:
    def __init__(self, client_id: str | None = None, client_secret: str | None = None):
        if client_id and client_secret:
            self.client_id, self.client_secret = client_id, client_secret
        else:
            self.client_id, self.client_secret = _resolve_credentials()
        self._token: str | None = None
        self._claims: dict[str, Any] | None = None

    # ---- token handling -------------------------------------------------

    @property
    def _cache_path(self) -> Path:
        digest = hashlib.sha256(self.client_id.encode()).hexdigest()[:16]
        cache_dir = Path(
            os.environ.get("XDG_CACHE_HOME", Path.home() / ".cache")
        ) / "chromatic-api"
        cache_dir.mkdir(parents=True, exist_ok=True)
        return cache_dir / f"token-{digest}.json"

    def _read_cached_token(self) -> str | None:
        path = self._cache_path
        if not path.is_file():
            return None
        try:
            cached = json.loads(path.read_text())
            token = cached["access_token"]
            if decode_jwt_claims(token)["exp"] - EXPIRY_SKEW_SECONDS > time.time():
                return token
        except (json.JSONDecodeError, KeyError, ValueError, OSError):
            pass
        return None

    def _fetch_token(self) -> str:
        body = urllib.parse.urlencode({
            "grant_type": "client_credentials",
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            # Required. Omitting `resource` yields a token the /api audience rejects.
            "resource": RESOURCE,
        }).encode()
        request = urllib.request.Request(
            TOKEN_URL, data=body,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        try:
            with urllib.request.urlopen(request) as response:
                payload = json.loads(response.read())
        except urllib.error.HTTPError as exc:
            raise ChromaticError(
                f"Token request failed ({exc.code}): {exc.read().decode(errors='replace')}"
            ) from exc

        token = payload["access_token"]
        path = self._cache_path
        path.write_text(json.dumps(payload))
        path.chmod(0o600)
        return token

    def token(self) -> str:
        if self._token is None:
            self._token = self._read_cached_token() or self._fetch_token()
        return self._token

    def claims(self) -> dict[str, Any]:
        if self._claims is None:
            self._claims = decode_jwt_claims(self.token())
        return self._claims

    @property
    def account_id(self) -> str:
        """The account this client is bound to.

        Read it from the token rather than hardcoding one — a wrong id makes
        `account(id:)` return null with no `errors` entry.
        """
        return self.claims()["accountId"]

    @property
    def scopes(self) -> list[str]:
        return self.claims().get("scope", "").split()

    # ---- queries --------------------------------------------------------

    def raw_query(self, query: str, variables: dict | None = None) -> dict[str, Any]:
        """Execute a query and return the raw envelope, `errors` and all.

        Execution results (auth failures, missing objects) come back HTTP 200, but
        a query that fails *schema validation* returns HTTP 400 with the same
        `errors` envelope in the body. Both are normalised to a returned envelope
        here so callers only ever inspect `errors`.
        """
        body = json.dumps({"query": query, "variables": variables or {}}).encode()
        request = urllib.request.Request(
            API_URL, data=body,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.token()}",
            },
        )
        try:
            with urllib.request.urlopen(request) as response:
                return json.loads(response.read())
        except urllib.error.HTTPError as exc:
            raw = exc.read().decode(errors="replace")
            try:
                payload = json.loads(raw)
            except json.JSONDecodeError:
                raise ChromaticError(f"HTTP {exc.code} from the API: {raw[:500]}") from exc
            if payload.get("errors"):
                return payload
            raise ChromaticError(f"HTTP {exc.code} from the API: {raw[:500]}") from exc

    def query(self, query: str, variables: dict | None = None) -> dict[str, Any]:
        """Execute a query, raising on `errors`, and return the `data` object.

        The API answers HTTP 200 even for auth and not-found failures, so the
        `errors` array is the only signal — but note that a missing object comes
        back as a plain `null` with no `errors` at all. Callers still need to
        null-check the fields they asked for.
        """
        payload = self.raw_query(query, variables)
        if payload.get("errors"):
            messages = "; ".join(e.get("message", str(e)) for e in payload["errors"])
            raise ChromaticError(f"GraphQL error: {messages}")
        return payload.get("data") or {}

    def paginate(
        self, query: str, variables: dict, path: str, page_size: int = 50
    ) -> list[dict[str, Any]]:
        """Walk a Relay connection and return every node.

        `path` is a dotted path to the connection in the `data` object, e.g.
        "project.build.tests". The query must accept `$first` and `$after` and
        select `pageInfo { hasNextPage endCursor }`.
        """
        nodes: list[dict[str, Any]] = []
        after: str | None = None
        while True:
            page_vars = {**variables, "first": page_size}
            if after:
                page_vars["after"] = after
            data: Any = self.query(query, page_vars)
            for key in path.split("."):
                if data is None:
                    raise ChromaticError(
                        f"Path '{path}' hit a null at '{key}'. The object may not "
                        f"exist, or the build may not be a CompletedBuild."
                    )
                data = data[key]
            nodes.extend(edge["node"] for edge in data["edges"])
            if not data["pageInfo"]["hasNextPage"]:
                return nodes
            after = data["pageInfo"]["endCursor"]


ACCOUNT_PROJECTS_QUERY = """query($id: ID!) {
  account(id: $id) {
    id name webUrl
    projects { id name webUrl }
  }
}"""


def strip_type_prefix(gid: str) -> str:
    """`Project:665a...` -> `665a...`.

    Responses return type-prefixed ids, but arguments take the bare hex form, so
    ids read out of one response cannot be fed straight back into the next query.
    """
    return gid.split(":", 1)[-1]


def list_projects(api: ChromaticAPI) -> dict[str, Any]:
    """Return the account object (with `projects`) for the token's own account."""
    account = api.query(ACCOUNT_PROJECTS_QUERY, {"id": api.account_id}).get("account")
    if account is None:
        raise ChromaticError(
            f"account({api.account_id}) returned null. The token's accountId claim "
            f"should always resolve — check the client still has account:read."
        )
    return account


def resolve_project_id(api: ChromaticAPI, ref: str) -> str:
    """Accept a project id (bare or type-prefixed) or an exact project name."""
    bare = strip_type_prefix(ref)
    if len(bare) == 24 and all(c in "0123456789abcdef" for c in bare.lower()):
        return bare

    projects = list_projects(api)["projects"]
    matches = [p for p in projects if p["name"] == ref]
    if not matches:
        names = ", ".join(sorted(p["name"] for p in projects))
        raise ChromaticError(f"No project named '{ref}'. Available: {names}")
    if len(matches) > 1:
        ids = ", ".join(strip_type_prefix(p["id"]) for p in matches)
        raise ChromaticError(
            f"'{ref}' is ambiguous — {len(matches)} projects share that name ({ids}). "
            f"Pass the id instead."
        )
    return strip_type_prefix(matches[0]["id"])


def run_cli(fn) -> None:
    """Run a CLI entrypoint, turning ChromaticError into a clean stderr exit."""
    try:
        fn()
    except ChromaticError as exc:
        print(f"error: {exc}", file=sys.stderr)
        sys.exit(1)
    except BrokenPipeError:
        sys.exit(0)
