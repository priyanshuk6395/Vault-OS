import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  decryptEventPasscode,
  encryptEventPasscode,
  generateEventPasscode,
  hashEventPasscode,
  isValidEventPasscode,
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
    const encrypted = encryptEventPasscode(" 123456 ");

    expect(encrypted).toMatch(/^aes-256-gcm\$v1\$/);
    expect(encrypted).not.toContain("123456");
    expect(decryptEventPasscode(encrypted)).toBe("123456");
    await expect(verifyEventPasscode("123456", encrypted)).resolves.toBe(true);
    await expect(verifyEventPasscode("123457", encrypted)).resolves.toBe(false);
    await expect(verifyEventPasscode("12345", encrypted)).resolves.toBe(false);
    await expect(verifyEventPasscode("abcdef", encrypted)).resolves.toBe(false);
  });

  it("rejects tampering and a different encryption secret", () => {
    const encrypted = encryptEventPasscode("123456");
    const chunks = encrypted.split("$");
    chunks[4] = `${chunks[4][0] === "A" ? "B" : "A"}${chunks[4].slice(1)}`;
    expect(decryptEventPasscode(chunks.join("$"))).toBeNull();

    vi.stubEnv("NEXTAUTH_SECRET", "different-secret");
    expect(decryptEventPasscode(encrypted)).toBeNull();
  });

  it("continues to verify old scrypt hashes and legacy plaintext passcodes", async () => {
    const hash = await hashEventPasscode(" 123456 ");

    expect(hash).toMatch(/^scrypt\$v1\$/);
    expect(hash).not.toContain("123456");
    await expect(verifyEventPasscode("123456", hash)).resolves.toBe(true);
    await expect(verifyEventPasscode("123457", hash)).resolves.toBe(false);
    await expect(verifyEventPasscode("legacy-key", "LEGACY-KEY")).resolves.toBe(false);
    await expect(verifyEventPasscode("123456", "123456")).resolves.toBe(true);
  });

  it("validates exact six-digit codes and generates zero-padded numeric codes", () => {
    expect(isValidEventPasscode("123456")).toBe(true);
    expect(isValidEventPasscode(" 123456 ")).toBe(true);
    expect(isValidEventPasscode("12345")).toBe(false);
    expect(isValidEventPasscode("1234567")).toBe(false);
    expect(isValidEventPasscode("12a456")).toBe(false);
    expect(generateEventPasscode()).toMatch(/^\d{6}$/);
  });

  it("refuses to encrypt or hash values outside the six-digit format", async () => {
    expect(() => encryptEventPasscode("12345")).toThrow("exactly 6 digits");
    await expect(hashEventPasscode("12345")).rejects.toThrow("exactly 6 digits");
  });
});