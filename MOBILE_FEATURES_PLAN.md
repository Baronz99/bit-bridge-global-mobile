# Mobile Features Plan (Expo Router)

## Auth

### Password reset
- Expo Router paths: `/forgot-password`, `/reset-password`
- Screens:
  - Forgot password (request reset link/code)
  - Reset password (confirm new password)
- Required API functions (suggested file): `api/auth.ts`
  - `requestPasswordReset`
  - `confirmPasswordReset`
- Dependencies: `auth_optional`, `email_required`

## Onboarding

### Profile + use case onboarding
- Expo Router paths: `/onboarding`, `/onboarding/basic-profile`, `/onboarding/use-case`
- Screens:
  - Onboarding entry
  - Basic profile (name, phone, DOB)
  - Use case selection
  - KYC profile (address + uploads)
- Required API functions (suggested file): `api/onboarding.ts`
  - `saveOnboardingStage`
  - `updateBasicProfile`
  - `updateKycProfile`
  - `saveOnboardingUseCase`
- Dependencies: `auth_required`

## Wallet

### Send money to BitBridge user
- Expo Router paths: `/wallet/send`
- Screens:
  - Send money form
  - Send confirmation
- Required API functions (suggested file): `api/wallet.ts`
  - `sendMoneyToUser`
- Dependencies: `auth_required`, `pin_required`

### User deposit transaction (create_user)
- Expo Router paths: `/wallet/deposit`
- Screens:
  - Deposit form
  - Deposit confirmation
- Required API functions (suggested file): `api/transactions.ts`
  - `createUserTransaction`
- Dependencies: `auth_required`

### Statistics (dashboard)
- Expo Router paths: `/wallet/stats`
- Screens:
  - Stats overview
- Required API functions (suggested file): `api/statistics.ts`
  - `getStatistics`
- Dependencies: `auth_required`

### Circles (shared wallet actions)
- Expo Router paths: `/circles/[id]/fund`, `/circles/[id]/withdraw`, `/circles/[id]/activities`, `/circles/[id]/audit`
- Screens:
  - Fund circle
  - Withdraw from circle
  - Circle activities list + create
  - Audit summary
  - Export CSV action
  - React/unreact on circle transactions
  - Invite members
- Required API functions (suggested file): `api/circles.ts`
  - `fundCircle`
  - `withdrawCircle`
  - `listCircleActivities`
  - `createCircleActivity`
  - `getCircleAuditSummary`
  - `exportCircleCsv`
  - `reactToCircleTx`
  - `unreactToCircleTx`
  - `inviteCircleMember` (use `/circles/:id/memberships`)
- Dependencies: `auth_required`, `member_of_circle`, `circle_owner` (for audit/export if enforced)

## Cards

### Virtual cards
- Expo Router paths: `/cards`, `/cards/[id]`, `/cards/[id]/fund`, `/cards/[id]/unload`, `/cards/[id]/reveal`
- Screens:
  - Card list
  - Card details
  - Fund card
  - Unload card
  - Freeze/unfreeze
  - Reveal card
  - Card history/insights
- Required API functions (suggested file): `api/cards.ts`
  - `registerCardholder`
  - `createCard`
  - `getUserCard`
  - `getCardStates`
  - `getCardDetails`
  - `getCardBalance`
  - `getCardReveal`
  - `getCardHistory`
  - `getCardInsights`
  - `freezeCard`
  - `unfreezeCard`
  - `fundCard`
  - `unloadCard`
- Dependencies: `auth_required`, `pin_required` (fund/unload if enforced), `kyc_required` (if enforced)

### Card tokens
- Expo Router paths: `/cards/tokens`
- Screens:
  - Saved payment methods
- Required API functions (suggested file): `api/cardTokens.ts`
  - `createCardToken`
  - `getCardTokens`
  - `getUserCardTokens`
  - `updateCardToken`
- Dependencies: `auth_required`

## Accounts

### Virtual accounts list
- Expo Router paths: `/accounts`
- Screens:
  - Virtual accounts list
- Required API functions (suggested file): `api/accounts.ts`
  - `getAccounts`
