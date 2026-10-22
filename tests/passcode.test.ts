import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  decryptEventPasscode,
  encryptEventPasscode,
  generateEventPasscode,
  hashEventPasscode,
  verifyEventPasscode,
} from "@/lib/passcode";

describe("event passcodes", () => {
  beforeEach(() => {
    vi.stubEnv("NEXTAUTH_SECRET", "test-only-nextauth-secret");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("encrypts passcodes at rest and verifies normalized input", async () => {
    const encrypted = encryptEventPasscode(" vault-2048 ");

    expect(encrypted).toMatch(/^aes-256-gcm\$v1\$/);
    expect(encrypted).not.toContain("VAULT-2048");
    expect(decryptEventPasscode(encrypted)).toBe("VAULT-2048");
    await expect(verifyEventPasscode("vault-2048", encrypted)).resolves.toBe(true);
    await expect(verifyEventPasscode("wrong-passcode", encrypted)).resolves.toBe(false);
  });

  it("rejects tampering and a different encryption secret", () => {
    const encrypted = encryptEventPasscode("vault-2048");
    const chunks = encrypted.split("$");
    chunks[4] = `${chunks[4]}x`;
    expect(decryptEventPasscode(chunks.join("$"))).toBeNull();

    vi.stubEnv("NEXTAUTH_SECRET", "different-secret");
    expect(decryptEventPasscode(encrypted)).toBeNull();
  });

  it("continues to verify old scrypt hashes and legacy plaintext passcodes", async () => {
    const hash = await hashEventPasscode(" vault-2048 ");

    expect(hash).toMatch(/^scrypt\$v1\$/);
    expect(hash).not.toContain("VAULT-2048");
    await expect(verifyEventPasscode("vault-2048", hash)).resolves.toBe(true);
    await expect(verifyEventPasscode("wrong-passcode", hash)).resolves.toBe(false);
    await expect(verifyEventPasscode("legacy-key", "LEGACY-KEY")).resolves.toBe(true);
    await expect(verifyEventPasscode("wrong-key", "LEGACY-KEY")).resolves.toBe(false);
  });

  it("generates high-entropy URL-safe passcodes", () => {
    expect(generateEventPasscode()).toMatch(/^[A-Z0-9_-]{16}$/);
  });
});