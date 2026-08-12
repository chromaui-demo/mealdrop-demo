---
name: chromatic-api
description: Query the Chromatic GraphQL API with an M2M OAuth client, and triage what it returns. Use when asked to pull data from Chromatic; inspect a build, its snapshots, or its a11y issues; review or triage visual changes and decide whether a diff is intended or a regression; debug a failing interaction test and propose a fix; check what a Chromatic token can access; or explore the Chromatic API schema.
---

# Chromatic API

Scripted access to `https://www.chromatic.com/api` using the OAuth 2.0 client
credentials grant. All scripts are stdlib-only Python 3.9+, no dependencies.

## Setup

Credentials resolve in this order: `CHROMATIC_CLIENT_ID` / `CHROMATIC_CLIENT_SECRET`
env vars, then `$CHROMATIC_ENV_FILE`, then `.env.chromatic` at the repo root.

```bash
cat > .env.chromatic <<'EOF'
CHROMATIC_CLIENT_ID=...
CHROMATIC_CLIENT_SECRET=...
EOF
```

`.env.chromatic` is gitignored. The secret is bearer-equivalent — never commit it,
never paste it into a report, and rotate it if it leaks into a transcript or shell
history.

Tokens are cached at `~/.cache/chromatic-api/token-*.json` (mode 600) and reused
until two minutes before expiry, so scripts do not re-authenticate on every call.

## Scripts

Run from `scripts/`. `<project>` is a project id or an exact project name.

| Command | Purpose |
|---|---|
| `./whoami.py` | Token check: account, scopes, expiry, visible projects. **Run this first when something fails.** |
| `./build.py <project> [number]` | Build summary; omit the number for the latest build. |
| `./a11y_report.py <project> [number]` | Accessibility findings. `--markdown`, `--json`, `--selectors`. |
| `./test_errors.py <project> [number]` | Errored tests — interaction failures, JS errors, timeouts. `--find`, `--stack`, `--json`. |
| `./visual_triage.py <project> [number]` | Download baseline/head/diff images + manifest for changed stories. `--limit`, `--story`, `--out`, `--all`. |
| `./interaction_triage.py <project> [number]` | Debug packet per failing interaction test: DOM at failure, cleaned stack, repo sources. `--find`, `--out`, `--json`. |
| `./introspect.py [Type]` | Schema explorer: `--search`, `--returning`, `--implementors`, `--refresh`. |
| `./cq.py '<query>' '<vars>'` | Arbitrary GraphQL. `--paginate <dotted.path>` walks a connection. |
| `./contrast.py <fg> <bg>` | WCAG ratio, for triaging `color-contrast` findings. |

`chromatic_api.py` is the shared library — import `ChromaticAPI` for anything new
rather than re-implementing token handling.

```python
from chromatic_api import ChromaticAPI, resolve_project_id
api = ChromaticAPI()
data = api.query("query($id: ID!) { project(id: $id) { name } }", {"id": pid})
nodes = api.paginate(QUERY, {"id": pid, "n": 252}, path="project.build.tests")
```

## Five things that will bite you

**A 200 does not mean success, and a failure is not always a 200.** Execution
results — auth failures, missing objects — come back HTTP 200 with the problem in
the body's `errors` array. Schema *validation* failures instead return HTTP 400,
with the same `errors` envelope in the body. `raw_query()` normalises both, so you
only ever inspect `errors`.

Worse, a missing or inaccessible object is a bare `null` with *no* `errors` entry,
so `errors`-only checking reports silent failure as success. Null-check the fields
you asked for. `api.query()` raises on `errors`; the null check is yours.

**Never hardcode an account id.** The token's `accountId` claim is the account the
client is bound to; ask for a different one and you get `{"data":{"account":null}}`.
`api.account_id` reads it from the token. Project ids and account ids are both
24-char hex and are easy to confuse — a project id passed to `account(id:)` returns
null, which looks identical to an auth failure.

**`Build` is an interface.** `AnnouncedBuild`, `PublishedBuild`, `PreparedBuild`,
`StartedBuild`, `CompletedBuild`. Fields like `tests`, `result`, and `webUrl` only
exist on the concrete types, so queries need `... on CompletedBuild { }`. An
in-progress build silently yields nothing from a `CompletedBuild`-only selection.

**The same field cannot be aliased twice in one selection set.** `a: testCount
b: testCount` is rejected as `GRAPHQL_VALIDATION_FAILED`, even though the spec
allows it and even when the arguments differ. Issue separate requests, or fold the
variants into one call with a list argument —
`testCount(results: [CAPTURE_ERROR, SYSTEM_ERROR])`. Validation messages are
generic ("Your query doesn't match the schema") and often carry no `locations`, so
bisect the query when one appears.

**Accessibility data is a diff, not an audit.** See below.

## Accessibility findings are diffs

`Test.accessibilityComparisons` is the only a11y surface in the schema — there is
no absolute violation list anywhere. Each comparison carries an
`AccessibilityDiff` whose `rules` classify axe findings against the baseline:

- `new` — in head, not in baseline → a regression this build introduced
- `existing` — in both → pre-existing, carried over
- `removed` — in baseline, not in head → fixed

