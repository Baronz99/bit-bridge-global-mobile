# KYC API Contract (Phase 1: OTP + BVN)

Sources:
- `C:\dev\Bit-Bridge-Global-Revamp\backend\bit-bridge-backend\config\routes.rb`
- `C:\dev\Bit-Bridge-Global-Revamp\backend\bit-bridge-backend\app\controllers\api\v1\phone_verifications_controller.rb`
- `C:\dev\Bit-Bridge-Global-Revamp\backend\bit-bridge-backend\app\controllers\api\v1\kyc\bvn_controller.rb`
- `C:\dev\Bit-Bridge-Global-Revamp\backend\bit-bridge-backend\app\serializers\user_serializer.rb`
- `C:\dev\Bit-Bridge-Global-Revamp\backend\bit-bridge-backend\app\serializers\user_kyc_serializer.rb`
- `C:\dev\Bit-Bridge-Global-Revamp\backend\bit-bridge-backend\app\models\phone_verification_code.rb`
- `C:\dev\Bit-Bridge-Global-Revamp\backend\bit-bridge-backend\app\services\phone_normalizer.rb`
- `C:\dev\Bit-Bridge-Global-Revamp\backend\bit-bridge-backend\spec\services\termii_client_spec.rb`
- `C:\dev\Bit-Bridge-Global-Revamp\backend\bit-bridge-backend\spec\services\kyc\prembly_bvn_verification_spec.rb`

Base URL: `/api/v1`

## POST /phone_verification/request
Request JSON:
```json
{
  "phone_number": "08012345678"
}
```

Response fields (success):
- `status`: `"sent" | "already_verified" | "cooldown" | "rate_limited" | "failed" | "phone_in_use" | "forbidden"`
- `phone_e164`: digits-only E164, e.g. `"2348012345678"`
- `expires_at`: ISO8601 timestamp
- `expires_in_seconds`: `300` (from `PhoneVerificationCode::TTL = 5.minutes`)
- `resend_available_in_seconds`: `45` (from `PhoneVerificationCode::RESEND_COOLDOWN`)
- `provider_message_id`: Termii message id
- `message`, `reason`, `errors`: strings/array for error variants

Response example (rate limit):
```json
{
  "status": "rate_limited",
  "message": "Too many verification requests. Please try again later."
}
```

## POST /phone_verification/verify
Request JSON:
```json
{
  "phone_number": "08012345678",
  "code": "123456"
}
```

Response fields (success):
- `status`: `"verified"`
- `phone_e164`: digits-only E164
- `phone_number`: original phone number
- `phone_verified_at`: ISO8601 timestamp

Response example (invalid):
```json
{
  "status": "invalid",
  "errors": ["Invalid code. Please try again."]
}
```

## POST /kyc/bvn/verify
Request JSON:
```json
{
  "bvn": "12345678901"
}
```

Response fields (success):
- `status`: `"verified" | "pending_review" | "mismatch" | "locked"`
- `tier`: current `kyc_level`
- `bvn_last4`
- `matches`: `{ "dob": boolean, "first_name": boolean, "last_name": boolean }`
- `match_score`: float (rounded to 3)
- `prembly_reference`
- `verified_at`
- `reason`
- `locked_until` (when `status = "locked"`)

Response example (validation error):
```json
{
  "status": "error",
  "message": "BVN must be 11 digits."
}
```

## GET /users/user_profile (KYC status source)
Response payload includes:
- `kyc_level`
- `phone_verified`, `phone_verified_at`, `phone_e164`
- `user_kyc` (from `UserKycSerializer`)
