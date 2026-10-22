import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createGuestPersonToken,
  createGuestSessionToken,
  getGuestPersonIdFromToken,
  isValidGuestSessionToken,
} from "@/lib/guest-session";

describe("guest session tokens", () => {
  beforeEach(() => {
    vi.stubEnv("NEXTAUTH_SECRET", "test-only-secret-for-guest-session");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("accepts a signed, unexpired token for its event", () => {
    const token = createGuestSessionToken("event-1");

    expect(isValidGuestSessionToken(token, "event-1")).toBe(true);
    expect(isValidGuestSessionToken(token, "event-1", "rotated-passcode-version")).toBe(false);
  });

  it("rejects tokens for another event and modified signatures", () => {
    const token = createGuestSessionToken("event-1");
    const [payload, signature] = token.split(".");

    expect(isValidGuestSessionToken(token, "event-2")).toBe(false);
    expect(isValidGuestSessionToken(`${payload}.${signature}x`, "event-1")).toBe(false);
  });

  it("keeps event access and verified person identity tokens separate", () => {
    const eventToken = createGuestSessionToken("event-1");
    const personToken = createGuestPersonToken("event-1", "person-1");

    expect(isValidGuestSessionToken(personToken, "event-1")).toBe(false);
    expect(getGuestPersonIdFromToken(eventToken, "event-1")).toBeNull();
    expect(getGuestPersonIdFromToken(personToken, "event-1")).toBe("person-1");
    expect(getGuestPersonIdFromToken(personToken, "event-2")).toBeNull();
    expect(getGuestPersonIdFromToken(personToken, "event-1", "rotated-passcode-version")).toBeNull();
  });

  it("rejects expired tokens and tokens without a signing secret", () => {
    const expiredToken = createGuestSessionToken("event-1", 0);
    const validToken = createGuestSessionToken("event-1");
    expect(isValidGuestSessionToken(expiredToken, "event-1")).toBe(false);

    vi.stubEnv("NEXTAUTH_SECRET", "");
    expect(isValidGuestSessionToken(validToken, "event-1")).toBe(false);
  });
});
