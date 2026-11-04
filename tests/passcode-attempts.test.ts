import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { finishPasscodeAttempt, getClientIp, reservePasscodeAttempt } from "@/lib/passcode-attempts";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  queryRaw: vi.fn(),
  count: vi.fn(),
  create: vi.fn(),
  updateMany: vi.fn(),
  deleteMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { $transaction: mocks.transaction, accessLog: { updateMany: mocks.updateMany, deleteMany: mocks.deleteMany } },
}));

describe("passcode attempt controls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-01T12:00:00.000Z"));
    mocks.queryRaw.mockResolvedValue(undefined);
    mocks.count.mockResolvedValue(0);
    mocks.create.mockResolvedValue({ id: "attempt-1" });
    mocks.updateMany.mockResolvedValue({ count: 1 });
    mocks.deleteMany.mockResolvedValue({ count: 1 });
    mocks.transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => callback({
      $queryRaw: mocks.queryRaw,
      accessLog: { count: mocks.count, create: mocks.create },
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("reserves an attempt under transaction-scoped advisory locks", async () => {
    await expect(reservePasscodeAttempt("event-1", "203.0.113.8")).resolves.toBe("attempt-1");

    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(mocks.queryRaw).toHaveBeenCalled();
    expect(mocks.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ eventId: "event-1", action: "PASSCODE_ATTEMPT", ipAddress: "203.0.113.8" }),
      select: { id: true },
    });
    const [eventCount, clientCount] = mocks.count.mock.calls.map(([arg]) => arg as { where: { createdAt: { gte: Date }; ipAddress?: string } });
    expect(eventCount.where.createdAt.gte.toISOString()).toBe("2026-10-31T12:00:00.000Z");
    expect(clientCount.where.createdAt.gte.toISOString()).toBe("2026-11-01T11:45:00.000Z");
    expect(clientCount.where.ipAddress).toBe("203.0.113.8");
  });

  it("blocks the sixth failed attempt from one IP within fifteen minutes", async () => {
    mocks.count.mockResolvedValueOnce(0).mockResolvedValueOnce(5);

    await expect(reservePasscodeAttempt("event-1", "203.0.113.8")).resolves.toBeNull();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("blocks attempts after one hundred failures for an event in twenty-four hours", async () => {
    mocks.count.mockResolvedValueOnce(100).mockResolvedValueOnce(0);

    await expect(reservePasscodeAttempt("event-1", "203.0.113.8")).resolves.toBeNull();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("trusts only a valid X-Real-IP value, not arbitrary forwarded-for input", () => {
    expect(getClientIp(new Headers({ "x-real-ip": "203.0.113.8", "x-forwarded-for": "198.51.100.1" }))).toBe("203.0.113.8");
    expect(getClientIp(new Headers({ "x-forwarded-for": "198.51.100.1" }))).toBe("unknown");
    expect(getClientIp(new Headers({ "x-real-ip": "not-an-ip" }))).toBe("unknown");
  });

  it("removes a successful reservation and records a failed one", async () => {
    await finishPasscodeAttempt("event-1", "attempt-1", true, "203.0.113.8", "test agent");
    expect(mocks.deleteMany).toHaveBeenCalledWith({ where: { id: "attempt-1", eventId: "event-1", action: "PASSCODE_ATTEMPT" } });

    await finishPasscodeAttempt("event-1", "attempt-2", false, "203.0.113.8", "test agent");
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { id: "attempt-2", eventId: "event-1", action: "PASSCODE_ATTEMPT" },
      data: { action: "ACCESS_DENIED", ipAddress: "203.0.113.8", userAgent: "test agent" },
    });
  });
});
