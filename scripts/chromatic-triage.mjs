#!/usr/bin/env node
/**
 * Triage Chromatic builds from the command line via the Chromatic GraphQL API.
 *
 * Usage:
 *   node scripts/chromatic-triage.mjs status [--branch <name>]
 *   node scripts/chromatic-triage.mjs watch  [--branch <name>]
 *   node scripts/chromatic-triage.mjs accept --all [--branch <name>]
 *   node scripts/chromatic-triage.mjs accept <testId> [<testId>...]
 *   node scripts/chromatic-triage.mjs deny   <testId> [<testId>...]
 *
 * Auth: set CHROMATIC_API_TOKEN (a user/CLI token; falls back to
 * CHROMATIC_PROJECT_TOKEN). The project ID is read from chromatic.config.json.
 */
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

const API_URL = process.env.CHROMATIC_API_URL ?? 'https://www.chromatic.com/api'
const TOKEN = process.env.CHROMATIC_API_TOKEN ?? process.env.CHROMATIC_PROJECT_TOKEN

if (!TOKEN) {
  console.error('Set CHROMATIC_API_TOKEN (or CHROMATIC_PROJECT_TOKEN) to authenticate.')
  process.exit(1)
}

// CI publishes to the project its token points at, which can differ from the
// (possibly stale) projectId in chromatic.config.json — allow an override.
const projectId =
  process.env.CHROMATIC_PROJECT_ID ??
  JSON.parse(readFileSync(new URL('../chromatic.config.json', import.meta.url))).projectId

async function gql(query, variables) {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TOKEN}`,
    },
    body: JSON.stringify({ query, variables }),
  })
  const body = await response.text()
  let parsed
  try {
    parsed = JSON.parse(body)
  } catch {
    throw new Error(`Unexpected response from ${API_URL} (HTTP ${response.status}): ${body.slice(0, 200)}`)
  }
  const { data, errors } = parsed
  if (errors?.length) {
    throw new Error(errors.map((error) => error.message).join('\n'))
  }
  return data
}

const BUILD_FIELDS = `
  id
  number
  branch
  commit
  status
  ... on StartedBuild {
    url: webUrl
    changeCount: testCount(results: [CHANGED])
    pendingCount: testCount(statuses: [PENDING])
  }
  ... on CompletedBuild {
    url: webUrl
    result
    changeCount: testCount(results: [CHANGED])
    pendingCount: testCount(statuses: [PENDING])
  }
`

const TESTS_FRAGMENT = `
  tests(first: 100, statuses: $statuses) {
    nodes {
      id
      status
      result
      kinds
      mode { name }
      story { name storyId component { name } }
      webUrl
      comparisons { result browser { key } viewport { name } }
    }
  }
`

const LAST_BUILD_QUERY = `
  query LastBuild($projectId: ID!, $branches: [String!], $statuses: [TestStatus!]) {
    project(id: $projectId) {
      name
      webUrl
      lastBuild(branches: $branches) {
        ${BUILD_FIELDS}
        ... on StartedBuild { ${TESTS_FRAGMENT} }
        ... on CompletedBuild { ${TESTS_FRAGMENT} }
      }
    }
  }
`

const REVIEW_MUTATION = `
  mutation ReviewTest($input: ReviewTestInput!) {
    reviewTest(input: $input) {
      updatedTests { id status story { name component { name } } }
      userErrors { ... on UserError { message } }
    }
  }
`

function currentBranch() {
  return execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim()
}

function parseArgs(argv) {
  const [command = 'status', ...rest] = argv
  const flags = { branch: currentBranch(), all: false, ids: [] }
  for (let index = 0; index < rest.length; index += 1) {
    if (rest[index] === '--branch') flags.branch = rest[(index += 1)]
    else if (rest[index] === '--all') flags.all = true
    else if (!rest[index].startsWith('--')) flags.ids.push(rest[index])
  }
  return { command, ...flags }
}

async function fetchBuild(branch, statuses) {
  const data = await gql(LAST_BUILD_QUERY, { projectId, branches: [branch], statuses })
  const build = data.project?.lastBuild
  if (!build) {
    console.error(`No build found for branch "${branch}" in project ${data.project?.name}.`)
    process.exit(1)
  }
  return { project: data.project, build }
}

function printBuild({ project, build }) {
  console.log(`Project:  ${project.name}`)
  console.log(`Build:    #${build.number} on ${build.branch} (${build.commit.slice(0, 7)})`)
  console.log(`Status:   ${build.status}${build.result ? ` (${build.result})` : ''}`)
  if (build.url) console.log(`URL:      ${build.url}`)
  if (build.changeCount !== undefined) {
    console.log(`Changes:  ${build.changeCount} changed, ${build.pendingCount} pending review`)
  }
  for (const test of build.tests?.nodes ?? []) {
    const a11y = test.kinds.includes('ACCESSIBILITY') ? ' [ACCESSIBILITY]' : ''
    const comparisons = test.comparisons
      .map((comparison) => `${comparison.browser.key}@${comparison.viewport.name}:${comparison.result}`)
      .join(', ')
    console.log(`\n- ${test.story?.component?.name} / ${test.story?.name} (${test.mode.name})${a11y}`)
    console.log(`  test:   ${test.id} → ${test.status}/${test.result}`)
    console.log(`  diffs:  ${comparisons}`)
    console.log(`  review: ${test.webUrl}`)
  }
}

async function review(ids, status, batch) {
  for (const testId of ids) {
    const data = await gql(REVIEW_MUTATION, { input: { testId, status, ...(batch && { batch }) } })
    const { updatedTests, userErrors } = data.reviewTest
    if (userErrors.length) {
      console.error(`✖ ${testId}: ${userErrors.map((error) => error.message).join('; ')}`)
      process.exitCode = 1
    } else {
      console.log(`✔ ${status} ${updatedTests.length} test(s)`)
    }
  }
}

const TERMINAL_STATUSES = new Set(['PASSED', 'PENDING', 'ACCEPTED', 'DENIED', 'BROKEN', 'FAILED', 'CANCELLED'])

const { command, branch, all, ids } = parseArgs(process.argv.slice(2))
const REVIEWABLE = ['PENDING', 'DENIED']

if (command === 'status') {
  printBuild(await fetchBuild(branch, REVIEWABLE))
} else if (command === 'watch') {
  for (;;) {
    const result = await fetchBuild(branch, REVIEWABLE)
    if (TERMINAL_STATUSES.has(result.build.status)) {
      printBuild(result)
      break
    }
    console.log(`Build #${result.build.number} is ${result.build.status}, waiting...`)
    await new Promise((resolve) => setTimeout(resolve, 15_000))
  }
} else if (command === 'accept' || command === 'deny') {
  const status = command === 'accept' ? 'ACCEPTED' : 'DENIED'
  if (all) {
    const { build } = await fetchBuild(branch, REVIEWABLE)
    const [first] = build.tests?.nodes ?? []
    if (!first) {
      console.log('Nothing to review.')
    } else {
      await review([first.id], status, 'BUILD')
    }
  } else if (ids.length === 0) {
    console.error(`Provide test IDs or --all to ${command} every change in the build.`)
    process.exit(1)
  } else {
    await review(ids, status)
  }
} else {
  console.error(`Unknown command "${command}". Use status, watch, accept, or deny.`)
  process.exit(1)
}
