#!/usr/bin/env zx

import { readFileSync, writeFile } from 'node:fs'
import { Octokit, App } from 'octokit'

const content = readFileSync('./src/components/Badge/Badge.tsx', 'utf8')

content.replace('background: ${color.badgeBackground};', 'background: ${color.badgeText};')

const updatedContent = content
  .replace('background: ${color.badgeBackground};', 'background: ${color.badgeText};')
  .replace('color: ${color.badgeText};', 'color: ${color.badgeBackground};')

writeFile('./src/components/Badge/Badge.tsx', updatedContent, (err) => {
  if (err) {
    console.error(err)
  } else {
    console.log('Badge.tsx updated')
  }
})

await $`git add .`
await $`git commit -m "Invert badge colors"`

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
})

await octokit.request('POST /repos/chromaui-demo/mealdrop-demo/pulls', {
  owner: 'OWNER',
  repo: 'REPO',
  title: 'Invert badge colors',
  head: `ch-demo-${Number(new Date()).toString(36)}`,
  base: 'main',
  headers: {
    'X-GitHub-Api-Version': '2022-11-28',
  },
})
