import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { deleteEventFaceIds } from "@/lib/rekognition";

export const runtime = "nodejs";

type FaceRecordInput = {
  faceId: string;
  confidence: number;
  boundingBox: Record<string, number>;
  matchedFaceIds: string[];
};

type CompletionInput = {
  assetId: string;
  eventId: string;
  originalKey: string;
  processedKey: string;
  faceRecords: FaceRecordInput[];
};

function isAuthorized(request: Request) {
  const expected = process.env.INTERNAL_WEBHOOK_SECRET;
  const received = request.headers.get("x-internal-secret");
  if (!expected || !received) return false;
  const expectedBytes = Buffer.from(expected);
  const receivedBytes = Buffer.from(received);
  return expectedBytes.length === receivedBytes.length && timingSafeEqual(expectedBytes, receivedBytes);
}

function isFaceRecord(value: unknown): value is FaceRecordInput {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  const box = record.boundingBox;
  return typeof record.faceId === "string" &&
    record.faceId.length > 0 &&
    typeof record.confidence === "number" &&
    Number.isFinite(record.confidence) &&
    !!box && typeof box === "object" && !Array.isArray(box) &&
    Object.values(box).every((part) => typeof part === "number" && Number.isFinite(part)) &&
    Array.isArray(record.matchedFaceIds) &&
    record.matchedFaceIds.length <= 5 &&
    record.matchedFaceIds.every((faceId) => typeof faceId === "string" && faceId.length > 0);
}

function isValidKeys(input: CompletionInput) {
  const rawPrefix = `events/${input.eventId}/`;
  if (!input.originalKey.startsWith(rawPrefix) || !input.originalKey.includes("/raw/")) return false;
  const expectedProcessedKey = input.originalKey
    .replace("/raw/", "/processed/")
    .replace(/\.[^/.]+$/, ".webp");
  return input.processedKey === expectedProcessedKey || input.processedKey === input.originalKey;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid completion payload." }, { status: 400 });
  }

  const input = body as Partial<CompletionInput>;
  if (
    typeof input.assetId !== "string" || !input.assetId ||
    typeof input.eventId !== "string" || !input.eventId ||
    typeof input.originalKey !== "string" ||
    typeof input.processedKey !== "string" ||
    !Array.isArray(input.faceRecords) ||
    input.faceRecords.length > 100 ||
    !input.faceRecords.every(isFaceRecord)
  ) {
    return NextResponse.json({ error: "Invalid completion payload." }, { status: 400 });
  }

  const completion = input as CompletionInput;
  if (!isValidKeys(completion)) {
    return NextResponse.json({ error: "Invalid object keys." }, { status: 400 });
  }

  try {
    const asset = await prisma.asset.findUnique({
      where: { id: completion.assetId },
      select: {
        id: true,
        eventId: true,
        storageKey: true,
        status: true,
        moderationState: true,
      },
    });
    if (!asset || asset.eventId !== completion.eventId) {
      return NextResponse.json({ error: "Asset not found." }, { status: 404 });
    }

    const faceIds = completion.faceRecords.map((record) => record.faceId);
    if (asset.status === "processed" && asset.storageKey === completion.processedKey) {
      const savedFaces = faceIds.length > 0
        ? await prisma.faceDetection.findMany({
            where: { assetId: asset.id, faceId: { in: faceIds } },
            select: { faceId: true },
          })
        : [];
      const savedIds = new Set(savedFaces.map((face) => face.faceId));
      const duplicateIds = faceIds.filter((faceId) => !savedIds.has(faceId));
      if (duplicateIds.length > 0) await deleteEventFaceIds(asset.eventId, duplicateIds);
      return NextResponse.json({ success: true, duplicate: true });
    }
    if (asset.storageKey !== completion.originalKey) {
      return NextResponse.json({ error: "Asset storage key does not match." }, { status: 409 });
    }

    await prisma.$transaction(async (tx) => {
      const claim = await tx.asset.updateMany({
        where: {
          id: asset.id,
          eventId: asset.eventId,
          storageKey: completion.originalKey,
          status: { in: ["uploading", "uploaded"] },
        },
        data: { status: "processing" },
      });
      if (claim.count === 0) {
        throw new Error("Asset is already being processed or is no longer available.");
      }

      for (const record of completion.faceRecords) {
        let personId: string | null = null;
        if (record.matchedFaceIds.length > 0) {
          const existingPerson = await tx.faceDetection.findFirst({
            where: {
              faceId: { in: record.matchedFaceIds },
              asset: { eventId: asset.eventId },
            },
            orderBy: { createdAt: "asc" },
            select: { personId: true },
          });
          personId = existingPerson?.personId ?? null;
        }

        if (!personId) {
          const newPerson = await tx.person.create({
            data: { eventId: asset.eventId, status: "unnamed" },
            select: { id: true },
          });
          personId = newPerson.id;
        }

        await tx.faceDetection.upsert({
          where: { faceId: record.faceId },
          update: { assetId: asset.id, personId },
          create: {
            id: record.faceId,
            faceId: record.faceId,
            assetId: asset.id,
            personId,
            confidence: record.confidence,
            boundingBox: record.boundingBox as Prisma.InputJsonValue,
          },
        });
        await tx.faceSample.upsert({
          where: { personId_faceDetectionId: { personId, faceDetectionId: record.faceId } },
          update: {},
          create: { personId, faceDetectionId: record.faceId, isReference: true },
        });
      }

      const highConfidenceFaces = completion.faceRecords.filter((record) => record.confidence > 90);
      if (highConfidenceFaces.length >= 3) {
        await tx.event.updateMany({
          where: { id: asset.eventId, themeImageUrl: null },
          data: { themeImageUrl: completion.processedKey },
        });
      }

      await tx.asset.update({
        where: { id: asset.id },
        data: {
          storageKey: completion.processedKey,
          status: "processed",
          jobCompletedAt: new Date(),
          errorMessage: null,
        },
      });
    });

    return NextResponse.json({ success: true, detected: completion.faceRecords.length });
  } catch (error) {
    console.error("[LAMBDA_WEBHOOK_ERROR]:", error);
    return NextResponse.json({ error: "Failed to persist media processing results." }, { status: 500 });
  }
}
