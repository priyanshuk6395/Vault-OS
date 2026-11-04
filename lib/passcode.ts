import { createCipheriv, createDecipheriv, createHash, randomBytes, randomInt, scrypt, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";

const KEY_LENGTH = 64;
const EVENT_PASSCODE_PATTERN = /^\d{6}$/;

function deriveKey(passcode: string, salt: string) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(passcode, salt, KEY_LENGTH, (error, key) => {
      if (error) reject(error);
      else resolve(key as Buffer);
    });
  });
}

export function normalizePasscode(passcode: string) {
  return passcode.trim().toUpperCase();
}

export function isValidEventPasscode(passcode: unknown): passcode is string {
  return typeof passcode === "string" && EVENT_PASSCODE_PATTERN.test(normalizePasscode(passcode));
}

export function isEventPasscodeHash(passcode: string) {
  return passcode.startsWith("scrypt$v1$");
}

export function isEncryptedEventPasscode(passcode: string) {
  return passcode.startsWith("aes-256-gcm$v1$");
}

function getPasscodeEncryptionKey() {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is required to protect event passcodes");
  return createHash("sha256").update("vault-os:event-passcode:v1\0").update(secret).digest();
}

export function encryptEventPasscode(passcode: string) {
  const normalizedPasscode = normalizePasscode(passcode);
  if (!EVENT_PASSCODE_PATTERN.test(normalizedPasscode)) {
    throw new Error("Event passcodes must be exactly 6 digits");
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getPasscodeEncryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(normalizedPasscode, "utf8"),
    cipher.final(),
  ]);
  return [
    "aes-256-gcm",
    "v1",
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    ciphertext.toString("base64url"),
  ].join("$");
}

export function decryptEventPasscode(storedPasscode: string) {
  const [algorithm, version, encodedIv, encodedTag, encodedData, extra] = storedPasscode.split("$");
  if (algorithm !== "aes-256-gcm" || version !== "v1" || !encodedIv || !encodedTag || !encodedData || extra) {
    return null;
  }
  try {
    const decipher = createDecipheriv("aes-256-gcm", getPasscodeEncryptionKey(), Buffer.from(encodedIv, "base64url"));
    decipher.setAuthTag(Buffer.from(encodedTag, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(encodedData, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}

function passcodesMatch(left: string, right: string) {
  const normalizedLeft = Buffer.from(normalizePasscode(left));
  const normalizedRight = Buffer.from(normalizePasscode(right));
  return normalizedLeft.length === normalizedRight.length && timingSafeEqual(normalizedLeft, normalizedRight);
}

export async function hashEventPasscode(passcode: string) {
  const normalizedPasscode = normalizePasscode(passcode);
  if (!EVENT_PASSCODE_PATTERN.test(normalizedPasscode)) {
    throw new Error("Event passcodes must be exactly 6 digits");
  }
  const salt = randomBytes(16).toString("base64url");
  const key = await deriveKey(normalizedPasscode, salt);
  return `scrypt$v1$${salt}$${key.toString("base64url")}`;
}

export async function verifyEventPasscode(passcode: string, storedPasscode: string) {
  const normalized = normalizePasscode(passcode);
  if (!EVENT_PASSCODE_PATTERN.test(normalized)) return false;
  if (isEncryptedEventPasscode(storedPasscode)) {
    const decrypted = decryptEventPasscode(storedPasscode);
    return decrypted !== null && passcodesMatch(normalized, decrypted);
  }

  const [algorithm, version, salt, encodedKey, extra] = storedPasscode.split("$");

  if (algorithm !== "scrypt" || version !== "v1" || !salt || !encodedKey || extra) return passcodesMatch(normalized, storedPasscode);

  try {
    const expected = Buffer.from(encodedKey, "base64url");
    const actual = await deriveKey(normalized, salt);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export function generateEventPasscode() {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export async function migrateLegacyPasscodeIfCurrent(eventId: string, passcode: string, storedPasscode: string) {
  if (isEventPasscodeHash(storedPasscode) || isEncryptedEventPasscode(storedPasscode)) {
    return await verifyEventPasscode(passcode, storedPasscode) ? storedPasscode : null;
  }

  const migratedPasscode = encryptEventPasscode(passcode);
  const result = await prisma.event.updateMany({
    where: { id: eventId, passcode: storedPasscode },
    data: { passcode: migratedPasscode },
  });
  if (result.count === 1) return migratedPasscode;

  const current = await prisma.event.findUnique({
    where: { id: eventId },
    select: { passcode: true },
  });
  return current && await verifyEventPasscode(passcode, current.passcode) ? current.passcode : null;
}

export async function getDisplayableEventPasscode(eventId: string) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { passcode: true },
    });
    if (!event) return null;

    if (isEncryptedEventPasscode(event.passcode)) {
      const passcode = decryptEventPasscode(event.passcode);
      if (passcode !== null && isValidEventPasscode(passcode)) return { passcode, rotated: false };
    }

    const rotated = !isValidEventPasscode(event.passcode);
    const visiblePasscode = rotated ? generateEventPasscode() : normalizePasscode(event.passcode);
    const encryptedPasscode = encryptEventPasscode(visiblePasscode);
    const result = await prisma.event.updateMany({
      where: { id: eventId, passcode: event.passcode },
      data: { passcode: encryptedPasscode },
    });
    if (result.count === 1) return { passcode: visiblePasscode, rotated };
  }

  return null;
}