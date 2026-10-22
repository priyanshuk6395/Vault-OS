import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions, ownsEvent } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const GUEST_SESSION_SECONDS = 60 * 60 * 24;
const GUEST_PERSON_SESSION_SECONDS = 60 * 60;
const TEST_PASSCODE = "test-only-passcode";

function sign(payload: string) {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is required for guest sessions");
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function passcodeVersion(passcode: string) {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is required for guest sessions");
  return createHmac("sha256", secret).update("guest-passcode-version:").update(passcode).digest("base64url");
}

export function guestCookieName(eventId: string) {
  return `event_auth_${eventId}`;
}

export function guestPersonCookieName(eventId: string) {
  return `event_person_${eventId}`;
}

export function createGuestSessionToken(eventId: string, maxAgeSeconds = GUEST_SESSION_SECONDS, currentPasscode = TEST_PASSCODE) {
  const payload = Buffer.from(JSON.stringify({
    purpose: "event",
    eventId,
    passcodeVersion: passcodeVersion(currentPasscode),
    expiresAt: Math.floor(Date.now() / 1000) + maxAgeSeconds,
  })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function readSignedClaims(token: string | undefined) {
  if (!token) return null;

  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return null;

  let expectedSignature: string;
  try {
    expectedSignature = sign(payload);
  } catch {
    return null;
  }

  const actual = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;

  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!Number.isInteger(claims.expiresAt) || claims.expiresAt <= Math.floor(Date.now() / 1000)) return null;
    return claims as { purpose: string; eventId: string; expiresAt: number; personId?: string; passcodeVersion?: string };
  } catch {
    return null;
  }
}

export function isValidGuestSessionToken(token: string | undefined, eventId: string, currentPasscode = TEST_PASSCODE) {
  const claims = readSignedClaims(token);
  return !!claims && claims.purpose === "event" && claims.eventId === eventId &&
    claims.passcodeVersion === passcodeVersion(currentPasscode);
}

export function createGuestPersonToken(
  eventId: string,
  personId: string,
  maxAgeSeconds = GUEST_PERSON_SESSION_SECONDS,
  currentPasscode = TEST_PASSCODE,
) {
  const payload = Buffer.from(JSON.stringify({
    purpose: "person",
    eventId,
    personId,
    passcodeVersion: passcodeVersion(currentPasscode),
    expiresAt: Math.floor(Date.now() / 1000) + maxAgeSeconds,
  })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function getGuestPersonIdFromToken(token: string | undefined, eventId: string, currentPasscode = TEST_PASSCODE) {
  const claims = readSignedClaims(token);
  return claims?.purpose === "person" && claims.eventId === eventId &&
    claims.passcodeVersion === passcodeVersion(currentPasscode) && typeof claims.personId === "string"
    ? claims.personId
    : null;
}

export async function issueGuestSessionCookie(eventId: string, maxAgeSeconds = GUEST_SESSION_SECONDS, currentPasscode?: string) {
  const passcode = currentPasscode ?? (await prisma.event.findUnique({
    where: { id: eventId },
    select: { passcode: true },
  }))?.passcode;
  if (!passcode) throw new Error("Vault passcode is unavailable");
  const cookieStore = await cookies();
  cookieStore.set(guestCookieName(eventId), createGuestSessionToken(eventId, maxAgeSeconds, passcode), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: maxAgeSeconds,
    path: "/",
  });
}

export async function hasValidGuestSession(eventId: string) {
  const [cookieStore, event] = await Promise.all([
    cookies(),
    prisma.event.findUnique({ where: { id: eventId }, select: { passcode: true } }),
  ]);
  return !!event && isValidGuestSessionToken(cookieStore.get(guestCookieName(eventId))?.value, eventId, event.passcode);
}

export async function issueGuestPersonCookie(
  eventId: string,
  personId: string,
  maxAgeSeconds = GUEST_PERSON_SESSION_SECONDS,
  currentPasscode?: string,
) {
  const passcode = currentPasscode ?? (await prisma.event.findUnique({
    where: { id: eventId },
    select: { passcode: true },
  }))?.passcode;
  if (!passcode) throw new Error("Vault passcode is unavailable");
  const cookieStore = await cookies();
  cookieStore.set(guestPersonCookieName(eventId), createGuestPersonToken(eventId, personId, maxAgeSeconds, passcode), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: maxAgeSeconds,
    path: "/",
  });
}

export async function getGuestPersonId(eventId: string) {
  const [cookieStore, event] = await Promise.all([
    cookies(),
    prisma.event.findUnique({ where: { id: eventId }, select: { passcode: true, biometricSearch: true } }),
  ]);
  if (!event?.biometricSearch) return null;
  return getGuestPersonIdFromToken(cookieStore.get(guestPersonCookieName(eventId))?.value, eventId, event.passcode);
}

export async function hasValidGuestPersonSession(eventId: string, personId: string) {
  return (await getGuestPersonId(eventId)) === personId;
}

export async function guestCanAccessAsset(eventId: string, personId: string | null, assetId: string) {
  if (!personId) return false;
  const asset = await prisma.asset.findFirst({
    where: {
      id: assetId,
      eventId,
      OR: [
        { uploaderId: personId, status: { in: ["uploading", "uploaded", "processing", "processed"] } },
        {
          status: "processed",
          moderationState: "approved",
          faceDetections: { some: { personId } },
        },
      ],
    },
    select: { id: true },
  });
  return !!asset;
}

export async function clearGuestSessionCookies(eventId: string) {
  const cookieStore = await cookies();
  cookieStore.delete(guestCookieName(eventId));
  cookieStore.delete(guestPersonCookieName(eventId));
}

export async function getEventAuthorization(eventId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      ownerId: true,
      guestUploadPolicy: true,
      biometricSearch: true,
      publicGallery: true,
      title: true,
      passcode: true,
    },
  });
  if (!event) return { event: null, isOwner: false, isGuest: false };

  const [session, cookieStore] = await Promise.all([
    getServerSession(authOptions),
    cookies(),
  ]);

  const isOwner = ownsEvent(event.ownerId, session?.user?.id);
  const isGuest = isValidGuestSessionToken(cookieStore.get(guestCookieName(eventId))?.value, eventId, event.passcode);
  return { event, isOwner, isGuest: !isOwner && isGuest };
}