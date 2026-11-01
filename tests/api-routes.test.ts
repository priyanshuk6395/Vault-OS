import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Readable } from "node:stream";
import { NextRequest } from "next/server";
import sharp from "sharp";
import { POST as createEvent } from "@/app/api/events/route";
import { POST as verifyPasscode } from "@/app/api/events/verify-passcode/route";
import { POST as verifyEvent } from "@/app/api/events/[eventId]/verify/route";
import { PATCH as updateEventSettings } from "@/app/api/events/[eventId]/settings/route";
import { GET as getEventStats } from "@/app/api/events/[eventId]/stats/route";
import { GET as downloadGuestArchive } from "@/app/api/events/[eventId]/download-all/route";
import { GET as downloadAdminArchive } from "@/app/api/events/[eventId]/download-all-admin/route";
import { GET as listEventAssets } from "@/app/api/events/[eventId]/assets/route";
import { GET as listApprovedAssets } from "@/app/api/events/[eventId]/assets/approved/route";
import { DELETE as deleteEventAsset } from "@/app/api/events/[eventId]/assets/[assetId]/route";
import { GET as listEventPeople } from "@/app/api/events/[eventId]/people/route";
import { POST as purgeEventPeople } from "@/app/api/events/[eventId]/people/purge/route";
import { POST as reviewDetection } from "@/app/api/events/[eventId]/review/[detectionId]/route";
import { POST as createLivenessSession } from "@/app/api/events/[eventId]/liveness/create/route";
import { POST as findMe } from "@/app/api/events/[eventId]/find-me/route";
import { POST as moderateUpload } from "@/app/api/admin/moderate-upload/route";
import { GET as listAdminEvents } from "@/app/api/admin/events/route";
import { POST as createAdminEvent } from "@/app/api/admin/events/create/route";
import { GET as getSidebarStats } from "@/app/api/admin/sidebar-stats/route";
import { POST as logAdminTelemetry } from "@/app/api/admin/log-telemetry/route";
import { PATCH as updatePerson } from "@/app/api/people/[personId]/route";
import { POST as initializeUpload } from "@/app/api/upload/init/route";
import { POST as completeUpload } from "@/app/api/upload/complete/route";
import { POST as reportUploadFailure } from "@/app/api/upload/fail/route";
import { GET as getDownloadUrl } from "@/app/api/upload/download-url/route";
import { GET as viewUpload } from "@/app/api/upload/view/route";

const mocks = vi.hoisted(() => ({
  prisma: {
    event: {
      findUnique: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    asset: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
    person: { findFirst: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn(), delete: vi.fn(), deleteMany: vi.fn(), count: vi.fn() },
    faceDetection: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), upsert: vi.fn(), updateMany: vi.fn(), delete: vi.fn(), deleteMany: vi.fn(), count: vi.fn() },
    faceSample: { findMany: vi.fn(), create: vi.fn(), upsert: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
    accessLog: { create: vi.fn() },
    $transaction: vi.fn(),
  },
  getEventAuthorization: vi.fn(),
  getGuestPersonId: vi.fn(),
  issueGuestPersonCookie: vi.fn(),
  guestCanAccessAsset: vi.fn(),
  issueGuestSessionCookie: vi.fn(),
  verifyEventPasscode: vi.fn(),
  migrateLegacyPasscodeIfCurrent: vi.fn(),
  reservePasscodeAttempt: vi.fn(),
  finishPasscodeAttempt: vi.fn(),
  getClientIp: vi.fn(),
  getSignedUrl: vi.fn(),
  s3Send: vi.fn(),
  rekognitionSend: vi.fn(),
  deleteEventFacesForImage: vi.fn(),
  deleteEventFaceIds: vi.fn(),
  getServerSession: vi.fn(),
  ownsEvent: vi.fn(),
  eventOwnerIds: vi.fn(),
  encryptEventPasscode: vi.fn(),
  initializeEventCollection: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/guest-session", () => ({
  getEventAuthorization: mocks.getEventAuthorization,
  getGuestPersonId: mocks.getGuestPersonId,
  issueGuestPersonCookie: mocks.issueGuestPersonCookie,
  guestCanAccessAsset: mocks.guestCanAccessAsset,
  issueGuestSessionCookie: mocks.issueGuestSessionCookie,
}));
vi.mock("@/lib/passcode", () => ({
  verifyEventPasscode: mocks.verifyEventPasscode,
  migrateLegacyPasscodeIfCurrent: mocks.migrateLegacyPasscodeIfCurrent,
  encryptEventPasscode: mocks.encryptEventPasscode,
}));
vi.mock("@/lib/passcode-attempts", () => ({
  reservePasscodeAttempt: mocks.reservePasscodeAttempt,
  finishPasscodeAttempt: mocks.finishPasscodeAttempt,
  getClientIp: mocks.getClientIp,
}));
vi.mock("@/lib/rekognition", () => ({
  deleteEventFacesForImage: mocks.deleteEventFacesForImage,
  deleteEventFaceIds: mocks.deleteEventFaceIds,
  initializeEventCollection: mocks.initializeEventCollection,
}));
vi.mock("@/lib/aws", () => ({
  s3Client: { send: mocks.s3Send },
  rekognitionClient: { send: mocks.rekognitionSend },
}));
vi.mock("@aws-sdk/s3-request-presigner", () => ({ getSignedUrl: mocks.getSignedUrl }));
vi.mock("next-auth", () => ({ getServerSession: mocks.getServerSession }));
vi.mock("@/lib/auth", () => ({
  authOptions: {},
  ownsEvent: mocks.ownsEvent,
  eventOwnerIds: mocks.eventOwnerIds,
}));

