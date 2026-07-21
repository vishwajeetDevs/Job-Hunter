/**
 * End-to-end test of the resume parsing pipeline (no DB writes):
 *
 *   file → text extraction → parser (AI + heuristic) → completeness
 *   validation → normalization roundtrip → backward compatibility.
 *
 * Usage:
 *   npx tsx scripts/test-resume-pipeline.ts [path-to-resume.pdf|.docx]
 *
 * A real resume file is used only as a fixture; every assertion below
 * is generic (structure preservation, no hallucination, roundtrips).
 */
import "dotenv/config";
import { readFile } from "node:fs/promises";

import { aiResumeParser } from "../src/services/resumes/parsers/ai-parser";
import { heuristicResumeParser } from "../src/services/resumes/parsers/heuristic-parser";
import {
  findMissingSections,
  preserveMissingSections,
} from "../src/services/resumes/parsers/completeness";
import { detectSourceSections } from "../src/services/resumes/parsers/sections";
import { extractTextFromResume } from "../src/services/resumes/parsers/text-extractor";
import {
  normalizeParsedResumeData,
  type ParsedResumeData,
} from "../src/services/resumes/parsers/types";

let failures = 0;

function check(condition: boolean, label: string) {
  if (condition) {
    console.log(`  PASS  ${label}`);
  } else {
    console.error(`  FAIL  ${label}`);
    failures += 1;
  }
}

function summarize(data: ParsedResumeData): string {
  const custom = data.additionalSections
    .map((section) => `"${section.title}"(${section.items.length})`)
    .join(", ");
  return [
    `name=${data.name}`,
    `email=${data.email}`,
    `phone=${data.phone}`,
    `location=${data.location}`,
    `links=${data.links.length}`,
    `summary=${data.summary ? `${data.summary.length} chars` : "null"}`,
    `skills=${data.skills.length}`,
    `skillGroups=${data.skillGroups.length}`,
    `experience=${data.experience.length}`,
    `projects=${data.projects.length}`,
    `education=${data.education.length}`,
    `certifications=${data.certifications.length}`,
    `achievements=${data.achievements.length}`,
    `languages=${data.languages.length}`,
    `interests=${data.interests.length}`,
    `additionalSections=[${custom}]`,
    `unmapped=[${(data.meta.unmappedSections ?? []).join(", ")}]`,
  ].join("\n  ");
}

// ---------------------------------------------------------------------------
// Synthetic fixtures — generic resume shapes, not tied to any candidate
// ---------------------------------------------------------------------------

const RESUME_WITH_CUSTOM_SECTIONS = `
Alex Morgan
alex.morgan@example.com | +1 555 010 2030 | Austin, TX
https://github.com/alexmorgan | https://linkedin.com/in/alexmorgan

PROFESSIONAL SUMMARY
Product-minded engineer with 6 years of experience shipping web platforms.

TECHNICAL EXPERTISE
Languages: TypeScript, Python, Go
Frameworks: React, Django

CAREER JOURNEY
Senior Software Engineer | Initech LLC | Jan 2021 - Present
- Led migration to microservices, cutting deploy time by 60%
- Mentored 4 junior engineers

Software Engineer | Hooli Inc | Jun 2018 - Dec 2020
- Built billing platform processing $2M/month

SELECTED PROJECTS
TrailTracker (React, Node.js) Mar 2022 - Aug 2022
- Hiking route planner with 10k monthly users
https://github.com/alexmorgan/trailtracker

ACADEMIC QUALIFICATIONS
University of Texas at Austin
B.S. Computer Science, 2014 - 2018, GPA 3.8/4

CERTIFICATIONS & ACHIEVEMENTS
- AWS Certified Solutions Architect — Amazon, 2023
- Winner, HackTX Hackathon 2017

OPEN SOURCE CONTRIBUTIONS
- Maintainer of popular-lib (2k GitHub stars)
- Contributed performance patches to framework-x

VOLUNTEERING
- Code mentor at local high school, 2019 - Present

LANGUAGES
English, Spanish
`;

const RESUME_MINIMAL = `
Sam Lee
sam.lee@example.com

EDUCATION
State College
Diploma in Design, 2020 - 2022
`;

/** Shape stored by the old v1 parser — must still normalize cleanly. */
const LEGACY_V1_ROW = {
  name: "Old User",
  email: "old@example.com",
  skills: ["React", "Node.js"],
  education: [{ institution: "Old University", degree: "B.Tech", period: "2016 - 2020" }],
  experience: [
    {
      company: "Old Corp",
      role: "Developer",
      period: "2020 - 2023",
      description: "Built things\nShipped features",
    },
  ],
  meta: {
    parserId: "ai",
    parserVersion: "1.0.0",
    parsedAt: "2025-01-01T00:00:00.000Z",
    source: "ai",
  },
};

