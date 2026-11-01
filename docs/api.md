# API Reference

This reference covers the Next.js App Router handlers under `app/api`. Dynamic values in braces are path parameters. Route handlers use the application session or guest cookies; a client-side route being hidden does not grant API authorization.

## Authentication and conventions

- Admin routes require a NextAuth session and, for event data, event ownership.
- Guest routes require a valid event session cookie. Some media operations also require a verified person cookie.
- Passcode endpoints are public entry points protected by an event/IP attempt limiter.
- S3 and Rekognition operations are initiated server-side, except the browser liveness capture performed through Amplify/Cognito.
- Most responses are JSON. Archive endpoints stream `application/zip`; `/api/upload/view` returns image bytes.
- Private media/list responses set `Cache-Control` to `private, no-store` (or equivalent). Do not put these responses behind a shared public cache.

## Authentication and event routes

| Method and path | Access | Behavior |
| --- | --- | --- |
| `GET`, `POST /api/auth/[...nextauth]` | NextAuth | Credentials sign-in, callback, session, and sign-out handlers. |
| `POST /api/events` | Admin session | Additional event-create endpoint accepting `{ title, passcode, guestUploadPolicy? }`; encrypts the passcode and attempts Rekognition collection setup. Returns `201` with event fields. |
| `POST /api/admin/events/create` | Admin session | Event-create endpoint used by the current admin create page and modal. Accepts `{ name, passcode }`, initializes the event collection, and returns event fields. |
| `GET /api/admin/events` | Admin session | Lists events owned by the session user (including the legacy owner mapping); `Cache-Control: no-store`. |
| `POST /api/admin/log-telemetry` | Admin session + event owner | Writes an `ADMIN_ACCESS` audit entry for the event. Uses the first forwarded IP value when present. |
| `POST /api/admin/moderate-upload` | Event owner | Body `{ assetId, action }` where action is `approve` or `reject`; approval migrates the object from pending to approved storage, while rejection removes the object and face vectors. |
| `GET /api/admin/sidebar-stats?eventId={id}` | Event owner | Returns asset, person, and face-review counts. Missing `eventId` is `400`. |
| `POST /api/events/verify-passcode` | Public, rate-limited | Body `{ eventId, passcode }`; verifies the event passcode, records audit data, and issues a guest cookie. Success returns `{ success: true, eventId }`. |
| `POST /api/events/{eventId}/verify` | Public, rate-limited | Body `{ passcode }`; verifies a passcode for the path event and issues a guest cookie. |
| `PATCH /api/events/{eventId}/settings` | Event owner | Updates `title` and/or `themeImageUrl`. A selected theme asset must be approved and belong to that event. |
| `GET /api/events/{eventId}/stats` | Event owner | Returns event title, total/image/video asset counts, and unnamed-person count. |
| `GET /api/events/{eventId}/assets` | Event owner or eligible guest | Lists event assets. Guest access requires `publicGallery`; guest results are restricted to approved, processed assets. Adds authorized signed URLs and uploader labels. |
| `GET /api/events/{eventId}/assets/approved` | Event owner or eligible guest | Returns approved, processed asset IDs and storage keys for the event. Guest access requires a public gallery. |
| `DELETE /api/events/{eventId}/assets/{assetId}` | Event owner | Claims the asset for deletion, removes Rekognition faces and S3 object, then deletes database detections, samples, asset, and orphaned people. Active processing states return `409`. |
| `GET /api/events/{eventId}/people` | Event owner | Lists people and face-detection counts for the event. |
| `POST /api/events/{eventId}/people/purge` | Event owner | Deletes people in the event with no face detections; returns the deleted count. |
| `POST /api/events/{eventId}/review/{detectionId}` | Event owner | Body `{ action }`, where action is `confirm`, `reject`, or `skip`. Reject removes the Rekognition face and detection; confirm marks its person named. |

## Liveness, face search, and downloads

| Method and path | Access | Behavior |
| --- | --- | --- |
| `POST /api/events/{eventId}/liveness/create` | Event owner or guest; guest requires biometric search enabled | Creates a Rekognition Face Liveness session and returns `{ sessionId }`. |
| `POST /api/events/{eventId}/find-me` | Event owner or guest; guest requires biometric search enabled | Body `{ sessionId }`; checks liveness, searches the event collection, resolves the person, and returns `{ personName, personId, photos }`. Failed liveness is audited and returns `403`; unmatched faces return `404`. |
| `GET /api/events/{eventId}/download-all` | Verified guest-person session | Requires `personId` query parameter matching the person cookie and event. Streams that person's approved, processed assets as a ZIP. |
| `GET /api/events/{eventId}/download-all-admin` | Event owner | Streams all event assets as a ZIP; empty vault returns `404`. |

## People and upload routes

| Method and path | Access | Behavior |
| --- | --- | --- |
| `PATCH /api/people/{personId}` | Event owner for the person's event | Body `{ name, status? }`; trims the name and merges into an existing same-event name match when found. |
| `POST /api/upload/init` | Event owner or eligible guest | Creates upload records and returns signed S3 PUT URLs. Accepts one file or `{ eventId, uploaderId?, files: [...] }`; batch limit 1–100, 50 MiB per file, matching image/video MIME prefixes. Signed URLs expire after 300 seconds. |
| `POST /api/upload/complete` | Event owner or verified uploader guest | Body `{ assetId, uploaderId? }`; claims and processes an upload, indexes faces for images, and persists matches. Existing processing returns `202`; completed work is idempotent. |
| `POST /api/upload/fail` | Event owner or verified uploader guest | Body `{ assetId, uploaderId? }`; marks eligible uploading, uploaded, or stale-processing assets failed. |
| `GET /api/upload/download-url?key={key}&filename={name?}` | Event owner or eligible guest | Signs a short-lived download URL after checking asset visibility. The optional filename has quotes and newlines replaced. URL expires after 60 seconds. |
| `GET /api/upload/view?key={key}&w={width?}&q={quality?}&format={format?}` | Event owner or eligible guest | Returns image bytes from private S3 after access checks. Width is 1–4096; quality is 1–100; formats are WebP, JPEG, PNG, and AVIF. Videos return `415`. |

## Common errors

Handlers use endpoint-specific messages. Common status meanings are:

| Status | Meaning |
| --- | --- |
| `400` | Missing or invalid input |
| `401` | Missing/invalid session or credentials |
| `403` | Authenticated guest is not allowed for this event/action |
| `404` | Event, asset, identity, or result does not exist or is intentionally concealed |
| `409` | State claim lost, asset is in an active transition, or idempotency key conflicts |
| `413` | Upload exceeds the 50 MiB per-file limit |
| `429` | Passcode attempt limit reached |
| `500` | Database, storage, signing, or processing failure |

For exact request validation and side-effect assertions, see [`tests/api-routes.test.ts`](../tests/api-routes.test.ts). It invokes route handlers directly with mocked Prisma, auth, S3, presigner, and Rekognition dependencies; it is not a live-service integration test.
