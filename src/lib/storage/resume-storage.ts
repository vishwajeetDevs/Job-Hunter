import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

const STORAGE_ROOT = path.join(process.cwd(), "storage");

export function getResumeStorageKey(
  userId: string,
  resumeId: string,
  extension: string
): string {
  return path.posix.join("resumes", userId, `${resumeId}${extension}`);
}

export function getResumeAbsolutePath(storageKey: string): string {
  return path.join(STORAGE_ROOT, storageKey);
}

export async function saveResumeFile(
  storageKey: string,
  buffer: Buffer
): Promise<void> {
  const absolutePath = getResumeAbsolutePath(storageKey);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, buffer);
}

export async function deleteResumeFile(storageKey: string): Promise<void> {
  const absolutePath = getResumeAbsolutePath(storageKey);
  await unlink(absolutePath).catch(() => {
    // File may already be removed; ignore ENOENT.
  });
}
