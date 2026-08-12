# Chromatic API schema notes

Observed against the live schema (169 types). Use `introspect.py --refresh` to
re-check rather than trusting this file — it is a map, not a contract.

## Auth

```
POST https://www.chromatic.com/token
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials
client_id=...
client_secret=...
resource=https://www.chromatic.com/api     # required; without it the token's aud won't match /api
```

Response: `access_token`, `token_type: Bearer`, `expires_in: 3600`, `scope`.

JWT payload claims (decode, don't verify — it's our own token):

| Claim | Meaning |
|---|---|
| `clientId` | the M2M client |
| `userId` | synthetic service user |
| `accountId` | **the account the client is bound to** — the only one it can read |
| `scope` | space-separated |
| `aud` | `/api` |
| `exp` | absolute expiry; tokens last 60 min |

M2M clients have no `user:read` scope, so `{ viewer }` is not available. Identity
comes from the `accountId` claim instead.

Typical M2M scope set: `account:read account:write build:read build:write
project:read project:write storybook:read`.

## Entry points

The complete root `Query`:

```
account(id: ID)            build(id: ID)          project(id: ID)
storybook(url: URL)        viewer()               figmaMetadata(key: String)
bulkFigmaMetadata(keys: String)                   figmaMetadataById(id: ObjID)
```

That is the whole surface. There is **no aggregate, dashboard, date-range, or
groupBy entry point** — the `/dash?view=a11y&groupBy=test&dayrange=7` view cannot
be reproduced from the API. `viewer` is unavailable to M2M clients (no `user:read`).

`build(id:)` fetches a build directly, without going through its project.

```
Account
  id name webUrl projects[]

Project
  id name type features publicAccountInfo linkedRepository account
  manageUrl webUrl projectToken figmaToken
  branchNames(limit:)
  build(number:) -> Build
  lastBuild(defaultBranch:, branches:, statuses:, results:, slug:, ...) -> Build
  quarantinedStories(first:, last:, after:, before:)
  createdAt updatedAt
```

## Build is an interface

Implementors, in lifecycle order:

`AnnouncedBuild` → `PublishedBuild` → `PreparedBuild` → `StartedBuild` → `CompletedBuild`

The interface itself only exposes `id number status error isLimited isSuperseded
browsers slug branch commit parentCommits uncommittedHash commitUrl createdAt
updatedAt committedAt`.

`CompletedBuild` adds:

```
result webUrl isolatorUrl storybookUrl
componentCount specCount docsCount
testCount(statuses:, results:, reviewable:)
tests(statuses:, storyId:, first:, last:, after:, before:, orderBy:) -> CompletedBuildTestConnection
discussions(...) componentRepresentations(...)
publishedAt preparedAt startedAt completedAt
```

`PreparedBuild` and `StartedBuild` have their own `*TestConnection` types. Anything
selecting only `... on CompletedBuild` returns nothing for an in-flight build —
select `__typename` so you can tell that apart from an empty result.

## Test

```
Test
  id status result baseline webUrl
  visualComparisons[] accessibilityComparisons[]
  kinds isUnstable parameters mode { name globals } story
  createdAt updatedAt

Story
  id storyId csfId name storybookUrl captureImage component
```

## Accessibility

The whole surface. There is no absolute violation list — a schema-wide sweep for
`a11y|accessib|axe|violation|report|json` field names finds only
`Test.accessibilityComparisons` and the unrelated `Capture.errorsJsonUrl`.

```
AccessibilityComparison
  id result            # EQUAL | CHANGED | ADDED
  platform: BrowserInfo   viewport: ViewportInfo
  baseCapture: Capture    headCapture: Capture
  diff: AccessibilityDiff

AccessibilityDiff
  id result            # CaptureDiffResult
  rules: [AccessibilityDiffRule]

AccessibilityDiffRule
  rule                 # axe rule id, e.g. "color-contrast"
  title description helpUrl
  change               # net element delta: +n added, 0 unchanged, -n removed
  new:      [AccessibilityViolationElement]   # regression
  removed:  [AccessibilityViolationElement]   # fixed
  existing: [AccessibilityViolationElement]   # pre-existing

AccessibilityViolationElement
  selector             # CSS selector only — no colors, no DOM snippet, no impact level
```

`Capture` carries `result captureImage(signed:) captureError errorsJsonUrl(signed:)
deviceScaleFactor ignoredRegions` — nothing a11y-related. On an a11y comparison's
`headCapture`, `errorsJsonUrl` is null and `captureImage` is just a screenshot, so
the absolute axe report is genuinely absent rather than merely hard to find.

## Images

```
VisualComparison.diff -> VisualDiff
  diffImage(signed: Boolean = true):  CaptureOverlayImage   # changed-pixel overlay
  focusImage(signed: Boolean = true): CaptureOverlayImage
TestComparison.captureDiff -> CaptureDiff                   # same two fields
Capture.captureImage(signed:) -> CaptureImage
  imageUrl thumbnailUrl imageWidth imageHeight backgroundColor textDirection
```

