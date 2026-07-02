<div align="center">

# 🛡️ Vault OS
### Biometric Event Media Platform

[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![AWS Rekognition](https://img.shields.io/badge/AWS-Rekognition-FF9900?style=flat-square&logo=amazonaws)](https://aws.amazon.com/rekognition/)
[![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?style=flat-square&logo=prisma)](https://www.prisma.io/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS_v4-38B2AC?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)

</div>

## What this is

Vault OS is an event photo platform where guests find **their own** photos without scrolling through everyone else's. An admin creates an "event vault," photos get uploaded (by the admin or by guests), and AWS Rekognition indexes every face it detects. Guests can then either browse a passcode-gated gallery or do a live face capture to pull up only the photos they appear in.

Every photo goes through the same pipeline: **upload → S3 storage → Rekognition face indexing → person clustering → guest retrieval.**

---

## Tech stack

| Layer | Technology | Notes |
| :--- | :--- | :--- |
| Framework | Next.js 16 (App Router, Turbopack) | Server Components + Server Actions |
| Auth (admin) | NextAuth (Credentials provider) | `ADMIN_USERNAME` / `ADMIN_PASSWORD` env-based login |
| Auth (guest) | Passcode + signed cookie | Per-event, set in `lib/actions/guest-actions.ts` |
| Database | PostgreSQL + Prisma ORM | See [Data model](#data-model) |
| Object storage | Amazon S3 | Raw assets; proxied through `/api/upload/view`, never exposed directly |
| Face intelligence | AWS Rekognition (Collections API) | One collection per event: `event-{eventId}` |
| Liveness capture | AWS Amplify UI (`FaceLivenessDetector`) | Guest-facing "Find Me" flow, needs a Cognito Identity Pool |
| Styling | Tailwind CSS v4 + Radix UI + Framer Motion | |
| Bulk export | `archiver` | Streams zipped downloads without buffering to disk |

---

## Data model

```
Event ──< Asset ──< FaceDetection ──> Person ──< FaceSample
  │                                      
  └──< AccessLog   (audit trail: who unlocked the vault, when, from where)
```

- **Event** — one per gig/wedding/party. Holds the passcode, upload policy, theme image, and privacy toggles (`biometricSearch`, `publicGallery`).
- **Asset** — one row per uploaded photo/video. Tracks the AI pipeline via `status` (`pending → processing → processed | failed`) and guest-upload visibility via `moderationState` (`pending → approved`).
- **Person** — a *cluster* of faces Rekognition believes are the same individual, scoped to one event. Created the first time a face doesn't match anyone existing (`FaceMatchThreshold: 90`).
- **FaceDetection** — one row per face Rekognition finds in an Asset. Stores the raw `faceId`, `confidence`, and `boundingBox`, and links to whichever `Person` it was clustered into.
- **FaceSample** — reference face(s) used for a guest's live "Find Me" match.
- **AccessLog** — audit trail for vault access (used by `app/(admin)/admin/[eventId]/audit`).

---

## Project structure

```
app/
├─ (admin)/admin/              # Auth-gated admin console (see middleware.ts)
│  ├─ page.tsx                 # Vault list / Command Center
│  ├─ new-event/                
│  └─ [eventId]/
│     ├─ overview/  media/  people/  face-review/
│     ├─ guest-uploads/        # Moderation queue for guest submissions
│     ├─ access/  audit/  settings/
├─ (guest)/guest/event/[eventId]/   # Passcode-gated guest gallery + "my-photos"
├─ api/
│  ├─ admin/                   # events CRUD, moderation, sidebar stats, telemetry
│  ├─ auth/[...nextauth]/      # NextAuth handler
│  ├─ events/[eventId]/        # assets, review, stats, liveness, find-me, verify, downloads
│  └─ upload/                  # init / complete / view (S3 proxy) / download-url
components/
├─ admin/                      # Dashboard, SideBar, MediaGrid, FaceReviewClient, etc.
├─ guest/                      # Gallery, upload dialog, liveness camera
└─ ui/                         # Shared primitives (dialog, button, portal)
lib/
├─ actions/                    # Server Actions (auth, events, guest, privacy)
├─ aws.ts                      # S3 + Rekognition client setup
├─ rekognition.ts               
├─ prisma.ts
└─ auth.ts                     # NextAuth config
prisma/schema.prisma
```

---

## Getting started

### Prerequisites
- Node.js 20+
- A PostgreSQL database (local or hosted)
- An AWS account with **S3** and **Rekognition** access, plus a **Cognito Identity Pool** if you want the guest liveness capture to work

### 1. Install

```bash
git clone <repo-url>
cd face-media-vault
npm install
```

### 2. Configure environment

Copy the block below into `.env`:

```bash
# --- Database ---
DATABASE_URL="postgresql://user:password@localhost:5432/vault"

# --- Admin auth (NextAuth) ---
NEXTAUTH_SECRET="generate-with: openssl rand -base64 32"
NEXTAUTH_URL="http://localhost:3000"
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="change-me"

# --- AWS (server-side: S3 + Rekognition) ---
AWS_REGION="us-east-1"
AWS_ACCESS_KEY_ID="AKIA..."
AWS_SECRET_ACCESS_KEY="..."
AWS_S3_BUCKET="your-bucket-name"

# --- AWS (client-side: guest liveness capture via Amplify) ---
NEXT_PUBLIC_AWS_REGION="us-east-1"
NEXT_PUBLIC_AWS_IDENTITY_POOL_ID="us-east-1:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

> The `NEXT_PUBLIC_*` vars are separate from the server-side AWS credentials on purpose — they're exposed to the browser and only grant the scoped, unauthenticated Cognito Identity Pool permissions needed for the liveness widget, not your actual IAM user.

### 3. Set up the database

```bash
npx prisma generate   # generates the Prisma Client from schema.prisma
npx prisma db push    # or `npx prisma migrate dev` if you're tracking migrations
```

### 4. Run it

```bash
npm run dev
```

Visit `http://localhost:3000/login` for the admin console, or `http://localhost:3000/guest/event/{eventId}` for the guest experience.

---

## AWS setup notes

- **S3 bucket**: private, no public access. Everything is served through `/api/upload/view`, which fetches the object server-side and streams the bytes back — the bucket itself is never reachable from the browser.
- **Rekognition collections**: created lazily, one per event (`event-{eventId}`), the first time an asset from that event is processed. You don't need to pre-create anything.
- **Minimum IAM policy** for the server-side credentials:
  ```
  s3:GetObject, s3:PutObject           on your bucket
  rekognition:CreateCollection
  rekognition:DescribeCollection
  rekognition:IndexFaces
  rekognition:SearchFaces
  ```
- **Cognito Identity Pool**: needs unauthenticated access enabled, scoped to `rekognition:DetectFaces` / liveness session permissions only — this is the pool the browser talks to directly for the "Find Me" capture, so keep it minimal.

---

## Available scripts

| Command | Action |
| :--- | :--- |
| `npm run dev` | Start the dev server (Turbopack) |
| `npm run build` | Production build |
| `npm run start` | Run the production build |
| `npm run lint` | ESLint |
| `npx prisma studio` | Browse the database in a GUI |
| `npx prisma db push` | Push schema changes to the DB without a migration file |
| `npx prisma generate` | Regenerate the Prisma Client after any `schema.prisma` change |

> ⚠️ **`npm run build` does not currently run `prisma generate` first.** If you change `schema.prisma` and build without regenerating, you'll get a confusing TypeScript error claiming a field "does not exist" even though it's right there in the schema. Until this is fixed in `package.json`, run `npx prisma generate` manually before building, or update the script yourself:
> ```json
> "build": "prisma generate && next build"
> ```

---

## Known issues / things to fix

These are real, currently-unresolved items found while working on this codebase — flagging them here so they don't get rediscovered the hard way:

- **`lib/actions/guest-actions.ts`** — the guest session cookie sets `secure: process.env.NODE_NODE === "production"`. That's a typo (`NODE_ENV`, not `NODE_NODE`), so the condition is always `false` and the cookie never gets the `Secure` flag in production.
- **`/api/upload/view`** has no auth check of its own. It isn't under `middleware.ts`'s `/admin/:path*` matcher, so anyone with a valid `storageKey` can fetch that photo directly, bypassing event passcodes and moderation state. Worth deciding whether that's acceptable for your privacy model.
- **EXIF orientation**: uploaded photos aren't normalized server-side. Sideways/rotated uploads can look wrong in square thumbnail crops until this is handled at upload time.
- **`next/image` + the S3 proxy**: `/api/upload/view` must return real image bytes, not a redirect to a signed S3 URL — `next.config.ts`'s `images.localPatterns` only works correctly against a same-origin route that responds with actual image data.

---

## Contributing

1. Run `npx prisma generate` after pulling any schema change.
2. `npm run lint` and `npm run build` locally before opening a PR — build errors here are almost always stale-Prisma-Client or Tailwind arbitrary-value typos, both easy to catch early.
3. Keep server-only AWS credentials out of anything prefixed `NEXT_PUBLIC_`.

---

## License

MIT. This project handles biometric data (face vectors) and photos of real people — check your obligations under GDPR, BIPA, or your local equivalent before deploying it for a real event.