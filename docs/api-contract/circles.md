# Circles + Timeline API Contract (Phase 2 foundation)

Sources:
- `api/circles.ts`
- `api/timeline.ts`

Base URL: `/api/v1`

## GET /circles
Notes:
- Response shape not yet confirmed.
- Mobile UI extracts arrays from `data`, `circles`, `items`, or `results`.

## GET /circles/:id
Notes:
- Expected to return circle details.
- Timeline may be nested on `timeline` or `data.timeline` if available.
- Members may be nested on `members` or have `members_count`.

## POST /circles
Notes:
- Payload is currently `Record<string, unknown>`.
- Response shape not yet confirmed.

## POST /circles/:id/invite
Notes:
- Endpoint name is assumed; may be `/circles/:id/invitations`.
- Payload is currently `Record<string, unknown>`.

## GET /timeline
Notes:
- Global social feed endpoint name not yet confirmed.
- Response shape not yet confirmed.

## GET /circles/:id/timeline
Notes:
- Circle timeline endpoint name not yet confirmed.
- Response shape not yet confirmed.

Open questions:
- Exact response shape for circles list/detail and timeline items.
- Whether the timeline feed is `/timeline`, `/feed`, or nested under `/circles/:id`.
- Final invite endpoint and request payload fields (email/phone/user_id?).
