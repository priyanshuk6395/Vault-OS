import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDisplayableEventPasscode } from "@/lib/passcode";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  updateMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { event: { findUnique: mocks.findUnique, updateMany: mocks.updateMany } },
}));

describe("displaying legacy event passcodes", () => {
  beforeEach(() => {
    vi.stubEnv("NEXTAUTH_SECRET", "test-only-nextauth-secret");
    mocks.findUnique.mockResolvedValue({ passcode: "scrypt$v1$legacy$hash" });
    mocks.updateMany.mockResolvedValue({ count: 1 });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rotates a non-numeric legacy hash to an encrypted six-digit passcode", async () => {
    const result = await getDisplayableEventPasscode("event-1");

    expect(result).toMatchObject({ rotated: true });
    expect(result?.passcode).toMatch(/^\d{6}$/);
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { id: "event-1", passcode: "scrypt$v1$legacy$hash" },
      data: { passcode: expect.stringMatching(/^aes-256-gcm\$v1\$/) },
    });
  });

  it("preserves and encrypts a valid six-digit legacy plaintext code", async () => {
    mocks.findUnique.mockResolvedValue({ passcode: "012345" });

    const result = await getDisplayableEventPasscode("event-1");

    expect(result).toEqual({ passcode: "012345", rotated: false });
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { id: "event-1", passcode: "012345" },
      data: { passcode: expect.stringMatching(/^aes-256-gcm\$v1\$/) },
    });
  });

  it("retries a concurrent rotation and returns null after repeated lost claims", async () => {
    mocks.updateMany.mockResolvedValue({ count: 0 });
    mocks.findUnique
      .mockResolvedValueOnce({ passcode: "scrypt$v1$old$salt" })
      .mockResolvedValueOnce({ passcode: "scrypt$v1$old$salt" })
      .mockResolvedValueOnce({ passcode: "scrypt$v1$old$salt" });

    await expect(getDisplayableEventPasscode("event-1")).resolves.toBeNull();
    expect(mocks.updateMany).toHaveBeenCalledTimes(3);
  });
});