const event = {
  id: "event-1",
  ownerId: "owner-1",
  guestUploadPolicy: "allowed",
  publicGallery: true,
  biometricSearch: true,
  passcode: "encrypted-passcode",
  title: "Test event",
};

function request(url: string, body: unknown, headers: HeadersInit = {}) {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

function methodRequest(url: string, method: string, body: unknown, headers: HeadersInit = {}) {
  return new Request(url, {
    method,
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

describe("API route boundaries", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.event.findUnique.mockResolvedValue(event);
    mocks.prisma.asset.findMany.mockResolvedValue([]);
    mocks.prisma.asset.create.mockResolvedValue({ id: "upload-1" });
    mocks.prisma.$transaction.mockResolvedValue([]);
    mocks.getEventAuthorization.mockResolvedValue({ event, isOwner: true, isGuest: false });
    mocks.getGuestPersonId.mockResolvedValue("guest-1");
    mocks.issueGuestPersonCookie.mockResolvedValue(undefined);
    mocks.guestCanAccessAsset.mockResolvedValue(false);
    mocks.issueGuestSessionCookie.mockResolvedValue(undefined);
    mocks.verifyEventPasscode.mockResolvedValue(true);
    mocks.migrateLegacyPasscodeIfCurrent.mockResolvedValue("passcode-snapshot");
    mocks.reservePasscodeAttempt.mockResolvedValue("attempt-1");
    mocks.finishPasscodeAttempt.mockResolvedValue(undefined);
    mocks.getClientIp.mockReturnValue("203.0.113.8");
    mocks.getSignedUrl.mockResolvedValue("https://signed.invalid/upload");
    mocks.getServerSession.mockResolvedValue({ user: { id: "owner-1", name: "Vault Admin", email: "admin@example.test" } });
    mocks.ownsEvent.mockReturnValue(true);
    mocks.eventOwnerIds.mockReturnValue(["owner-1"]);
    mocks.encryptEventPasscode.mockReturnValue("encrypted-passcode");
    mocks.initializeEventCollection.mockResolvedValue({ success: true });
    mocks.prisma.event.create.mockResolvedValue(event);
    mocks.prisma.event.update.mockResolvedValue(event);
    mocks.prisma.event.findMany.mockResolvedValue([]);
    mocks.prisma.asset.updateMany.mockResolvedValue({ count: 1 });
    mocks.prisma.asset.count.mockResolvedValue(0);
    mocks.prisma.person.count.mockResolvedValue(0);
    mocks.prisma.faceDetection.count.mockResolvedValue(0);
    mocks.prisma.accessLog.create.mockResolvedValue({});
    mocks.rekognitionSend.mockResolvedValue({ SessionId: "liveness-session" });
    mocks.s3Send.mockResolvedValue({});
  });

  describe("POST /api/events/verify-passcode", () => {
    it("rejects malformed input before reserving an attempt", async () => {
      const response = await verifyPasscode(request("http://localhost/api/events/verify-passcode", { eventId: "event-1", passcode: 123 }));

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "Invalid passcode request." });
      expect(mocks.reservePasscodeAttempt).not.toHaveBeenCalled();
      expect(mocks.issueGuestSessionCookie).not.toHaveBeenCalled();
    });

    it("rate limits before checking the submitted passcode", async () => {
      mocks.reservePasscodeAttempt.mockResolvedValue(null);

      const response = await verifyPasscode(request("http://localhost/api/events/verify-passcode", { eventId: "event-1", passcode: "wrong" }));

      expect(response.status).toBe(429);
      expect(mocks.verifyEventPasscode).not.toHaveBeenCalled();
      expect(mocks.finishPasscodeAttempt).not.toHaveBeenCalled();
    });

    it("records a failed attempt and does not issue a guest cookie", async () => {
      mocks.verifyEventPasscode.mockResolvedValue(false);

      const response = await verifyPasscode(request("http://localhost/api/events/verify-passcode", { eventId: "event-1", passcode: "wrong" }, { "user-agent": "API test", "x-forwarded-for": "203.0.113.8, 10.0.0.1" }));

      expect(response.status).toBe(401);
      expect(mocks.finishPasscodeAttempt).toHaveBeenCalledWith("event-1", "attempt-1", false, "203.0.113.8", "API test");
      expect(mocks.issueGuestSessionCookie).not.toHaveBeenCalled();
    });

    it("issues a guest cookie and audits a valid passcode", async () => {
      const response = await verifyPasscode(request("http://localhost/api/events/verify-passcode", { eventId: "event-1", passcode: "correct-passcode" }, { "user-agent": "API test", "x-forwarded-for": "203.0.113.8, 10.0.0.1" }));

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ success: true, eventId: "event-1" });
      expect(mocks.finishPasscodeAttempt).toHaveBeenCalledWith("event-1", "attempt-1", true, "203.0.113.8", "API test");
      expect(mocks.prisma.accessLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ eventId: "event-1", action: "ACCESS_GRANTED", ipAddress: "203.0.113.8" }),
      });
      expect(mocks.issueGuestSessionCookie).toHaveBeenCalledWith("event-1", 604800, "passcode-snapshot");
    });
  });

  describe("POST /api/upload/init", () => {
    const validBody = {
      eventId: "event-1",
      filename: "portrait.jpg",
      contentType: "image/jpeg",
      size: 2048,
      assetType: "image",
      clientUploadId: "11111111-1111-4111-8111-111111111111",
    };

    it("rejects an absent event id before authorization or persistence", async () => {
      const response = await initializeUpload(request("http://localhost/api/upload/init", { ...validBody, eventId: "" }));

      expect(response.status).toBe(400);
      expect(mocks.getEventAuthorization).not.toHaveBeenCalled();
      expect(mocks.prisma.asset.create).not.toHaveBeenCalled();
      expect(mocks.getSignedUrl).not.toHaveBeenCalled();
    });

    it("denies a caller without owner or guest access", async () => {
      mocks.getEventAuthorization.mockResolvedValue({ event, isOwner: false, isGuest: false });

      const response = await initializeUpload(request("http://localhost/api/upload/init", validBody));

      expect(response.status).toBe(401);
      expect(mocks.prisma.asset.create).not.toHaveBeenCalled();
      expect(mocks.getSignedUrl).not.toHaveBeenCalled();
    });

    it("rejects content-type/asset-type mismatches and oversized files", async () => {
      const mismatch = await initializeUpload(request("http://localhost/api/upload/init", { ...validBody, contentType: "video/mp4" }));
      const oversized = await initializeUpload(request("http://localhost/api/upload/init", { ...validBody, size: 50 * 1024 * 1024 + 1 }));

      expect(mismatch.status).toBe(400);
      expect(oversized.status).toBe(413);
      expect(mocks.prisma.asset.create).not.toHaveBeenCalled();
      expect(mocks.getSignedUrl).not.toHaveBeenCalled();
    });

    it("rejects batches outside the 1-100 item limit", async () => {
      const response = await initializeUpload(request("http://localhost/api/upload/init", {
        eventId: "event-1",
        files: Array.from({ length: 101 }, () => ({ filename: "p.jpg", contentType: "image/jpeg", size: 10, assetType: "image" })),
      }));

      expect(response.status).toBe(400);
      expect(mocks.prisma.asset.create).not.toHaveBeenCalled();
    });

    it("creates an approved owner asset and returns a short-lived signed URL", async () => {
      const response = await initializeUpload(request("http://localhost/api/upload/init", validBody));

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ uploadUrl: "https://signed.invalid/upload", assetId: "11111111-1111-4111-8111-111111111111" });
      expect(mocks.prisma.asset.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          id: validBody.clientUploadId,
          eventId: "event-1",
          storageKey: `events/event-1/approved/${validBody.clientUploadId}.jpg`,
          status: "uploading",
          moderationState: "approved",
          uploaderId: "owner-1",
        }),
      });
      expect(mocks.getSignedUrl).toHaveBeenCalledWith(expect.anything(), expect.anything(), { expiresIn: 300 });
    });
  });

  describe("event and admin APIs", () => {
    it("requires an admin session and validates event creation input", async () => {
      mocks.getServerSession.mockResolvedValueOnce(null);
      const unauthorized = await createEvent(request("http://localhost/api/events", { title: "A", passcode: "1234" }));
      const invalid = await createAdminEvent(request("http://localhost/api/admin/events/create", { name: "   ", passcode: "1234" }));

      expect(unauthorized.status).toBe(401);
      expect(invalid.status).toBe(400);
      expect(mocks.prisma.event.create).not.toHaveBeenCalled();
    });

    it("creates a protected event and keeps it when Rekognition setup fails", async () => {
      mocks.initializeEventCollection.mockRejectedValue(new Error("AWS unavailable"));

      const response = await createEvent(request("http://localhost/api/events", { title: "  Gala  ", passcode: " 1234 ", guestUploadPolicy: "allowed" }));

      expect(response.status).toBe(201);
      expect(mocks.encryptEventPasscode).toHaveBeenCalledWith(" 1234 ");
      expect(mocks.prisma.event.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ title: "  Gala  ", passcode: "encrypted-passcode", ownerId: "owner-1" }),
      });
      expect(mocks.initializeEventCollection).toHaveBeenCalledWith("event-1");
    });

    it("verifies a guest passcode and refuses invalid credentials", async () => {
      mocks.verifyEventPasscode.mockResolvedValueOnce(false);
      const denied = await verifyEvent(request("http://localhost/api/events/event-1/verify", { passcode: "wrong" }), { params: Promise.resolve({ eventId: "event-1" }) });
      const accepted = await verifyEvent(request("http://localhost/api/events/event-1/verify", { passcode: "right" }), { params: Promise.resolve({ eventId: "event-1" }) });

      expect(denied.status).toBe(401);
      expect(accepted.status).toBe(200);
      expect(await accepted.json()).toEqual({ success: true });
      expect(mocks.issueGuestSessionCookie).toHaveBeenCalledWith("event-1", 14400, "passcode-snapshot");
    });

    it("scopes the event list to the session owner and disables caching", async () => {
      mocks.prisma.event.findMany.mockResolvedValue([{ id: "event-1", title: "Test event" }]);

      const response = await listAdminEvents();

      expect(response.status).toBe(200);
      expect(response.headers.get("Cache-Control")).toContain("no-store");
      expect(mocks.prisma.event.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { ownerId: { in: ["owner-1"] } } }));
    });

    it("rejects unauthenticated event-list and stats requests", async () => {
      mocks.getServerSession.mockResolvedValueOnce(null);
      const listResponse = await listAdminEvents();
      const statsResponse = await getSidebarStats(new Request("http://localhost/api/admin/sidebar-stats"));

      expect(listResponse.status).toBe(401);
      expect(statsResponse.status).toBe(400);
      expect(mocks.prisma.event.findMany).not.toHaveBeenCalled();
    });

    it("returns owner-only sidebar aggregates", async () => {
      mocks.prisma.asset.count.mockResolvedValueOnce(8);
      mocks.prisma.person.count.mockResolvedValueOnce(3);
      mocks.prisma.faceDetection.count.mockResolvedValueOnce(2);

      const response = await getSidebarStats(new Request("http://localhost/api/admin/sidebar-stats?eventId=event-1"));

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ totalAssets: 8, totalPeople: 3, faceReviewCount: 2, guestUploadsCount: 0 });
    });

    it("updates only valid owner settings and requires an approved theme asset", async () => {
      const context = { params: Promise.resolve({ eventId: "event-1" }) };
      mocks.getEventAuthorization.mockResolvedValueOnce({ event, isOwner: false, isGuest: true });
      const denied = await updateEventSettings(methodRequest("http://localhost/api/events/event-1/settings", "PATCH", { title: "Changed" }), context);
      mocks.prisma.asset.findFirst.mockResolvedValue(null);
      const unapproved = await updateEventSettings(methodRequest("http://localhost/api/events/event-1/settings", "PATCH", { themeImageUrl: "events/other/file.jpg" }), context);
      const updated = await updateEventSettings(methodRequest("http://localhost/api/events/event-1/settings", "PATCH", { title: "  New title  " }), context);

      expect(denied.status).toBe(401);
      expect(unapproved.status).toBe(400);
      expect(updated.status).toBe(200);
      expect(mocks.prisma.event.update).toHaveBeenCalledWith({
        where: { id: "event-1" },
        data: { title: "New title" },
      });
    });

    it("logs only the first forwarded IP for an owner telemetry event", async () => {
      const response = await logAdminTelemetry(request("http://localhost/api/admin/log-telemetry", { eventId: "event-1" }, { "x-forwarded-for": "198.51.100.4, 10.1.1.1", "user-agent": "API test" }));

      expect(response.status).toBe(200);
      expect(mocks.prisma.accessLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ eventId: "event-1", action: "ADMIN_ACCESS", ipAddress: "198.51.100.4", userAgent: "API test" }),
      });
    });

    it("returns event stats only to the event owner", async () => {
      mocks.prisma.asset.count.mockResolvedValueOnce(9).mockResolvedValueOnce(7).mockResolvedValueOnce(2);
      mocks.prisma.person.count.mockResolvedValueOnce(1);
      const context = { params: Promise.resolve({ eventId: "event-1" }) };
      const response = await getEventStats(new Request("http://localhost/api/events/event-1/stats"), context);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ title: "Test event", totalAssets: 9, imageCount: 7, videoCount: 2, unnamedPeople: 1 });
    });
  });

  describe("upload lifecycle and media APIs", () => {
    const uploadContext = { params: Promise.resolve({ eventId: "event-1" }) };
    const ownerAsset = {
      id: "asset-1",
      eventId: "event-1",
      storageKey: "events/event-1/approved/photo.jpg",
      status: "processed",
      moderationState: "approved",
      assetType: "image",
      mimeType: "image/jpeg",
      uploaderId: "owner-1",
      event: { ownerId: "owner-1" },
    };

    it("keeps upload completion idempotent and avoids AWS for already processed assets", async () => {
      mocks.prisma.asset.findUnique.mockResolvedValue(ownerAsset);
      mocks.prisma.faceDetection.count.mockResolvedValue(2);

      const response = await completeUpload(request("http://localhost/api/upload/complete", { assetId: "asset-1" }));

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ success: true, detected: 2, moderated: false });
      expect(mocks.rekognitionSend).not.toHaveBeenCalled();
      expect(mocks.s3Send).not.toHaveBeenCalled();
    });

    it("returns 202 for an upload already being processed", async () => {
      mocks.prisma.asset.findUnique.mockResolvedValue({ ...ownerAsset, status: "processing" });

      const response = await completeUpload(request("http://localhost/api/upload/complete", { assetId: "asset-1" }));

      expect(response.status).toBe(202);
      expect(await response.json()).toEqual({ success: true, processing: true });
      expect(mocks.rekognitionSend).not.toHaveBeenCalled();
    });

    it("rejects upload completion for an unauthorized caller before AWS access", async () => {
      mocks.prisma.asset.findUnique.mockResolvedValue({ ...ownerAsset, status: "uploaded" });
      mocks.getEventAuthorization.mockResolvedValue({ event, isOwner: false, isGuest: false });

      const response = await completeUpload(request("http://localhost/api/upload/complete", { assetId: "asset-1" }));

      expect(response.status).toBe(401);
      expect(mocks.rekognitionSend).not.toHaveBeenCalled();
      expect(mocks.prisma.asset.updateMany).not.toHaveBeenCalled();
    });

    it("records upload failure only for an authorized owner", async () => {
      const deniedAsset = await reportUploadFailure(request("http://localhost/api/upload/fail", { assetId: "asset-1" }));
      mocks.prisma.asset.findUnique.mockResolvedValue(ownerAsset);
      mocks.getEventAuthorization.mockResolvedValue({ event, isOwner: false, isGuest: false });
      const deniedAuth = await reportUploadFailure(request("http://localhost/api/upload/fail", { assetId: "asset-1" }));
      mocks.getEventAuthorization.mockResolvedValue({ event, isOwner: true, isGuest: false });
      const accepted = await reportUploadFailure(request("http://localhost/api/upload/fail", { assetId: "asset-1" }));

      expect(deniedAsset.status).toBe(404);
      expect(deniedAuth.status).toBe(401);
      expect(accepted.status).toBe(200);
      expect(mocks.prisma.asset.updateMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ id: "asset-1" }),
        data: { status: "failed", errorMessage: "Client upload or processing failed." },
      }));
    });

    it("sanitizes filenames before creating a presigned download URL", async () => {
      mocks.prisma.asset.findFirst.mockResolvedValue(ownerAsset);

      const response = await getDownloadUrl(new Request("http://localhost/api/upload/download-url?key=events%2Fevent-1%2Fapproved%2Fphoto.jpg&filename=bad%22name%0D%0A.jpg"));

      expect(response.status).toBe(200);
      expect(response.headers.get("Cache-Control")).toContain("no-store");
      expect(mocks.getSignedUrl).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ input: expect.objectContaining({ ResponseContentDisposition: 'attachment; filename="bad_name__.jpg"' }) }),
        { expiresIn: 60 },
      );
    });

    it("does not reveal a download URL to a guest without personal access", async () => {
      mocks.prisma.asset.findFirst.mockResolvedValue(ownerAsset);
      mocks.getEventAuthorization.mockResolvedValue({ event: { ...event, publicGallery: false }, isOwner: false, isGuest: true });
      mocks.guestCanAccessAsset.mockResolvedValue(false);

      const response = await getDownloadUrl(new Request("http://localhost/api/upload/download-url?key=events%2Fevent-1%2Fapproved%2Fphoto.jpg"));

      expect(response.status).toBe(401);
      expect(mocks.getSignedUrl).not.toHaveBeenCalled();
    });

    it("validates media transformation parameters before reading from S3", async () => {
      mocks.prisma.asset.findFirst.mockResolvedValue(ownerAsset);
      mocks.getServerSession.mockResolvedValue({ user: { id: "owner-1" } });

      const badWidth = await viewUpload(new Request("http://localhost/api/upload/view?key=events%2Fevent-1%2Fapproved%2Fphoto.jpg&w=4097"));
      const badFormat = await viewUpload(new Request("http://localhost/api/upload/view?key=events%2Fevent-1%2Fapproved%2Fphoto.jpg&format=svg"));
      const badQuality = await viewUpload(new Request("http://localhost/api/upload/view?key=events%2Fevent-1%2Fapproved%2Fphoto.jpg&q=101"));

      expect(badWidth.status).toBe(400);
      expect(badFormat.status).toBe(400);
      expect(badQuality.status).toBe(400);
      expect(mocks.s3Send).not.toHaveBeenCalled();
    });

    it("refuses video objects from the image-view endpoint", async () => {
      mocks.prisma.asset.findFirst.mockResolvedValue({ ...ownerAsset, assetType: "video", mimeType: "video/mp4" });
      mocks.getServerSession.mockResolvedValue({ user: { id: "owner-1" } });

      const response = await viewUpload(new Request("http://localhost/api/upload/view?key=events%2Fevent-1%2Fapproved%2Fclip.mp4"));

      expect(response.status).toBe(415);
      expect(mocks.s3Send).not.toHaveBeenCalled();
    });

    it("blocks guest galleries when the event is not public", async () => {
      mocks.getEventAuthorization.mockResolvedValue({ event: { ...event, publicGallery: false }, isOwner: false, isGuest: true });

      const response = await listEventAssets(new Request("http://localhost/api/events/event-1/assets"), uploadContext);

      expect(response.status).toBe(403);
      expect(mocks.prisma.asset.findMany).not.toHaveBeenCalled();
      expect(mocks.getSignedUrl).not.toHaveBeenCalled();
    });

    it("limits guest gallery queries to approved processed assets", async () => {
      const guestEvent = { ...event, publicGallery: true };
      mocks.getEventAuthorization.mockResolvedValue({ event: guestEvent, isOwner: false, isGuest: true });
      mocks.prisma.person.findMany.mockResolvedValue([]);
      mocks.prisma.asset.findMany.mockResolvedValue([ownerAsset]);
      mocks.getSignedUrl.mockResolvedValue("https://signed.invalid/photo");

      const response = await listEventAssets(new Request("http://localhost/api/events/event-1/assets"), uploadContext);

      expect(response.status).toBe(200);
      expect(mocks.prisma.asset.findMany).toHaveBeenCalledWith({
        where: { eventId: "event-1", moderationState: "approved", status: "processed" },
        orderBy: { createdAt: "desc" },
      });
      expect((await response.json())[0].url).toBe("https://signed.invalid/photo");
      expect(response.headers.get("Cache-Control")).toContain("no-store");
    });

    it("returns only approved processed keys from the approved-assets endpoint", async () => {
      mocks.prisma.asset.findMany.mockResolvedValue([{ id: "asset-1", storageKey: "approved.jpg" }]);

      const response = await listApprovedAssets(new Request("http://localhost/api/events/event-1/assets/approved"), uploadContext);

      expect(response.status).toBe(200);
      expect(mocks.prisma.asset.findMany).toHaveBeenCalledWith({
        where: { eventId: "event-1", moderationState: "approved", status: "processed" },
        select: { id: true, storageKey: true },
      });
    });
  });

  describe("moderation, identity, and biometric APIs", () => {
    const eventContext = { params: Promise.resolve({ eventId: "event-1" }) };
    const asset = {
      id: "asset-1",
      eventId: "event-1",
      storageKey: "events/event-1/pending/photo.jpg",
      status: "processed",
      moderationState: "pending",
      assetType: "image",
      mimeType: "image/jpeg",
      uploaderId: "guest-1",
      awsJobId: "job-1",
    };

    it("refuses unsupported moderation actions without changing the asset", async () => {
      mocks.prisma.asset.findUnique.mockResolvedValue(asset);

      const response = await moderateUpload(request("http://localhost/api/admin/moderate-upload", { assetId: "asset-1", action: "publish" }));

      expect(response.status).toBe(400);
      expect(mocks.prisma.asset.updateMany).not.toHaveBeenCalled();
      expect(mocks.s3Send).not.toHaveBeenCalled();
    });

    it("approves by moving the object before committing database visibility", async () => {
      vi.stubEnv("AWS_S3_BUCKET", "media-test-bucket");
      mocks.prisma.asset.findUnique.mockResolvedValue(asset);

      const response = await moderateUpload(request("http://localhost/api/admin/moderate-upload", { assetId: "asset-1", action: "approve" }));

      expect(response.status).toBe(200);
      expect(mocks.s3Send).toHaveBeenCalledTimes(2);
      expect(mocks.s3Send.mock.calls[0][0].input).toEqual(expect.objectContaining({
        Bucket: "media-test-bucket",
        CopySource: "media-test-bucket/events/event-1/pending/photo.jpg",
        Key: "events/event-1/approved/photo.jpg",
      }));
      expect(mocks.s3Send.mock.calls[1][0].input).toEqual(expect.objectContaining({ Key: asset.storageKey }));
      expect(mocks.prisma.asset.updateMany).toHaveBeenNthCalledWith(2, expect.objectContaining({
        data: { storageKey: "events/event-1/approved/photo.jpg", status: "processed", moderationState: "approved" },
      }));
    });

    it("restores the processed status if S3 approval migration fails", async () => {
      mocks.prisma.asset.findUnique.mockResolvedValue(asset);
      mocks.s3Send.mockRejectedValueOnce(new Error("S3 unavailable"));

      const response = await moderateUpload(request("http://localhost/api/admin/moderate-upload", { assetId: "asset-1", action: "approve" }));

      expect(response.status).toBe(500);
      expect(mocks.prisma.asset.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({
        data: { status: "processed", errorMessage: "Approval migration failed." },
      }));
    });

    it("does not delete an asset while processing is active", async () => {
      mocks.prisma.asset.findUnique.mockResolvedValue({ ...asset, status: "processing" });

      const response = await deleteEventAsset(new Request("http://localhost/api/events/event-1/assets/asset-1", { method: "DELETE" }), {
        params: Promise.resolve({ eventId: "event-1", assetId: "asset-1" }),
      });

      expect(response.status).toBe(409);
      expect(mocks.s3Send).not.toHaveBeenCalled();
      expect(mocks.deleteEventFacesForImage).not.toHaveBeenCalled();
    });

    it("authorizes people listing and orphan purge to owners only", async () => {
      mocks.getEventAuthorization.mockResolvedValueOnce({ event, isOwner: false, isGuest: true });
      const deniedList = await listEventPeople(new Request("http://localhost/api/events/event-1/people"), eventContext);
      mocks.getEventAuthorization.mockResolvedValueOnce({ event, isOwner: false, isGuest: true });
      const deniedPurge = await purgeEventPeople(request("http://localhost/api/events/event-1/people/purge", {}), eventContext);
      mocks.getEventAuthorization.mockResolvedValue({ event, isOwner: true, isGuest: false });
      mocks.prisma.person.deleteMany.mockResolvedValue({ count: 2 });
      const acceptedPurge = await purgeEventPeople(request("http://localhost/api/events/event-1/people/purge", {}), eventContext);

      expect(deniedList.status).toBe(401);
      expect(deniedPurge.status).toBe(401);
      expect(acceptedPurge.status).toBe(200);
      expect(await acceptedPurge.json()).toMatchObject({ success: true, count: 2 });
      expect(mocks.prisma.person.deleteMany).toHaveBeenCalledWith({ where: { eventId: "event-1", faceDetections: { none: {} } } });
    });

    it("rejects blank identity names and trims accepted names", async () => {
      mocks.prisma.person.findUnique.mockResolvedValue({ eventId: "event-1" });
      mocks.prisma.person.findFirst.mockResolvedValue(null);
      mocks.prisma.person.update.mockResolvedValue({ id: "person-1", name: "Alex", status: "named" });
      const personContext = { params: Promise.resolve({ personId: "person-1" }) };

      const invalid = await updatePerson(request("http://localhost/api/people/person-1", { name: "   " }), personContext);
      const updated = await updatePerson(request("http://localhost/api/people/person-1", { name: " Alex " }), personContext);

      expect(invalid.status).toBe(400);
      expect(updated.status).toBe(200);
      expect(mocks.prisma.person.update).toHaveBeenCalledWith({
        where: { id: "person-1" },
        data: { name: "Alex", status: "named" },
      });
    });

    it("creates a liveness session only for event-authorized users", async () => {
      mocks.getEventAuthorization.mockResolvedValueOnce({ event, isOwner: false, isGuest: false });
      const denied = await createLivenessSession(new Request("http://localhost/api/events/event-1/liveness/create", { method: "POST" }), eventContext);
      const accepted = await createLivenessSession(new Request("http://localhost/api/events/event-1/liveness/create", { method: "POST" }), eventContext);

      expect(denied.status).toBe(401);
      expect(accepted.status).toBe(200);
      expect(await accepted.json()).toEqual({ sessionId: "liveness-session" });
      expect(mocks.rekognitionSend).toHaveBeenCalledTimes(1);
    });

    it("blocks failed liveness before searching faces and writes an audit event", async () => {
      mocks.getEventAuthorization.mockResolvedValue({ event, isOwner: false, isGuest: true });
      mocks.rekognitionSend.mockResolvedValueOnce({ Status: "FAILED", Confidence: 99 });

      const response = await findMe(request("http://localhost/api/events/event-1/find-me", { sessionId: "session-1" }, { "x-forwarded-for": "198.51.100.8, 10.0.0.2" }), eventContext);

      expect(response.status).toBe(403);
      expect(mocks.rekognitionSend).toHaveBeenCalledTimes(1);
      expect(mocks.prisma.accessLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ action: "SPOOF_ATTEMPT_BLOCKED", ipAddress: "198.51.100.8" }),
      });
    });

    it("rejects liveness requests missing a session id before contacting Rekognition", async () => {
      const response = await findMe(request("http://localhost/api/events/event-1/find-me", {}), eventContext);

      expect(response.status).toBe(400);
      expect(mocks.rekognitionSend).not.toHaveBeenCalled();
    });

    it("finds the verified identity and issues a guest-person session", async () => {
      mocks.getEventAuthorization.mockResolvedValue({ event, isOwner: false, isGuest: true });
      mocks.rekognitionSend
        .mockResolvedValueOnce({ Status: "SUCCEEDED", Confidence: 99, ReferenceImage: { Bytes: new Uint8Array([1, 2, 3]) } })
        .mockResolvedValueOnce({ FaceMatches: [{ Face: { FaceId: "face-1" } }] });
      mocks.prisma.faceDetection.findFirst.mockResolvedValue({ personId: "person-1", person: { name: "Alex" } });
      mocks.prisma.asset.findMany.mockResolvedValue([{ id: "asset-1" }]);

      const response = await findMe(request("http://localhost/api/events/event-1/find-me", { sessionId: "session-1" }), eventContext);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ personName: "Alex", personId: "person-1", photos: [{ id: "asset-1" }] });
      expect(mocks.issueGuestPersonCookie).toHaveBeenCalledWith("event-1", "person-1", undefined, event.passcode);
      expect(mocks.rekognitionSend).toHaveBeenCalledTimes(2);
    });

    it("confines face-review lookups to the requested event and rejects unknown actions", async () => {
      mocks.prisma.faceDetection.findFirst.mockResolvedValue({ id: "detection-1", personId: "person-1", faceId: "face-1" });

      const response = await reviewDetection(request("http://localhost/api/events/event-1/review/detection-1", { action: "unknown" }), {
        params: Promise.resolve({ eventId: "event-1", detectionId: "detection-1" }),
      });

      expect(response.status).toBe(400);
      expect(mocks.prisma.faceDetection.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "detection-1", asset: { eventId: "event-1" } } }));
      expect(mocks.deleteEventFaceIds).not.toHaveBeenCalled();
    });
  });

  describe("archive download APIs", () => {
    const context = { params: Promise.resolve({ eventId: "event-1" }) };

    it("requires a guest-person session and event-matching identity for guest archives", async () => {
      const missingIdentity = await downloadGuestArchive(new NextRequest("http://localhost/api/events/event-1/download-all"), context);
      const mismatchedIdentity = await downloadGuestArchive(new NextRequest("http://localhost/api/events/event-1/download-all?personId=other-person"), context);
      mocks.prisma.person.findUnique.mockResolvedValue({ id: "guest-1", eventId: "other-event", faceDetections: [] });
      const crossEventIdentity = await downloadGuestArchive(new NextRequest("http://localhost/api/events/event-1/download-all?personId=guest-1"), context);

      expect(missingIdentity.status).toBe(401);
      expect(mismatchedIdentity.status).toBe(401);
      expect(crossEventIdentity.status).toBe(400);
      expect(mocks.s3Send).not.toHaveBeenCalled();
    });

    it("limits admin archives to owners and returns an empty-vault response", async () => {
      mocks.getEventAuthorization.mockResolvedValueOnce({ event, isOwner: false, isGuest: true });
      const denied = await downloadAdminArchive(new NextRequest("http://localhost/api/events/event-1/download-all-admin"), context);
      mocks.prisma.asset.findMany.mockResolvedValue([]);
      const empty = await downloadAdminArchive(new NextRequest("http://localhost/api/events/event-1/download-all-admin"), context);

      expect(denied.status).toBe(401);
      expect(empty.status).toBe(404);
      expect(mocks.s3Send).not.toHaveBeenCalled();
    });

    it("streams an admin archive from mocked S3 objects", async () => {
      mocks.prisma.asset.findMany.mockResolvedValue([{ storageKey: "events/event-1/approved/photo.jpg", sourceFilename: "photo.jpg" }]);
      mocks.s3Send.mockResolvedValue({ Body: Readable.from([Buffer.from("image bytes")]) });

      const response = await downloadAdminArchive(new NextRequest("http://localhost/api/events/event-1/download-all-admin"), context);
      const archive = Buffer.from(await response.arrayBuffer());

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("application/zip");
      expect(response.headers.get("Content-Disposition")).toContain("Vault_Master_Archive_event-1.zip");
      expect(archive.subarray(0, 2).toString()).toBe("PK");
      expect(mocks.s3Send).toHaveBeenCalledTimes(1);
    });

    it("streams a guest archive only from that guest's event assets", async () => {
      mocks.prisma.person.findUnique.mockResolvedValue({
        id: "guest-1",
        eventId: "event-1",
        name: "Alex Guest",
        event: { title: "Test Event" },
        faceDetections: [{ asset: { storageKey: "events/event-1/approved/photo.jpg", sourceFilename: "photo.jpg" } }],
      });
      mocks.s3Send.mockResolvedValue({ Body: Readable.from([Buffer.from("image bytes")]) });

      const response = await downloadGuestArchive(new NextRequest("http://localhost/api/events/event-1/download-all?personId=guest-1"), context);
      const archive = Buffer.from(await response.arrayBuffer());

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("application/zip");
      expect(response.headers.get("Content-Disposition")).toContain("Test_Event-Alex_Guest.zip");
      expect(archive.subarray(0, 2).toString()).toBe("PK");
      expect(mocks.s3Send).toHaveBeenCalledTimes(1);
    });

    it("returns transformed image bytes and private cache headers", async () => {
      const imageBytes = await sharp({
        create: { width: 2, height: 2, channels: 3, background: { r: 80, g: 120, b: 160 } },
      }).png().toBuffer();
      mocks.prisma.asset.findFirst.mockResolvedValue({
        id: "asset-1",
        eventId: "event-1",
        status: "processed",
        moderationState: "approved",
        assetType: "image",
        mimeType: "image/png",
        event: { ownerId: "owner-1" },
      });
      mocks.s3Send.mockResolvedValue({ Body: { transformToByteArray: async () => new Uint8Array(imageBytes) } });

      const response = await viewUpload(new Request("http://localhost/api/upload/view?key=events%2Fevent-1%2Fapproved%2Fphoto.jpg&w=1&format=webp&q=72"));

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("image/webp");
      expect(response.headers.get("Cache-Control")).toContain("no-store");
      expect(response.headers.get("Vary")).toBe("Cookie");
      expect(new Uint8Array(await response.arrayBuffer()).byteLength).toBeGreaterThan(0);
      expect(mocks.s3Send).toHaveBeenCalledTimes(1);
    });
  });
});
