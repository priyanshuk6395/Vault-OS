# VAULT OS — MASTER UPGRADE SPECIFICATION FOR GITHUB COPILOT

## Role & Objective
You are upgrading **Vault OS** (a Next.js 16 App Router, Tailwind CSS v4, Prisma/PostgreSQL, NextAuth, and AWS Rekognition/S3 biometric event photo platform). Execute the following 4 phases systematically without introducing mock functionality or breaking existing routes.

---

## PHASE 1: Dependencies, Security Unification & Bug Fixes

### 1.1 Update `package.json`
- Add production dependencies: `next-themes`, `sharp`, `p-limit`, `@aws-sdk/lib-storage`, `@smithy/node-http-handler`.
- Add devDependencies: `vitest`, `@vitejs/plugin-react`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `jsdom`, `@playwright/test`.
- Update scripts:
  - `"build": "prisma generate && next build"`
  - `"test": "vitest run"`
  - `"test:watch": "vitest"`
  - `"test:e2e": "playwright test"`

### 1.2 Unify NextAuth & Fix `ownerId` Mismatches
- **`lib/auth.ts`**: Ensure `authorize` returns `{ id: "admin-001", name: process.env.NEXT_PUBLIC_CREATOR_NAME || "Priyanshu Kumar", email: "admin@vault.os" }`.
- **`app/api/auth/[...nextauth]/route.ts`**: Replace inline `NextAuth({...})` config by importing `authOptions` from `@/lib/auth`:
  ```ts
  import NextAuth from "next-auth";
  import { authOptions } from "@/lib/auth";
  const handler = NextAuth(authOptions);
  export { handler as GET, handler as POST };


* **`app/api/admin/events/create/route.ts`**:
* Pass `authOptions` to `getServerSession(authOptions)`.
* Replace hardcoded `const ownerId = "priyanshuk6395"` with `const ownerId = session.user.id`.
* Fix Rekognition Collection ID bug: change `CollectionId: newEvent.id` to `CollectionId: \`event-${newEvent.id}``(or call`initializeEventCollection(newEvent.id)`from`@/lib/rekognition`).


* **`app/api/admin/events/route.ts`**: Pass `authOptions` to `getServerSession(authOptions)`.

### 1.3 Fix Guest Cookie & Security Gates

* **`lib/actions/guest-actions.ts`**: Fix typo `process.env.NODE_NODE === "production"` -> `process.env.NODE_ENV === "production"`.
* **`app/api/events/[eventId]/verify/route.ts`**: Change cookie name from `vault_auth_${eventId}` to `event_auth_${eventId}` so it matches `app/(guest)/guest/event/[eventId]/page.tsx` and `lib/actions/auth-actions.ts`.
* **`app/api/upload/view/route.ts`**:
* Verify authorization before serving S3 bytes: check `getServerSession(authOptions)` OR verify that the `key` starts with `events/${eventId}/` where `cookies().get(\`event_auth_${eventId}`)`is present, OR allow if the event's`themeImageUrl`/`topPersonImageKey` is being requested by an authenticated admin.



---

## PHASE 2: WebP Performance Pipeline & Parallel Upload Engine

### 2.1 Persistent AWS HTTP Keep-Alive (`lib/aws.ts`)

* Configure `NodeHttpHandler` with `keepAlive: true` and `maxSockets: 50` on both `s3Client` and `rekognitionClient` to eliminate TLS handshake overhead during parallel uploads and face searches.

### 2.2 Client-Side WebP Conversion & Unified Upload Queue (`context/UploadProvider.tsx`)

* Upgrade `UploadProvider` so both Admin (`UploadDialog.tsx`) and Guest (`GuestUploadDialog.tsx`) can use the same engine (add optional `uploaderId?: string` to `addFilesToQueue(files: File[], eventId: string, uploaderId?: string)`).
* **Adaptive Concurrency**: Set `MAX_CONCURRENCY` dynamically: `Math.max(3, Math.min(navigator?.hardwareConcurrency || 4, 6))`.
* **WebP Compression Step**:
* After HEIC decoding (`heic2any`), run `browser-image-compression` with:
```ts
{
  maxSizeMB: 1.2,
  maxWidthOrHeight: 2048,
  useWebWorker: true,
  fileType: "image/webp",
  initialQuality: 0.85,
}

