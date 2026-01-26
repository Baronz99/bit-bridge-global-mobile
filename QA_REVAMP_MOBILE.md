# QA REVAMP MOBILE

## Auth
- Login succeeds with valid credentials.
- Token refresh works (401 triggers refresh and retry).

## Wallet
- GET `/wallets/user` loads balances (bridge + tunnel).
- GET `/transactions/user` loads a list of transactions.

## Timeline
- GET `/timeline` loads items.
- Each item renders label/title/text and amount + date when present.

## Tunnel FX
- POST `/wallets/tunnel/activate` succeeds.
- POST `/wallets/tunnel/quote` returns preview (amount_ngn).
- POST `/wallets/tunnel/convert` converts with `transaction_pin`.
- POST `/wallets/tunnel/quote-back` returns preview (amount_usd).
- POST `/wallets/tunnel/convert-back` converts with `transaction_pin`.

## Bank Transfer
- POST `/accounts/initiate_fund_transfer` succeeds.
- GET `/accounts/verify_transfer?transfer_id=...` returns status.
