# Security and Privacy

Vault OS processes private event media and biometric information. This guide describes controls present in code and operational requirements that remain the deployer's responsibility.

## Identity and authorization

- Admin sign-in uses NextAuth's credentials provider. `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and `NEXTAUTH_SECRET` are required for an admin session.
- Middleware protects `/admin/*`; API handlers independently authorize access to sensitive operations.
- Event ownership is checked against the signed-in user ID. `lib/auth.ts` maps `admin-001` to a legacy owner ID for existing events.
- Guest access is event-scoped. The app signs `event_auth_{eventId}` cookies and, for face search, `event_person_{eventId}` cookies. Cookies are HTTP-only, `SameSite=Strict`, path `/`, and `Secure` in production.
- Cookie lifetimes vary by entry path: the passcode API issues a 7-day event cookie, the event verification API uses 4 hours, and the server action defaults to 24 hours. Person cookies default to 1 hour.

## Passcodes and throttling

New event passcodes are normalized (trimmed and uppercased) and encrypted with AES-256-GCM using a key derived from `NEXTAUTH_SECRET`. The verifier also accepts legacy plaintext values and scrypt hashes. A successful plaintext legacy check can migrate that value to AES-GCM; an scrypt hash is one-way and cannot be displayed, so the admin passcode-display flow rotates it to a newly generated code stored in encrypted form. The owner must share any rotated code with guests.

Passcode attempts are tracked in PostgreSQL under transaction-scoped advisory locks. Current limits are 10 attempts per event/client IP and 1,000 attempts per event in a 15-minute window. `getClientIp` trusts a valid `X-Real-IP`; it does not parse `X-Forwarded-For`. In production, place the app behind a trusted proxy that overwrites `X-Real-IP`; direct internet exposure can let clients choose that header.

## Media storage

- Keep the S3 bucket private and block public access. Browser uploads use short-lived presigned PUT URLs; server routes authorize before signing reads or proxying bytes.
- `/api/upload/view` returns `private, no-store` responses and varies on `Cookie`. Do not replace these headers with shared public caching.
- The upload size limit is 50 MiB per file; supported logical types are image and video. Guest uploads are held for moderation. Videos are not face-indexed.
- Uploads and downloads still depend on S3 bucket policy, IAM, CORS, TLS, backups, lifecycle, and incident-response configuration. Review these in the target AWS account; tests with mocks do not validate them.

## Biometric data

Rekognition stores face vectors in event-named collections (`event-{eventId}`). PostgreSQL stores face IDs, confidence, bounding boxes, face-to-person associations, and audit records. Liveness capture is required before guest face search. Guest results are restricted to the verified person's eligible photos unless the event exposes its approved public gallery.

Deleting an asset removes its Rekognition face entries, S3 object, database detections/samples, and people that become orphaned. The people purge endpoint removes only people with no detections. Review event deletion, Rekognition collection deletion, S3 object cleanup, backups, and retention together before using real biometric data; do not assume database cascade deletion also removes cloud objects.

Before production use, establish a lawful basis, notice/consent, retention/deletion policy, access process, and incident response appropriate to the jurisdiction (including applicable biometric privacy laws). Do not use real faces in development screenshots, test fixtures, or logs.

## Secrets and logging

- Keep server-side AWS credentials, database URLs, admin credentials, and `NEXTAUTH_SECRET` in a secret manager or protected deployment environment. Never prefix these with `NEXT_PUBLIC_`.
- The server currently constructs AWS clients with explicit `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`. Prefer short-lived, least-privilege workload credentials in production if the deployment supports them.
- The browser uses a Cognito Identity Pool for Amplify liveness. Configure its unauthenticated role for only required liveness actions; it must not receive general S3 access or server credentials.
- Access logs can contain IP addresses, user agents, passcode attempt outcomes, admin actions, and biometric events. Restrict database/log access and define retention.
- The API tests use fake URLs and mocked AWS/database modules. Never interpret them as evidence that production IAM or data isolation is configured correctly.

## Deployment review checklist

- [ ] HTTPS enforced at the edge; `NEXTAUTH_URL` matches the canonical HTTPS origin.
- [ ] S3 public access blocked; server and Cognito IAM roles reviewed separately and scoped to required resources.
- [ ] Trusted proxy overwrites `X-Real-IP` and forwards traffic only to the app.
- [ ] `NEXTAUTH_SECRET`, admin credentials, and database credentials are unique, protected, and rotatable.
- [ ] Guest upload policy, `publicGallery`, and `biometricSearch` defaults are reviewed per event.
- [ ] Data retention and deletion are tested across PostgreSQL, S3, Rekognition collections, and backups.
- [ ] Logs and screenshots contain no passcodes, credentials, or real personal/biometric data.
