import { prisma } from "@/lib/prisma";
import { createHash } from "node:crypto";
import { isIP } from "node:net";

const CLIENT_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const EVENT_ATTEMPT_WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_CLIENT_FAILED_ATTEMPTS = 5;
const MAX_EVENT_FAILED_ATTEMPTS = 100;

export function getClientIp(headers: Headers) {
  const trustedIp = headers.get("x-real-ip")?.trim();
  return trustedIp && isIP(trustedIp) ? trustedIp : "unknown";
}

function advisoryLockId(value: string) {
  return createHash("sha256").update(value).digest().readInt32BE(0);
}

export async function reservePasscodeAttempt(eventId: string, clientIp: string) {
  const clientSince = new Date(Date.now() - CLIENT_ATTEMPT_WINDOW_MS);
  const eventSince = new Date(Date.now() - EVENT_ATTEMPT_WINDOW_MS);
  const lockIds = [...new Set([
    advisoryLockId(`event:${eventId}`),
    advisoryLockId(`client:${eventId}:${clientIp}`),
  ])].sort((left, right) => left - right);

  return prisma.$transaction(async (transaction) => {
    for (const lockId of lockIds) {
      await transaction.$queryRaw`SELECT pg_advisory_xact_lock(${lockId})`;
    }

    const countedActions = ["ACCESS_DENIED", "PASSCODE_ATTEMPT"];
    const [eventAttempts, clientAttempts] = await Promise.all([
      transaction.accessLog.count({
        where: { eventId, action: { in: countedActions }, createdAt: { gte: eventSince } },
      }),
      transaction.accessLog.count({
        where: { eventId, action: { in: countedActions }, ipAddress: clientIp, createdAt: { gte: clientSince } },
      }),
    ]);
    if (eventAttempts >= MAX_EVENT_FAILED_ATTEMPTS || clientAttempts >= MAX_CLIENT_FAILED_ATTEMPTS) return null;

    const reservation = await transaction.accessLog.create({
      data: {
        eventId,
        action: "PASSCODE_ATTEMPT",
        userName: "Guest Participant",
        ipAddress: clientIp,
        userAgent: "Passcode verification",
      },
      select: { id: true },
    });
    return reservation.id;
  });
}

export async function finishPasscodeAttempt(
  eventId: string,
  attemptId: string,
  succeeded: boolean,
  clientIp: string,
  userAgent: string,
) {
  if (succeeded) {
    await prisma.accessLog.deleteMany({
      where: { id: attemptId, eventId, action: "PASSCODE_ATTEMPT" },
    });
    return;
  }
  await prisma.accessLog.updateMany({
    where: { id: attemptId, eventId, action: "PASSCODE_ATTEMPT" },
    data: { action: "ACCESS_DENIED", ipAddress: clientIp, userAgent },
  });
}