**A comparison whose `diff` is null contributes nothing.** That happens for `ADDED`
comparisons (a new story has no baseline to diff against) and for many `EQUAL`
ones. Violations inside those are invisible to the API.

So any count from this endpoint is a **floor, not a total**. `a11y_report.py`
prints the blind-spot tally explicitly and names the `ADDED` stories. Report it
that way too — do not present the number as a complete audit. For absolute
violations, the build UI is the source of truth.

**The a11y dashboard (`/dash?view=a11y`) has no API equivalent.** Root `Query`
exposes only `account`, `build`, `project`, `storybook`, `viewer`, and the Figma
helpers — there is no aggregate, date-range, or `groupBy` entry point anywhere in
the schema, and the a11y scan's own `Capture` carries only a screenshot (its
`errorsJsonUrl` is null, and no axe payload hangs off it). Anything resembling that
view has to be rebuilt client-side by walking builds and summing diffs, which
inherits the floor-not-total caveat above.

Findings give you a rule id and a CSS selector. Selectors are styled-components
hashes (`.sc-gnOvAp`) that change between builds, so trace them structurally —
match `:nth-child(n)` against the component's JSX to name the real element, then
`contrast.py` the resolved theme tokens to confirm a `color-contrast` failure.

## Triage workflows

Two of the scripts are the data-gathering half of a workflow whose other half is
judgement. **Read `references/triage-playbook.md` before running either** — it has
the categories to sort findings into and the failure modes worth checking. The
scripts deliberately do not guess a verdict.

**Triaging visual changes** — is a change intended or a regression?

```bash
./visual_triage.py <project> [number] --limit 10
```

Downloads `baseline.png`, `head.png`, `diff.png` and `focus.png` per changed
comparison into `chromatic-triage/<project>-<n>/`, with `INDEX.md` and
`manifest.json`. Then **read the images** — `diff.png` first, then baseline against
head. The manifest also carries the build's commit and the files it touched, so the
first question is always whether the set of changed stories matches the set of
changed files. Stories changing that the commit never touched is the finding that
matters most.

**Triaging interaction failures** — why did it fail, and what fixes it?

```bash
./interaction_triage.py <project> --find     # find the last errored build
./interaction_triage.py <project> <number>
```

Splits each capture error into the query the test was waiting on, the **rendered
DOM at the moment of failure** (written to `dom.html`; its visible text is printed),
the stack with runtime frames dropped, and the repo files behind the app frames.
Comparing `queried by` against `rendered text` resolves most failures on sight.

Both write under `./chromatic-triage/` in the working directory — add that to
`.gitignore` (this repo already has it) or pass `--out`.

## Snapshot and diff images

`VisualComparison.diff` → `VisualDiff` gives `diffImage` (the changed-pixel
overlay) and `focusImage`, alongside `baseCapture`/`headCapture.captureImage` for
the before and after. `TestComparison.captureDiff` → `CaptureDiff` is the same
shape.

All image fields take `signed: Boolean`, **defaulting to `true`** — the returned
URL carries an `assetToken` JWT valid for ~60 minutes. Passing `signed: false`
returns a URL that 401s. Download promptly or re-query; the URL is not a permalink.

`Capture.errorsJsonUrl` is the exception: it 403'd on every capture tried, signed
or not. Read errors from `captureError` instead.

## Errored and interaction tests

A failing interaction test is reported as a **capture** error, not a distinct
entity. The story's capture aborts, `Test.result` becomes `CAPTURE_ERROR` and
`Test.status` becomes `BROKEN`. Detail hangs off `Capture.captureError`, a
`CaptureError` interface with 13 implementors — spread the concrete types to reach
the payload:

```graphql
captureError {
  __typename kind
  ... on CaptureErrorInteractionFailure { error }      # JSONObject
  ... on CaptureErrorInteractionTestTimeout { timeoutMs }
  ... on CaptureErrorJSError { error }
}
```

`CaptureErrorInteractionFailure.error` is the play-function error: `name`,
`message`, and a `stack` that embeds a full serialized DOM dump (often tens of KB
— truncate before printing). Quality varies by runner: Storybook interaction tests
give a real `TestingLibraryElementError` with the failing matcher, while the E2E
projects reported only `Error: ignoredException`.

To locate errored builds, filter at the build level rather than scanning history:
`lastBuild(results: [CAPTURE_ERROR, SYSTEM_ERROR, TIMEOUT])`. That is what
`test_errors.py --find` does.

## Canonical queries

Account and projects (`accountId` from the token):

```graphql
query($id: ID!) { account(id: $id) { id name webUrl projects { id name webUrl } } }
```

A build by number, guarding the interface:

```graphql
query($id: ID!, $n: Int!) {
  project(id: $id) {
    build(number: $n) {
      __typename number status branch commit
      ... on CompletedBuild { result webUrl testCount }
    }
  }
}
```

Ids come back type-prefixed (`Project:665a…`) but arguments take the bare hex, so
an id read from one response cannot be fed straight into the next query — use
`strip_type_prefix()`.

Pagination is Relay-style: pass `$first`/`$after`, select
`pageInfo { hasNextPage endCursor }`, and let `api.paginate()` walk it.

`references/schema-notes.md` has the type map and field inventory.
`references/triage-playbook.md` has the verdict criteria for both triage workflows.
