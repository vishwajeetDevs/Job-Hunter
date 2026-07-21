import "dotenv/config";

import {
  deleteResumeFile,
  readResumeFile,
  saveResumeFile,
} from "../src/lib/storage/resume-storage";

async function main() {
  const key = "resumes/_test/connection-check.txt";
  const payload = Buffer.from(`R2 connection test at ${new Date().toISOString()}`);

  console.log("Uploading test object...");
  await saveResumeFile(key, payload);

  console.log("Reading it back...");
  const readBack = await readResumeFile(key);

  if (!readBack.equals(payload)) {
    throw new Error("Read-back content does not match uploaded content.");
  }

  console.log("Deleting test object...");
  await deleteResumeFile(key);

  console.log("SUCCESS: R2 upload, download, and delete all work.");
}

main().catch((error) => {
  console.error("R2 test FAILED:", error);
  process.exit(1);
});
