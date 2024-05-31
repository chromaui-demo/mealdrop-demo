#!/usr/bin/env zx

import { readFileSync, writeFile } from 'node:fs'
import { Octokit } from 'octokit'

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

const branch = `ch-demo-${Number(new Date()).toString(36)}`

await $`git config user.email "varunvachhar@gmail.com"`
await $`git config user.name "Varun (Chromatic Demo Bot)"`
console.log(`checking out branch ${branch}`)
await $`git checkout -b ${branch}`
await $`git add .`
await $`git commit -m "Invert badge colors"`
console.log(`Created commit`)
await $`git push -u origin ${branch} --no-verify`
console.log(`Pushed commit`)

console.log(`PAT: ${process.env.PAT}`)

const octokit = new Octokit({
  auth: process.env.PAT,
})

try {
  await octokit.request('POST /repos/chromaui-demo/mealdrop-demo/pulls', {
    owner: 'chromaui-demo',
    repo: 'mealdrop-demo',
    title: 'Invert badge colors',
    head: branch,
    base: 'main',
    headers: {
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })
} catch (error) {
  console.error(error)
  console.log(error.response.data.errors)
}