```


* Rename the output file extension to `.webp` and set `type: "image/webp"`.


* **Automatic Retry with Exponential Backoff**:
* Wrap `/api/upload/init`, the S3 `PUT` XHR, and `/api/upload/complete` in a `withRetry(fn, retries = 3, baseDelay = 600)` helper.
* Expose `retryFailedTasks()` and `clearCompletedTasks()` from `UploadContext`.



### 2.3 Batch Initialization Endpoint (`app/api/upload/init/route.ts`)

* Support both single-file payload `{ eventId, filename, contentType, size, assetType, uploaderId }` AND batch payload `{ eventId, uploaderId, files: Array<{ filename, contentType, size, assetType }> }`.
* When `files` array is provided, create all `Asset` rows in a single `prisma.$transaction` and generate all presigned `PutObjectCommand` URLs in parallel via `Promise.all`, returning `{ items: Array<{ clientIndex, assetId, uploadUrl }> }`.

### 2.4 WebP-Aware Rekognition Indexing & Parallel Clustering (`app/api/upload/complete/route.ts`)

* **CRITICAL AWS REKOGNITION WEBP BRIDGE**:
* AWS Rekognition `IndexFacesCommand` only accepts JPEG or PNG bytes.
* Check if `asset.storageKey.endsWith(".webp")` or `asset.mimeType === "image/webp"`.
* If WebP: fetch the object from S3 (`GetObjectCommand`), pipe through `sharp(bytes).rotate().jpeg({ quality: 90 }).toBuffer()`, and pass `Image: { Bytes: jpegBuffer }` into `IndexFacesCommand`.
* If JPEG/PNG: keep using `Image: { S3Object: { Bucket, Name: asset.storageKey } }`.


* **Parallel Face Clustering (`p-limit`)**:
* Replace the sequential `for (const record of faceRecords)` loop with `p-limit(5)` over `faceRecords.map(...)`.
* Run `SearchFacesCommand` concurrently (max 5 in flight), resolve or create `Person` records, and execute `faceDetection.upsert` + `faceSample.upsert`.



### 2.5 On-the-Fly Sharp WebP & Resize Proxy (`app/api/upload/view/route.ts`)

* Support optional query params: `?key=...&w=800&q=82&format=webp`.
* Pipe S3 `Body` bytes through `sharp(bytes).rotate()` (fixes EXIF sideways orientation).
* If `w` is provided, `.resize({ width: Number(w), withoutEnlargement: true })`.
* Output `.webp({ quality: Number(q) || 82 })` with `Content-Type: image/webp` and `Cache-Control: public, max-age=31536000, immutable`.

---

## PHASE 3: "Gallery Luxe" Design System & Coordinated Light/Dark/System Themes

### 3.1 Semantic Design Tokens (`app/globals.css`)

Replace hardcoded colors with Tailwind CSS v4 semantic variables supporting Light (`:root`) and Dark (`.dark`):

* **Light Theme (Gallery Luxe)**:
* `--background`: `#FAF8F4` (Warm Ivory)
* `--background-elevated`: `#FFFFFF` (Pure White)
* `--background-subtle`: `#F2EFE9` (Alabaster)
* `--foreground`: `#20232B` (Deep Ink)
* `--foreground-muted`: `#6B7280` (Muted Slate)
* `--card`: `#FFFFFF`, `--card-foreground`: `#20232B`
* `--popover`: `#FFFFFF`, `--popover-foreground`: `#20232B`
* `--primary`: `#4169E1` (Cobalt), `--primary-foreground`: `#FFFFFF`
* `--secondary`: `#E9E5FF` (Soft Lavender), `--secondary-foreground`: `#20232B`
* `--accent`: `#F2EFE9`, `--accent-foreground`: `#20232B`
* `--accent-teal`: `#168C82`, `--accent-coral`: `#E97863`, `--accent-amber`: `#D99A32`, `--accent-lavender`: `#E9E5FF`
* `--border`: `#E6E2D8`, `--input`: `#E6E2D8`, `--ring`: `#4169E1`


* **Dark Theme (Obsidian Editorial)**:
* `--background`: `#0B0C10` (Obsidian)
* `--background-elevated`: `#13151C` (Graphite)
* `--background-subtle`: `#1B1E28` (Charcoal)
* `--foreground`: `#F5F6F8` (Crisp Alabaster)
* `--foreground-muted`: `#9CA3AF` (Cool Pewter)
* `--card`: `#13151C`, `--card-foreground`: `#F5F6F8`
* `--popover`: `#13151C`, `--popover-foreground`: `#F5F6F8`
* `--primary`: `#5B82F6` (Luminous Cobalt), `--primary-foreground`: `#FFFFFF`
* `--secondary`: `#231F38` (Deep Lavender), `--secondary-foreground`: `#E9E5FF`
* `--accent`: `#1B1E28`, `--accent-foreground`: `#F5F6F8`
* `--accent-teal`: `#2DD4BF`, `--accent-coral`: `#F28B78`, `--accent-amber`: `#F5B041`, `--accent-lavender`: `#2A2444`
* `--border`: `rgba(255, 255, 255, 0.09)`, `--input`: `rgba(255, 255, 255, 0.12)`, `--ring`: `#5B82F6`


