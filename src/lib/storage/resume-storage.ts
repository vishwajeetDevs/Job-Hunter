import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

/**
 * Resume file storage.
 *
 * Uses Cloudflare R2 (S3-compatible) when the R2_* environment variables are
 * set; otherwise falls back to the local `storage/` folder for development.
 * The storage key format is identical for both backends, so existing database
 * records keep working when switching.
 */

const STORAGE_ROOT = path.join(process.cwd(), "storage");

const R2_BUCKET = process.env.R2_BUCKET;

function isR2Configured(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      R2_BUCKET
  );
}

let r2Client: S3Client | null = null;

function getR2Client(): S3Client {
  if (!r2Client) {
    r2Client = new S3Client({
      region: "auto",
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });
  }
  return r2Client;
}

export function getResumeStorageKey(
  userId: string,
  resumeId: string,
  extension: string
): string {
  return path.posix.join("resumes", userId, `${resumeId}${extension}`);
}

function getLocalAbsolutePath(storageKey: string): string {
  return path.join(STORAGE_ROOT, storageKey);
}

export async function saveResumeFile(
  storageKey: string,
  buffer: Buffer
): Promise<void> {
  if (isR2Configured()) {
    await getR2Client().send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: storageKey,
        Body: buffer,
      })
    );
    return;
  }

  const absolutePath = getLocalAbsolutePath(storageKey);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, buffer);
}

export async function readResumeFile(storageKey: string): Promise<Buffer> {
  if (isR2Configured()) {
    const response = await getR2Client().send(
      new GetObjectCommand({ Bucket: R2_BUCKET, Key: storageKey })
    );
    if (!response.Body) {
      throw new Error(`Resume file not found in R2: ${storageKey}`);
    }
    return Buffer.from(await response.Body.transformToByteArray());
  }

  return readFile(getLocalAbsolutePath(storageKey));
}

export async function deleteResumeFile(storageKey: string): Promise<void> {
  if (isR2Configured()) {
    await getR2Client()
      .send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: storageKey }))
      .catch(() => {
        // Object may already be removed; ignore.
      });
    return;
  }

  await unlink(getLocalAbsolutePath(storageKey)).catch(() => {
    // File may already be removed; ignore ENOENT.
  });
}