async function testSyntheticResumes() {
  console.log("\n=== Heuristic parser: rich resume with custom sections ===");
  const parsed = await heuristicResumeParser.parse({
    text: RESUME_WITH_CUSTOM_SECTIONS,
    fileName: "synthetic.pdf",
  });
  console.log(`  ${summarize(parsed)}`);

  check(parsed.name === "Alex Morgan", "name extracted");
  check(parsed.email === "alex.morgan@example.com", "email extracted");
  check(parsed.phone !== null, "phone extracted");
  check(parsed.links.some((l) => l.label === "GitHub"), "GitHub link labeled");
  check(Boolean(parsed.summary), 'semantic heading "Professional Summary" captured');
  check(parsed.skillGroups.length >= 2, 'skill categories preserved ("Technical Expertise")');
  check(parsed.experience.length === 2, '"Career Journey" mapped to experience (2 entries)');
  check(parsed.projects.length >= 1, '"Selected Projects" mapped to projects');
  check(parsed.education.length >= 1, '"Academic Qualifications" mapped to education');
  check(
    parsed.certifications.length + parsed.achievements.length >= 2,
    "combined certifications & achievements captured"
  );
  check(parsed.languages.length === 2, "languages captured");

  const customTitles = parsed.additionalSections.map((s) => s.title.toLowerCase());
  check(
    customTitles.some((t) => t.includes("open source")),
    "unknown section OPEN SOURCE CONTRIBUTIONS preserved"
  );
  check(
    customTitles.some((t) => t.includes("volunteering")),
    "unknown section VOLUNTEERING preserved"
  );

  // Completeness: no detected source section should be unrepresented.
  const missing = findMissingSections(RESUME_WITH_CUSTOM_SECTIONS, parsed);
  check(missing.length === 0, `no source sections lost (missing: ${missing.map((m) => m.title).join(", ") || "none"})`);

  console.log("\n=== Heuristic parser: minimal resume (missing sections OK) ===");
  const minimal = await heuristicResumeParser.parse({
    text: RESUME_MINIMAL,
    fileName: "minimal.pdf",
  });
  check(minimal.name === "Sam Lee", "minimal: name");
  check(minimal.experience.length === 0, "minimal: no invented experience");
  check(minimal.projects.length === 0, "minimal: no invented projects");
  check(minimal.certifications.length === 0, "minimal: no invented certifications");
  check(minimal.education.length === 1, "minimal: education found");

  console.log("\n=== Anti-hallucination: empty input ===");
  const empty = await heuristicResumeParser.parse({ text: "", fileName: "empty.pdf" });
  check(
    !empty.name && !empty.email && empty.skills.length === 0 &&
      empty.experience.length === 0 && empty.additionalSections.length === 0,
    "empty text yields empty data"
  );

  console.log("\n=== Backward compatibility: v1 legacy row ===");
  const legacy = normalizeParsedResumeData(LEGACY_V1_ROW);
  check(legacy !== null, "legacy row normalizes");
  if (legacy) {
    check(legacy.name === "Old User", "legacy: name kept");
    check(legacy.skills.length === 2, "legacy: skills kept");
    check(legacy.experience.length === 1, "legacy: experience kept");
    check(
      (legacy.experience[0].bullets ?? []).length === 2,
      "legacy: description recovered into bullets"
    );
    check(Array.isArray(legacy.projects) && legacy.projects.length === 0, "legacy: new fields default empty");
    check(legacy.summary === null, "legacy: summary defaults to null");
  }

  console.log("\n=== Persistence roundtrip: parse → JSON → normalize → JSON ===");
  const roundtrip = normalizeParsedResumeData(JSON.parse(JSON.stringify(parsed)));
  check(roundtrip !== null, "roundtrip normalizes");
  if (roundtrip) {
    check(roundtrip.experience.length === parsed.experience.length, "roundtrip: experience preserved");
    check(roundtrip.projects.length === parsed.projects.length, "roundtrip: projects preserved");
    check(
      roundtrip.additionalSections.length === parsed.additionalSections.length,
      "roundtrip: custom sections preserved"
    );
    const second = normalizeParsedResumeData(JSON.parse(JSON.stringify(roundtrip)));
    check(
      JSON.stringify(second) === JSON.stringify(roundtrip),
      "normalize is idempotent (edit → save → reload stable)"
    );
  }

  console.log("\n=== Recovery: preserveMissingSections fallback ===");
  // Simulate a parser that dropped every section.
  const droppedAll = await heuristicResumeParser.parse({ text: "", fileName: "x.pdf" });
  const missingAll = findMissingSections(RESUME_WITH_CUSTOM_SECTIONS, droppedAll);
  const recovered = preserveMissingSections(RESUME_WITH_CUSTOM_SECTIONS, droppedAll, missingAll);
  check(
    recovered.additionalSections.length >= 5,
    `dropped sections preserved verbatim as custom sections (${recovered.additionalSections.length})`
  );
  check(
    (recovered.meta.unmappedSections ?? []).length > 0,
    "unmapped sections recorded in meta"
  );
}

async function testRealFile(filePath: string) {
  console.log(`\n=== Real fixture: ${filePath} ===`);
  const buffer = await readFile(filePath);
  const text = await extractTextFromResume(buffer, filePath);
  check(text.trim().length > 100, `text extracted (${text.length} chars)`);

  const sourceSections = detectSourceSections(text);
  console.log(
    `  detected source sections: ${sourceSections
      .map((s) => `${s.title} [${s.kind}]`)
      .join(", ")}`
  );

  console.log("\n  --- AI parser (with completeness + recovery) ---");
  const parsed = await aiResumeParser.parse({ text, fileName: filePath });
  console.log(`  ${summarize(parsed)}`);
  check(Boolean(parsed.name), "AI: name extracted");
  check(parsed.skills.length > 0, "AI: skills extracted");

  const missing = findMissingSections(text, parsed);
  check(
    missing.length === 0,
    `AI: all source sections represented (missing: ${missing.map((m) => m.title).join(", ") || "none"})`
  );

  console.log("\n  --- Heuristic parser (fallback path) ---");
  const heuristic = await heuristicResumeParser.parse({ text, fileName: filePath });
  console.log(`  ${summarize(heuristic)}`);
  const missingHeuristic = findMissingSections(text, heuristic);
  check(
    missingHeuristic.length === 0,
    `heuristic: all source sections represented (missing: ${missingHeuristic.map((m) => m.title).join(", ") || "none"})`
  );
}

async function main() {
  await testSyntheticResumes();

  const filePath = process.argv[2];
  if (filePath) {
    await testRealFile(filePath);
  } else {
    console.log("\n(no file argument — skipped real-file test)");
  }

  console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECKS FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

void main();