* Map all custom tokens inside `@theme inline` so utility classes like `bg-background`, `bg-card`, `bg-subtle`, `text-foreground`, `text-muted-foreground`, `text-primary`, `bg-accent-teal`, `bg-accent-coral`, `bg-accent-amber`, `bg-accent-lavender`, `border-border` work seamlessly.

### 3.2 Flicker-Free Theme Infrastructure

* **`components/theme/ThemeProvider.tsx`**: Wrap `NextThemesProvider` with `attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange`.
* **`components/theme/ThemeToggle.tsx`**: Build an accessible segmented pill control (`Light` / `Dark` / `System` with `Sun`, `Moon`, `Monitor` icons) using `useTheme()`, with keyboard navigation and `aria-label`s.
* **`app/layout.tsx`**:
* Remove hardcoded `className="dark"` from `<html>`; add `suppressHydrationWarning`.
* Load `Instrument_Serif` alongside `Geist` and `Geist_Mono` from `next/font/google` and bind `--font-serif`.
* Wrap `{children}` in `<ThemeProvider>` and make `<Toaster />` theme-aware.



### 3.3 Component & Page Refactoring (Eliminate Hardcoded Hexes)

Refactor all pages and components to use the Gallery Luxe tokens (`bg-background`, `bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`, `bg-primary`, `text-accent-teal`, `text-accent-coral`, `text-accent-amber`):

1. **Landing & Auth**: `app/page.tsx`, `app/login/page.tsx` (add `ThemeToggle` to top nav).
2. **Admin Shell & Hub**: `app/(admin)/admin/layout.tsx` (unify background to `bg-background` across all admin routes; add `ThemeToggle` in header), `components/admin/SideBar.tsx`, `components/admin/EventSwitcher.tsx`, `components/admin/AdminDashboardClient.tsx` (fix header contrast, theme-aware vault cards, 3-column square `ThemePicker` with `NextImage` and `object-cover`), `components/admin/CreateEventModal.tsx`, `components/admin/PipelineHUD.tsx`.
3. **Admin Event Pages**: `overview/page.tsx`, `StatCard.tsx`, `media/page.tsx`, `MediaClientPage.tsx`, `MediaGrid.tsx`, `UploadDialog.tsx`, `people/page.tsx`, `PeopleGallery.tsx`, `PurgeButton.tsx`, `face-review/page.tsx`, `FaceReviewClient.tsx`, `guest-uploads/page.tsx`, `GuestUploadClient.tsx`, `access/page.tsx`, `AccessButtons.tsx`, `PrivacySettings.tsx`, `audit/page.tsx`, `settings/page.tsx`.
4. **Guest Portal**: `app/(guest)/guest/event/[eventId]/page.tsx`, `PasscodeGate.tsx`, `FindMeCamera.tsx` (dynamically switch Amplify `ThemeProvider` `colorMode` based on `resolvedTheme` and map Cobalt/Coral tokens), `my-photos/page.tsx`, `GuestGalleryClient.tsx`, `ImageGrid.tsx`, `GuestUploadTrigger.tsx`, `GuestUploadDialog.tsx`, `LogoutButton.tsx`.

---

## PHASE 4: Automated Testing Suite

1. **`vitest.config.ts` & `tests/setup.ts**`: Configure Vitest with `jsdom` and `@testing-library/jest-dom`.
2. **`tests/ThemeToggle.test.tsx`**: Verify rendering, switching between `light`, `dark`, and `system`, and ARIA attributes.
3. **`tests/UploadProvider.test.tsx`**: Mock `fetch` and `XMLHttpRequest` to test queuing, concurrency throttling, and retry behavior.
4. **`tests/AdminDashboardClient.test.tsx`**: Verify vault card rendering, opening the settings dialog, updating title, and selecting a theme image in `ThemePicker`.
5. **`playwright.config.ts` & `e2e/theme-and-auth.spec.ts**`: Verify Light/Dark/System toggle updates `document.documentElement.classList` without layout shift, login page accessibility, and guest passcode gate rendering.