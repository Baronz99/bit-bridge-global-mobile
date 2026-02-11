# Phase 1 Perf Report (Instrumentation Only)

## Scope traced
- Receipt screen open:
  - Mobile route: `app/transaction/receipt.tsx`
  - API: `GET /api/v1/receipts/:reference`
  - Backend: `app/controllers/api/v1/receipts_controller.rb#show`
- Transaction details screen open:
  - Mobile route: `app/transaction/details.tsx`
  - API: `GET /api/v1/payment_processors/:id`
  - Backend: `app/controllers/api/v1/payment_processors_controller.rb#show`
- Transaction record details screen open:
  - Mobile route: `app/transaction/record/[reference].tsx`
  - API: `GET /api/v1/transaction_records/:id`
  - Backend: `app/controllers/api/v1/transaction_records_controller.rb#show`
- Transaction email generation:
  - Trigger: `app/models/transaction.rb#enqueue_receipt_email`
  - Job: `app/jobs/send_transaction_receipt_job.rb`
  - Mailer: `app/mailers/transaction_receipt_mailer.rb`
  - Bill order email path:
    - Trigger: `app/models/bill_order.rb#enqueue_receipt_email_if_terminal`
    - Job: `app/jobs/send_order_receipt_job.rb`
    - Mailer: `app/mailers/order_mailer.rb`

## Instrumentation added
- Mobile helper:
  - `utils/perfTrace.ts`
  - Enabled when `__DEV__` or `EXPO_PUBLIC_DEBUG_PERF=true`
  - Emits `console.time/timeEnd` and `[PERF]` marks
- Mobile screen timings:
  - `app/transaction/receipt.tsx`
    - `receipt:api:*` (time to first data)
    - `receipt:ui_after_data:*` (time to render after data set)
    - `receipt:transform` (receipt normalization/derivation time)
  - `app/transaction/details.tsx`
    - `tx_details:api:*`
    - `tx_details:ui_after_data:*`
    - `tx_details:transform:status` mark
  - `app/transaction/record/[reference].tsx`
    - `tx_record:api:*`
    - `tx_record:ui_after_data:*`
- Backend endpoint timings + SQL counters:
  - `app/controllers/api/v1/receipts_controller.rb`
  - `app/controllers/api/v1/transaction_records_controller.rb`
  - `app/controllers/api/v1/payment_processors_controller.rb`
  - Logs:
    - `[PERF][<controller.action>] total_ms=... sql_count=... sql_ms=...`
  - Enabled in `development` or with `DEBUG_PERF=true`
- Backend email timings:
  - `app/jobs/send_transaction_receipt_job.rb`
  - `app/jobs/send_order_receipt_job.rb`
  - Logs:
    - `[PERF][send_*_receipt_job.mail] ... mail_ms=...`
    - `[PERF][send_*_receipt_job.perform] ... total_ms=...`

## Initial evidence from code inspection (no behavior change)
- `ReceiptsController` resolves multiple branches and can call `current_user.cards.pluck(:card_id)` in more than one resolver path, which can increase per-request query count.
- `receipt.tsx` performs non-trivial normalization and fee/timeline shaping before render.
- `BankReceiptCard` performs sorting and multiple derived-field computations on render path.

## Captured timings so far
- Build-time sanity only (not user-flow runtime):
  - `npx expo export:embed --eager --platform ios --dev false`: bundled successfully (~8.6s in latest run).
- Runtime screen timings:
  - Pending on-device/app execution with instrumentation enabled.

## How to collect runtime metrics quickly
- Mobile:
  - Run app and open:
    - receipt screen
    - transaction details
    - transaction record details
  - Capture logs containing:
    - `receipt:api:*`, `receipt:ui_after_data:*`, `receipt:transform`
    - `tx_details:api:*`, `tx_details:ui_after_data:*`
    - `tx_record:api:*`, `tx_record:ui_after_data:*`
- Backend:
  - Enable `DEBUG_PERF=true` (non-prod) and hit:
    - `GET /api/v1/receipts/:id`
    - `GET /api/v1/payment_processors/:id`
    - `GET /api/v1/transaction_records/:id`
  - Review `[PERF][...]` logs for total and SQL timings.
