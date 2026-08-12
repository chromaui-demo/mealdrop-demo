# Triage playbook

The scripts gather evidence. This is how to reach a verdict from it.

Both workflows share one rule: **state which category a finding falls into, and say
what evidence put it there.** "Looks fine" is not a triage result. If the evidence
does not settle it, say so and name the one thing that would.

---

## Visual changes

```bash
./visual_triage.py <project> [number] --limit 10
```

Then read `INDEX.md`, and for each set: `diff.png` first (changed pixels
highlighted), then `baseline.png` against `head.png` to see what actually moved.
`focus.png` narrows to the changed region on large snapshots.

### Establish the blast radius before judging anything

The manifest carries the build's commit, its subject, and the files it touched.
Compare that against the list of changed stories:

- **Changed stories trace to changed files** → the change is explainable. Judge it
  on its merits.
- **Stories changed that the commit never touched** → this is the important signal.
  Either a shared token/primitive has wider reach than intended, or something
  non-deterministic is in play. Do not wave it through because the intended change
  looks right.

A commit touching one component that produces changes across dozens of unrelated
stories is the single most common way a real regression hides behind an expected
one.

### Categories

| Verdict | What it looks like | Action |
|---|---|---|
| **Intended** | Matches the commit's stated purpose, confined to the components it touched | Accept |
| **Unintended side effect** | Real and deterministic, but in components the change should not have reached | Investigate the shared dependency — usually a theme token or a base component |
| **Non-deterministic** | Animation mid-frame, spinner position, carousel offset, a date/time, random or seeded fixture data | Fix the source of the nondeterminism; do not accept the snapshot |
| **Environmental** | Font fallback, scrollbar, device pixel ratio, image not yet loaded | Fix the capture setup, not the component |

### Non-determinism red flags

Check for these before accepting anything that looks like a small pixel shift:

- CSS `keyframes`/`animation`/`transition` on or under the component
- SVG `<animate>` / `<animateTransform>`
- Carousels, spinners, skeletons, progress bars
- `Date`/`Math.random`/locale-dependent formatting in stories or fixtures
- Lazy-loaded images (`loading="lazy"`) that may not have settled

A story whose baseline and head differ only in the *phase* of an animation is
flaky, and accepting it just re-rolls the dice on the next build. Fix it by
disabling the animation for the snapshot (Chromatic pauses CSS animations by
default; SVG SMIL animations and JS-driven motion are not covered) or by pinning
the component to a fixed state in the story.

### Reporting

Per changed story: component/story, verdict, one sentence of evidence. Group the
"intended" ones; spell out every "unintended" and "non-deterministic" one
individually with the specific thing that needs fixing.

---

## Interaction failures

```bash
./interaction_triage.py <project> --find      # locate the last errored build
./interaction_triage.py <project> <number>
```

The packet gives you the error, the query the test was waiting on, the rendered DOM
at the moment of failure, and the repo files behind the app stack frames.

### Read in this order

1. **`queried by` vs `rendered text`.** The test said what it wanted; the DOM says
   what was there. Most failures are visible in that one comparison.
2. **The rest of the DOM** (`dom.html`) — is the component in the state the story
   intended at all? A "loading" test that captured the loaded state is a different
   bug from a bad matcher.
3. **The app frames** — open the story file and read the `play` function.

### Categories

| Cause | Signature | Fix belongs in |
|---|---|---|
| **Matcher mismatch** | Element is on screen; the query does not match it | The test |
| **Wrong state captured** | DOM shows a different phase than the story set up | Story setup, mocks, or the component |
| **Timing** | `INTERACTION_TEST_TIMEOUT`, or DOM shows a state that would have resolved | Use `findBy*`/`waitFor` instead of `getBy*`; raise the timeout only as a last resort |
| **Genuine regression** | DOM is missing markup the component should render | The component |

### Matcher mismatches worth knowing

The near-misses that burn the most time, all invisible until you see the DOM:

- **Typographic vs ASCII punctuation** — `…` (U+2026) against `...`, curly quotes
  against straight, `–` against `-`
- **Regex metacharacters read as literals** — `findByText(/food.../)` needs *three*
  characters after "food" because `.` is a wildcard. Against rendered `food…`
  (one character) it cannot match. Escape it (`\.\.\.`) or match the real text
- **Whitespace and case** — the DOM serializer collapses differently than the
  source; prefer `{ exact: false }` or a function matcher over brittle strings
- **Text split across elements** — Testing Library says so explicitly in the
  message; use a function matcher

### Proposing a fix

Decide which side is wrong before writing anything:

- **App renders the right thing, test asks for the wrong thing** → fix the test.
  Match what actually renders, and prefer a matcher that survives copy edits.
- **App renders the wrong thing** → fix the component. Do not loosen the assertion
  to make a real failure pass.

Quote the exact line (`file:line`), the current code, and the replacement. If the
same root cause affects several stories, say so once and list them — the E2E
project's four failures shared one cause.

### When the payload is thin

Detail quality depends on the runner. Storybook interaction tests give a real
`TestingLibraryElementError` with the failing matcher; some E2E setups report only
`Error: ignoredException` with no DOM. When that happens, say the API payload is
insufficient and point at the test URL rather than guessing a cause.
