# Mobile Feature Flags Matrix

Canonical mobile root: `C:\dev\bitbridge-app`

## Current policy

- Default behavior in code is `0` (disabled) if an env var is missing.
- EAS profiles now set all mobile feature flags explicitly in `eas.json`.
- `EXPO_PUBLIC_FEATURE_DISPUTES` is intentionally `0` for now because backend `POST /api/v1/disputes` currently expects `circle_transaction_id`.

## Flags

- `EXPO_PUBLIC_FEATURE_OTP`
- `EXPO_PUBLIC_FEATURE_BVN`
- `EXPO_PUBLIC_FEATURE_KYC_CENTER`
- `EXPO_PUBLIC_FEATURE_CIRCLES`
- `EXPO_PUBLIC_FEATURE_TIMELINE`
- `EXPO_PUBLIC_FEATURE_NEW_DASHBOARD`
- `EXPO_PUBLIC_FEATURE_ONBOARDING`
- `EXPO_PUBLIC_FEATURE_TRANSACTION_PIN`
- `EXPO_PUBLIC_FEATURE_ORDERS`
- `EXPO_PUBLIC_FEATURE_DISPUTES`
- `EXPO_PUBLIC_FEATURE_REWARDS`
- `EXPO_PUBLIC_FEATURE_STATS`
- `EXPO_PUBLIC_FEATURE_CARD_TOKENS`
- `EXPO_PUBLIC_FEATURE_PAYMENT_TOOLS`
- `EXPO_PUBLIC_FEATURE_LEGACY_HOME`

## Profile values

- `development`: all enabled except `EXPO_PUBLIC_FEATURE_DISPUTES=0`, `EXPO_PUBLIC_FEATURE_LEGACY_HOME=0`
- `preview`: all enabled except `EXPO_PUBLIC_FEATURE_DISPUTES=0`, `EXPO_PUBLIC_FEATURE_LEGACY_HOME=0`
- `production`: all enabled except `EXPO_PUBLIC_FEATURE_DISPUTES=0`, `EXPO_PUBLIC_FEATURE_LEGACY_HOME=0`

## Follow-up for disputes

To enable disputes safely, align backend/mobile contract first:

- Option A: add order/bill dispute endpoint on backend.
- Option B: keep circle-only dispute and only surface it from circle transactions.
