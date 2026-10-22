import { S3Client } from "@aws-sdk/client-s3";
import { RekognitionClient } from "@aws-sdk/client-rekognition";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import { Agent } from "node:https";

const requestHandler = new NodeHttpHandler({
  httpsAgent: new Agent({ keepAlive: true, maxSockets: 50 }),
});

export const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  requestHandler,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export const rekognitionClient = new RekognitionClient({
  region: process.env.AWS_REGION,
  requestHandler,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});