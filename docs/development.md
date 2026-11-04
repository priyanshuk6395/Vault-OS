# Development and Operations

## Requirements

- Node.js 20.9 or newer (Next.js 16 requirement)
- npm
- PostgreSQL reachable from the application
- AWS S3 and Rekognition configuration for end-to-end media workflows
- A Cognito Identity Pool with guest access for the browser liveness flow

Unit and API route tests run with mocked services and do not require AWS credentials. Basic pages can be explored locally with a database and admin credentials; full upload, face search, and liveness need the corresponding services configured.

## Local setup

```powershell
npm install
Copy-Item .env.template .env
```

`.env.template` contains blank placeholders. Fill in the required values in `.env`, then initialize the Prisma client and schema:

```powershell
npx prisma generate
npx prisma db push
npm run dev
```

Open `http://localhost:3000/login` for the admin login. Guest URLs use `/guest/event/{eventId}`. Use a disposable local event and non-personal media for development. The admin browser test reads `ADMIN_USERNAME` and `ADMIN_PASSWORD` from the loaded environment; configure them before running E2E tests.

Generate a `NEXTAUTH_SECRET` with:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

Do not commit `.env`. `.gitignore` ignores `.env*` files.

## Environment variables

| Variable | Required | Used for |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection for Prisma |
| `NEXTAUTH_SECRET` | Yes | NextAuth JWTs, signed guest cookies, and passcode encryption key derivation |
| `NEXTAUTH_URL` | Yes outside local defaults | Canonical app origin and auth callback URL |
| `ADMIN_USERNAME` | Yes for admin sign-in | Credentials provider username |
| `ADMIN_PASSWORD` | Yes for admin sign-in | Credentials provider password |
| `AWS_REGION` | Yes for server-side AWS | S3 and Rekognition client region |
| `AWS_ACCESS_KEY_ID` | Yes in current client setup | Server-side AWS credentials |
| `AWS_SECRET_ACCESS_KEY` | Yes in current client setup | Server-side AWS credentials |
| `AWS_S3_BUCKET` | Yes for media operations | Private event media bucket |
| `NEXT_PUBLIC_AWS_IDENTITY_POOL_ID` | Required for liveness | Cognito Identity Pool used by Amplify in the browser |
| `NEXT_PUBLIC_AWS_REGION` | Optional | Liveness region; code defaults to `ap-south-1` |
| `NEXT_PUBLIC_CREATOR_NAME` | Optional | Display name in the landing page and admin session |
| `NEXT_DIST_DIR` | Optional | Next.js build output directory; defaults to `.next` |
| `E2E_BASE_URL` | Optional | Explicit Playwright base URL |
| `E2E_PORT` | Optional | Playwright localhost port; also selects an isolated `.next-e2e-{port}` output directory |
| `E2E_GUEST_EVENT_ID` | Optional | Seeded event used by the guest passcode browser test |

Playwright reuses an installed Chromium browser. On a new workstation without a compatible browser, run `npx playwright install chromium` before the E2E suite. The guest page test skips unless `E2E_GUEST_EVENT_ID` points to a seeded event in the configured database.

Keep actual values local. The liveness UI accepts `NEXT_PUBLIC_AWS_IDENTITY_POOL_ID`; public variables are bundled into the browser and must never contain AWS secret keys.

## AWS prerequisites

The server uses S3 for object reads, writes, copies, and deletes, and Rekognition for collections, face indexing/search/deletion, and liveness session operations. Derive a least-privilege IAM policy for these operations and scope resources to the intended bucket and event collections. The client’s Cognito unauthenticated role is separate from the server role and must not grant bucket access.

Browser-to-S3 presigned uploads require bucket CORS that permits the exact app origin to issue `PUT` requests with the headers present in the signed request. For local testing, allow `http://localhost:3000`; in deployment, list only the required production origins, not `*`. Configure response headers such as `ETag` only when the upload client needs them. Confirm the rule against an actual signed request in a staging bucket rather than copying a broad policy. Use HTTPS in deployed environments. Verify IAM, CORS, bucket policy, region, and Cognito permissions in a dedicated staging account before enabling real event uploads.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start Next.js development server |
| `npm run build` | Generate Prisma client and build production app |
| `npm run start` | Serve the production build |
| `npm run lint` | Run ESLint across the repository |
| `npm test` | Run Vitest unit and API handler tests |
| `npm run test:watch` | Run Vitest in watch mode |
| `npm run test:e2e` | Run Playwright browser tests; starts a dev server when needed |
| `npx prisma generate` | Regenerate the Prisma client |
| `npx prisma db push` | Apply the current Prisma schema to a development database |
| `npx prisma studio` | Inspect a configured development database |

`npm run build` runs `prisma generate` first. On Windows, an already-running Node process can hold Prisma's query-engine DLL; if generation fails with a DLL rename/lock error, stop the process using it and retry rather than deleting `node_modules`.

## Operational notes

- Next.js output goes to `.next` unless `NEXT_DIST_DIR` is set. Playwright uses a port-specific output directory to avoid colliding with the local dev server.
- Admin event pages issue a one-time `ADMIN_ACCESS` telemetry request per browser session and event.
- Event creation attempts Rekognition collection initialization but does not roll back the database event if AWS setup fails; monitor logs and initialize/reconcile the collection before relying on face processing.
- Face matching uses bounded in-process concurrency and retries throttling responses. If events still show `ProvisionedThroughputExceededException`, inspect the asset's stored error detail and server logs, then check Rekognition quotas; do not immediately increase concurrency.
- Database schema changes currently use `prisma db push` in the documented local flow. Establish and use a migration workflow before production schema changes.
- For production deployment, set `NODE_ENV=production`, HTTPS `NEXTAUTH_URL`, durable secrets, DB backups, private S3, explicit lifecycle/retention, and monitoring for AWS/processing failures.
