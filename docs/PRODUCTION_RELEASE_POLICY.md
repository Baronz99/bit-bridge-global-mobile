# Production Release Policy (Bank-Grade Baseline)

## 1) Branch Strategy
- `main` is integration.
- `production` is the only release branch.
- All releases are `main -> production` via pull request.
- No direct push to `production`.

## 2) Required GitHub Protections (configure in repository settings)
- Protect branch: `production`
- Require pull request before merging
- Require at least 2 approvals
- Dismiss stale approvals on new commits
- Require status checks to pass:
  - `production-pr-gate / validate`
- Require signed commits
- Block force pushes
- Block branch deletion

## 3) OTA Publishing Rules
- OTA is published only by workflow `production-ota-release` on push to `production`.
- Workflow verifies:
  - clean git state
  - branch is exactly `production`
  - `HEAD == origin/production`
  - `production` includes latest `origin/main`
  - `eas.json` production channel is `production`
  - EAS channel `production` maps to update branch `production`
- OTA message includes commit SHA.

## 4) Required Secrets
- `EXPO_TOKEN` must be set in GitHub Actions secrets.

## 5) Release Checklist
1. Merge approved PR from `main` into `production`.
2. Confirm `production-pr-gate` is green.
3. Confirm `production-ota-release` succeeded.
4. Verify EAS update group references the expected commit SHA.
5. Validate KYC/Anchor synthetic smoke flow on production.
