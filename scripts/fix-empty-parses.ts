import "dotenv/config";

import { prisma } from "../src/lib/prisma";
import { readResumeFile } from "../src/lib/storage/resume-storage";

/**
 * One-off repair: finds resumes whose raw text is missing (their initial
 * extraction failed), re-extracts text from the stored file, re-parses,
 * and saves the result.
 */
async function main() {
  const resumes = await prisma.resume.findMany({
    where: { OR: [{ rawText: null }, { rawText: "" }] },
    select: { id: true, userId: true, originalFileName: true, originalFileUrl: true },
  });

  console.log(`Found ${resumes.length} resume(s) with missing raw text.`);

  const { extractTextFromResume } = await import(
    "../src/services/resumes/parsers/text-extractor"
  );
  const { parseResumeBuffer, saveParsedResumeData } = await import(
    "../src/services/resumes/parse-resume.service"
  );
  void extractTextFromResume;

  for (const resume of resumes) {
    if (!resume.originalFileUrl) {
      console.log(`- ${resume.id}: no stored file, skipping.`);
      continue;
    }

    try {
      const buffer = await readResumeFile(resume.originalFileUrl);
      const { parsedData, rawText } = await parseResumeBuffer({
        buffer,
        fileName: resume.originalFileName,
      });

      if (!rawText.trim()) {
        console.log(`- ${resume.id}: extraction still empty, skipping.`);
        continue;
      }

      await saveParsedResumeData(resume.id, resume.userId, parsedData, rawText);
      console.log(
        `- ${resume.id} (${resume.originalFileName}): fixed — name=${parsedData.name}, skills=${parsedData.skills.length}, exp=${parsedData.experience.length}, projects=${parsedData.projects.length}, edu=${parsedData.education.length}`
      );
    } catch (error) {
      console.error(`- ${resume.id}: FAILED`, error);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