`signed` defaults to **true**; the URL then carries an `assetToken` JWT
(`resourceKey` + `exp`, ~60 min) and returns 200. `signed: false` yields a URL that
401s. Verified: a `diffImage` fetch returned a real 112×32 PNG.

`errorsJsonUrl` returned HTTP 403 (S3 `AccessDenied`) on every capture tried,
including freshly signed URLs on captures that definitely errored. Use
`captureError` instead.

## Capture errors

`CaptureError` is an interface with 13 implementors. `CaptureErrorKind` values:
`JS_ERROR, IMAGE_TOO_LARGE, NAVIGATION_TIMEOUT, RENDER_TIMEOUT,
INTERACTION_TEST_TIMEOUT, PAGE_EVALUATE_TIMEOUT, NO_JS, FAILED_JS, STORY_MISSING,
INTERACTION_FAILURE, COMPONENT_OFF_PAGE, SCREENSHOT_TIMEOUT`.

Payload-bearing implementors:

| Type | Extra field |
|---|---|
| `CaptureErrorInteractionFailure` | `error: JSONObject` — `{name, message, stack}` |
| `CaptureErrorJSError` | `error: JSONObject` |
| `CaptureErrorFailedJS` | `error: JSONObject` |
| `CaptureErrorInteractionTestTimeout` | `timeoutMs: Int` |
| `CaptureErrorImageTooLarge` | `maxImagePixels: Int` |

A failed interaction test has `Test.status: BROKEN`, `Test.result: CAPTURE_ERROR`,
and `Capture.result: CAPTURE_ERROR`. The `stack` string embeds a full serialized
DOM dump — tens of KB. Observed real payload:

```
TestingLibraryElementError: Unable to find an element with the text:
/Looking for some food.../i ...
  at play (.../RestaurantDetailPage.stories-Bx-j4EKp.js:1:2475)
```

Detail quality depends on the runner — the Playwright E2E project reported only
`Error: ignoredException` for all four of its failures.

Relevant enums: `TestStatus` = `IN_PROGRESS, PASSED, PENDING, ACCEPTED, DENIED,
BROKEN, FAILED, UNSTABLE, IGNORED`; `TestResult` = `EQUAL, FIXED, ADDED, CHANGED,
REMOVED, CAPTURE_ERROR, SYSTEM_ERROR, SKIPPED, UNSTABLE`; `BuildResult` =
`SUCCESS, CAPTURE_ERROR, SYSTEM_ERROR, TIMEOUT`.

Find errored builds without scanning history:
`Project.lastBuild(results: [CAPTURE_ERROR, SYSTEM_ERROR, TIMEOUT])`.

### The blind spot

`diff` is null for `ADDED` comparisons and for many `EQUAL` ones. A representative
build of 92 tests:

| comparison.result | diff.result | count |
|---|---|---|
| EQUAL | null | 59 |
| EQUAL | EQUAL (0 rules) | 21 |
| CHANGED | CHANGED | 10 |
| ADDED | null | 2 |

Only the 10 `CHANGED` rows carried findings. The 61 null-diff comparisons could
hide violations and the API will not say. `existing` entries do surface on
comparisons that *have* a diff, which is the one bit of evidence that long-standing
violations are not universally hidden — but it does not cover the null-diff rows.

Always report counts from this endpoint as a floor.

## Response shape gotchas

- Execution results are HTTP 200 regardless of outcome — check `errors`, and
  separately null-check requested fields.
- Schema validation failures are the exception: HTTP 400, same `errors` envelope
  in the body, `extensions.code: GRAPHQL_VALIDATION_FAILED`. A client that only
  reads `errors` on 2xx will raise a transport error on a simple typo.

  ```
  HTTP 400
  {"errors":[{"message":"Your query doesn't match the schema. Try double-checking it!",
   "locations":[{"line":1,"column":9}],
   "extensions":{"code":"GRAPHQL_VALIDATION_FAILED"}}]}
  ```
- A missing object is `null` with no `errors` entry — indistinguishable from an
  auth failure without further probing.
- **The same field cannot appear twice in one selection set, even under distinct
  aliases.** `a: testCount b: testCount` fails validation; so does
  `a: testCount(results: [CAPTURE_ERROR]) b: testCount(results: [SYSTEM_ERROR])`.
  The spec permits both. Split into separate requests, or use one call with a list
  argument. Different fields alias fine (`a: testCount specCount` works).
- Validation errors often omit `locations`, so the generic message is all you get —
  bisect the query to find the offending selection.
- Ids are returned type-prefixed (`Account:…`, `Project:…`, `Test:…`) but consumed
  bare.
- Connections are Relay-style: `edges { node { … } }` plus
  `pageInfo { hasNextPage endCursor }`. Page size 50 works; 100 was not tested.
