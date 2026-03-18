#!/usr/bin/env node
import { spawnSync } from 'node:child_process'

function runStep(name, cmd, args) {
  console.log(`\n[RUN ] ${name}`)
  const result = spawnSync(cmd, args, {
    stdio: 'inherit',
    env: process.env,
  })

  if (result.status !== 0) {
    console.error(`[FAIL] ${name}`)
    process.exit(result.status ?? 1)
  }

  console.log(`[PASS] ${name}`)
}

function main() {
  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm'

  const steps = [
    ['Engineering quality gates', [npmCmd, ['run', 'quality:gates']]],
    ['Production build', [npmCmd, ['run', 'build']]],
    ['Full test suite', [npmCmd, ['test', '--', '--run']]],
    ['HTTP smoke suite', [npmCmd, ['run', 'smoke:http']]],
  ]

  for (const [name, [cmd, args]] of steps) {
    runStep(name, cmd, args)
  }

  console.log('\nLaunch candidate checks passed.')
}

main()