- Dependencies: `auth_required`

### Create deposit account number
- Expo Router paths: `/accounts/create`
- Screens:
  - Create deposit account
- Required API functions (suggested file): `api/accounts.ts`
  - `createDepositAccount`
- Dependencies: `auth_required`

### Verify KYC (accounts)
- Expo Router paths: `/accounts/verify-kyc`
- Screens:
  - KYC verification form
- Required API functions (suggested file): `api/accounts.ts`
  - `verifyKyc`
- Dependencies: `auth_required`, `bvn_required`

## Orders

### Orders (order_details)
- Expo Router paths: `/orders`, `/orders/[id]`, `/orders/confirm`
- Screens:
  - Orders list
  - Order details
  - Order confirmation
- Required API functions (suggested file): `api/orders.ts`
  - `createOrder`
  - `getOrders`
  - `getOrder`
  - `getUserOrders`
  - `updateOrder`
- Dependencies: `auth_required`

### Disputes
- Expo Router paths: `/orders/[id]/dispute`
- Screens:
  - Dispute form
- Required API functions (suggested file): `api/disputes.ts`
  - `raiseDispute`
- Dependencies: `auth_required`, `order_required`

### Payment processor status helpers
- Expo Router paths: `/orders/[id]/status`, `/orders/[id]/ref`
- Screens:
  - Transaction status check
  - Reference order lookup
- Required API functions (suggested file): `api/billOrder.ts`
  - `queryTransaction`
  - `getRefOrder`
- Dependencies: `auth_required`

### Currency conversion (checkout helper)
- Expo Router paths: `/orders/convert`
- Screens:
  - Conversion helper (if needed in flow)
- Required API functions (suggested file): `api/currency.ts`
  - `getConversion`
- Dependencies: `auth_required`

## Rewards

### Rewards dashboard
- Expo Router paths: `/rewards`
- Screens:
  - Rewards overview
- Required API functions (suggested file): `api/rewards.ts`
  - `getRewards`
- Dependencies: `auth_required`

## Settings

### Transaction PIN management
- Expo Router paths: `/settings/pin`, `/settings/pin/set`, `/settings/pin/change`, `/settings/pin/reset`
- Screens:
  - PIN status
  - Set PIN
  - Change PIN
  - Reset PIN (OTP flow)
- Required API functions (suggested file): `api/transactionPin.ts`
  - `getTransactionPinStatus`
  - `setTransactionPin`
  - `verifyTransactionPin`
  - `changeTransactionPin`
  - `requestTransactionPinReset`
  - `confirmTransactionPinReset`
- Dependencies: `auth_required`, `phone_verified` (reset flow)

## Admin (optional)

### Admin KYC reviews
- Expo Router paths: `/admin/kyc-reviews`
- Screens:
  - KYC reviews list
  - KYC review detail
- Required API functions (suggested file): `api/adminKycReviews.ts`
  - `getKycReviews`
  - `updateKycReview`
- Dependencies: `auth_required`, `admin_role`

### Admin bill orders
- Expo Router paths: `/admin/bill-orders`, `/admin/bill-orders/[id]`
- Screens:
  - Bill orders list
  - Bill order detail
- Required API functions (suggested file): `api/adminBillOrders.ts`
  - `getBillOrders`
  - `getBillOrder`
- Dependencies: `auth_required`, `admin_role`

### Admin transactions
- Expo Router paths: `/admin/transactions`, `/admin/transactions/[id]`
- Screens:
  - Transactions list
  - Transaction detail
- Required API functions (suggested file): `api/adminTransactions.ts`
  - `getTransactions`
  - `getTransaction`
  - `updateTransaction`
- Dependencies: `auth_required`, `admin_role`

### Admin users
- Expo Router paths: `/admin/users`, `/admin/users/[id]`
- Screens:
  - Users list
  - User detail
- Required API functions (suggested file): `api/adminUsers.ts`
  - `getUsers`
  - `getUser`
  - `userUpdate`
  - `clearUserPinLockout`
- Dependencies: `auth_required`, `admin_role`
