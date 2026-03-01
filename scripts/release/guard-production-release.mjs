#!/usr/bin/env node
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const MODE = process.argv.includes('--mode=release') ? 'release' : 'pr';

function run(cmd, opts = {}) {
  return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], ...opts }).trim();
}

function fail(message) {
  console.error(`\n[release-guard] FAIL: ${message}`);
  process.exit(1);
}

function info(message) {
  console.log(`[release-guard] ${message}`);
}

function parseJsonFromMixedOutput(raw) {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('No JSON object found in output');
  }
  return JSON.parse(raw.slice(start, end + 1));
}

function assertStaticConfig(repoRoot) {
  const easPath = path.join(repoRoot, 'eas.json');
  if (!fs.existsSync(easPath)) fail('eas.json is missing');

  const eas = JSON.parse(fs.readFileSync(easPath, 'utf8'));
  const productionProfile = eas?.build?.production;
  if (!productionProfile) fail('eas.json build.production profile is missing');
  if (productionProfile.channel !== 'production') {
    fail(`eas.json build.production.channel must be "production"; got "${productionProfile.channel}"`);
  }

  info('eas.json production profile channel is correctly set to production');
}

function assertGitState() {
  const head = run('git rev-parse --short HEAD');
  const branch = run('git rev-parse --abbrev-ref HEAD');
  const status = run('git status --porcelain');

  if (branch !== 'production') {
    fail(`release branch must be production; current branch is ${branch}`);
  }
  if (status.length > 0) {
    fail('working tree is dirty; OTA must be published from a clean commit');
  }

  run('git fetch origin production main --prune');

  const headFull = run('git rev-parse HEAD');
  const originProduction = run('git rev-parse origin/production');
  if (headFull !== originProduction) {
    fail('HEAD does not match origin/production; push branch tip first');
  }

  try {
    run('git merge-base --is-ancestor origin/main HEAD');
  } catch {
    fail('production does not include latest origin/main; merge main into production first');
  }

  info(`git checks passed at ${head}`);
}

function assertEasChannelMapping() {
  const token = process.env.EXPO_TOKEN;
  if (!token) {
    fail('EXPO_TOKEN is required in release mode to validate EAS channel mapping');
  }

  const raw = run('npx eas channel:list --json --non-interactive', {
    env: { ...process.env, CI: '1' },
  });
  const parsed = parseJsonFromMixedOutput(raw);
  const channels = parsed?.currentPage ?? [];
  const production = channels.find((c) => c?.name === 'production');
  if (!production) fail('EAS channel "production" not found');

  const branches = production?.updateBranches ?? [];
  const branchNames = branches.map((b) => b?.name).filter(Boolean);
  if (!branchNames.includes('production')) {
    fail(`EAS channel production must map to update branch production; got [${branchNames.join(', ')}]`);
  }

  info('EAS production channel mapping includes update branch production');
}

function main() {
  const repoRoot = process.cwd();
  info(`mode=${MODE}`);

  assertStaticConfig(repoRoot);

  if (MODE === 'release') {
    assertGitState();
    assertEasChannelMapping();
  }

  info('all guards passed');
}

main();
