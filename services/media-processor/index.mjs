import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { 
  RekognitionClient, 
  IndexFacesCommand, 
  SearchFacesCommand,
  DescribeCollectionCommand,
  CreateCollectionCommand 
} from "@aws-sdk/client-rekognition";
import sharp from "sharp";

const s3Client = new S3Client({ region: process.env.AWS_REGION });
const rekognitionClient = new RekognitionClient({ region: process.env.AWS_REGION });

export const handler = async (event) => {
  for (const record of event.Records) {
    const bucket = record.s3.bucket.name;
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));

    // Key format expected: events/{eventId}/pending/{assetId}.{ext}
    // or: events/{eventId}/approved/{assetId}.{ext}
    const parts = key.split("/");
    if (parts.length < 4 || !key.includes("/raw/")) {
      console.log(`Skipping non-raw object: ${key}`);
      continue;
    }

    const eventId = parts[1];
    const assetIdWithExt = parts[parts.length - 1];
    const assetId = assetIdWithExt.split(".")[0];
    const collectionId = `event-${eventId}`;

    try {
      // 1. Download raw image from S3
      const getObj = await s3Client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      const inputBuffer = Buffer.from(await getObj.Body.transformToByteArray());

      // 2. High-speed normalization & WebP compression using Sharp
      const metadata = await sharp(inputBuffer).metadata();
      const isImage = !!metadata.format;

      if (!isImage) {
        console.log(`Skipping non-image asset ${key}`);
        continue;
      }

      // Generate standardized display WebP (max width 2048px, quality 82)
      const webpBuffer = await sharp(inputBuffer)
        .rotate() // Auto-orient via EXIF
        .resize({ width: 2048, withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer();

      // Output key for processed webp
      const processedKey = key.replace("/raw/", "/processed/").replace(/\.[^.]+$/, ".webp");
      await s3Client.send(new PutObjectCommand({
        Bucket: bucket,
        Key: processedKey,
        Body: webpBuffer,
        ContentType: "image/webp",
        CacheControl: "public, max-age=31536000, immutable"
      }));

      // 3. Prepare JPEG buffer for Rekognition (Rekognition does not accept WebP)
      const rekognitionJpeg = await sharp(inputBuffer)
        .rotate()
        .resize({ width: 1600, withoutEnlargement: true })
        .jpeg({ quality: 90 })
        .toBuffer();

      // 4. Ensure Rekognition Collection exists
      try {
        await rekognitionClient.send(new DescribeCollectionCommand({ CollectionId: collectionId }));
      } catch (err) {
        if (err.name === "ResourceNotFoundException") {
          try {
            await rekognitionClient.send(new CreateCollectionCommand({ CollectionId: collectionId }));
          } catch (createErr) {
            if (createErr.name !== "ResourceAlreadyExistsException") throw createErr;
          }
        } else {
          throw err;
        }
      }

      // 5. Index Faces
      const indexRes = await rekognitionClient.send(new IndexFacesCommand({
        CollectionId: collectionId,
        Image: { Bytes: rekognitionJpeg },
        ExternalImageId: assetId,
        DetectionAttributes: ["ALL"]
      }));

      const faceRecords = indexRes.FaceRecords || [];
      const matchResults = [];

      // 6. Match faces within collection
      for (const faceRecord of faceRecords) {
        const faceId = faceRecord.Face?.FaceId;
        if (!faceId) continue;

        const searchRes = await rekognitionClient.send(new SearchFacesCommand({
          CollectionId: collectionId,
          FaceId: faceId,
          FaceMatchThreshold: 90,
          MaxFaces: 5
        }));

        const matchedIds = (searchRes.FaceMatches || [])
          .filter(m => m.Face?.FaceId !== faceId)
          .map(m => m.Face?.FaceId)
          .filter(Boolean);

        matchResults.push({
          faceId,
          confidence: faceRecord.Face?.Confidence || 0,
          boundingBox: faceRecord.Face?.BoundingBox || {},
          matchedFaceIds: matchedIds
        });
      }

      // 7. Notify your Next.js application backend to persist DB records
      const webhookUrl = `${process.env.APP_URL}/api/internal/process-complete`;
      const secret = process.env.INTERNAL_WEBHOOK_SECRET;

      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-secret": secret
        },
        body: JSON.stringify({
          assetId,
          eventId,
          originalKey: key,
          processedKey,
          faceRecords: matchResults
        })
      });

      if (!response.ok) {
        throw new Error(`Webhook notification failed with status: ${response.status}`);
      }

      console.log(`Successfully processed asset ${assetId}`);
    } catch (err) {
      console.error(`Failed processing asset ${assetId}:`, err);
      throw err;
    }
  }
};