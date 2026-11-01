# Testing

## Test layers

### Unit and API route tests

```powershell
npm test
```

Vitest runs in jsdom. The current suite has unit tests for auth helpers, passcodes, guest sessions, themes, upload state, the admin dashboard, and route handlers. `tests/api-routes.test.ts` contains 45 API cases covering request validation, passcode throttling outcomes, ownership/guest authorization, upload lifecycle, moderation, biometric flow outcomes, private media access, URL signing, image transforms, and archive streaming.

Route tests invoke the exported handler directly. Prisma, NextAuth/session helpers, the AWS clients, presigner, and Rekognition helper are mocked; image fixtures and archive streams are generated locally. This gives deterministic contract coverage without AWS charges, cloud writes, or database mutations. It does **not** validate deployed IAM, S3 CORS, Cognito permissions, network behavior, database migrations, or actual Rekognition model results.

Run only the route suite with:

```powershell
npm test -- --reporter=dot tests/api-routes.test.ts
```

### Browser tests

```powershell
npm run test:e2e -- --workers=1
```

Playwright covers theme switching/layout stability, login form accessibility, configured admin sign-in, and an optional seeded guest passcode page. The guest test skips unless `E2E_GUEST_EVENT_ID` is set. `E2E_BASE_URL` or `E2E_PORT` can select an isolated local server; Playwright sets `NEXTAUTH_URL` to that base URL so auth cookies use the correct origin.

### Type, lint, and production build

```powershell
npx tsc --noEmit --pretty false
npm run lint
npm run build
```

A successful production build compiles, type-checks, collects route data, and prerenders static pages. `npm run lint` checks the whole repository; use the focused ESLint command for a narrow change, for example `npm exec eslint -- tests/api-routes.test.ts`.

## Safe real-service staging checks

Use a dedicated staging database, bucket, and Rekognition account/collection. Use synthetic media with no real faces. Before running a service check, verify the target AWS account and region, bucket, IAM role, and cleanup policy. Do not run these checks against production data as part of ordinary CI.

Suggested staging sequence:

1. Create a disposable event and verify an event-scoped Rekognition collection exists.
2. Verify an owner upload can initialize, PUT to S3, complete, and become visible only after processing.
3. Verify a guest upload is denied when guest uploads are disabled and held pending when enabled.
4. Verify a guest cannot read another guest's private image or download URL; verify approved public-gallery access behaves as configured.
5. Verify face liveness and face search only with a synthetic test identity, then remove the event's S3 objects and Rekognition collection using the approved cleanup procedure.
6. Inspect logs for unexpected personal data and confirm resource cleanup.

## Current limitations

- E2E tests use the configured local database and credentials; only the guest page test is conditional on a seeded event.
- API handler tests mock services, so they cannot prove cloud resource permissions or data-retention behavior.
- The suite does not currently have a NextAuth protocol-level contract test; the route is NextAuth's framework wrapper around `authOptions`.
- Event creation deliberately reports success if Rekognition collection initialization fails; staging/production monitoring must detect that partial setup.
- Browser review has surfaced React hydration mismatch warnings on the admin theme toggle and the guest passcode input's caret-color style. Current E2E tests assert rendered controls and theme tokens but do not fail on console hydration warnings; treat this as an open UI issue, not an API test failure.
