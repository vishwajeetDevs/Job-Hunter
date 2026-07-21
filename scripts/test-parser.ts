/**
 * Manual test harness for the heuristic resume parser.
 * Run: npx tsx scripts/test-parser.ts
 */
import { heuristicResumeParser } from "../src/services/resumes/parsers/heuristic-parser";

const RESUMES: Record<string, string> = {
  "multi-experience ATS style (pipe separators)": `
Vishwajeet Singh
vishwajeet@example.com | +91 98765 43210 | New Delhi, India
linkedin.com/in/vishwajeet

PROFESSIONAL EXPERIENCE

Software Engineer | Telgoo5 (Vcare Call Center Pvt Ltd.) | Oct 2024 - Present
- Built OSS/BSS telecom modules with React and Node.js
- Reduced API latency by 40% via query optimization

Software Developer | Apporio Infolabs Pvt Ltd & Shipmozo | Feb 2024 - Oct 2024
- Developed logistics dashboard used by 2000+ sellers
- Integrated courier APIs and rate cards

Full Stack Developer | ParcelX (Exyte Solutions Pvt. Ltd.) | Apr 2023 - Jan 2024
- Shipped parcel tracking platform end to end

Associate Software Engineer | Healthians | Jan 2022 - Mar 2023
- Automated lab report pipeline in Python

EDUCATION

B.Tech Computer Science | ABC University | 2018 - 2022

SKILLS
JavaScript, TypeScript, React, Node.js, PostgreSQL, Docker
`,

  "role-on-next-line format": `
Jane Doe
jane.doe@gmail.com

Work Experience

Acme Corporation
Senior Backend Engineer
January 2021 to Present
- Led migration to microservices
- Mentored 4 junior engineers

Globex Ltd
Software Developer
Jun 2018 - Dec 2020
- Built internal CRM tools

Education
Master of Science, Computer Science, State University, 2016-2018

Technical Skills
Python, Django, PostgreSQL, AWS, Docker
`,

  "dates-first compact format": `
John Smith
john@smith.dev | github.com/jsmith

EMPLOYMENT HISTORY

2022 - Present    Lead DevOps Engineer, CloudNine Systems, Remote
- Managed 200+ node Kubernetes fleet

2019 - 2022    Site Reliability Engineer, DataWorks Inc, Austin
- On-call rotation and incident response

ACADEMICS
BS Computer Engineering, Tech Institute, 2015 - 2019

TECHNOLOGIES
Terraform, Kubernetes, Go, Prometheus
`,

  "'at' separator with single dates": `
Priya Sharma
priya.sharma@outlook.com

Experience

Frontend Developer at PixelWorks Studio
Mar 2023 - Present
Built design system components in React and TypeScript.

Intern at WebCraft Solutions
Aug 2022 - Feb 2023
Assisted with UI implementation.

Education
BCA, Delhi University, 2019 - 2022

Skills: HTML, CSS, JavaScript, React, Figma
`,
};

async function main() {
  let failures = 0;

  for (const [label, text] of Object.entries(RESUMES)) {
    const parsed = await heuristicResumeParser.parse({
      text,
      fileName: "test.pdf",
    });

    console.log(`\n=== ${label} ===`);
    console.log(`name: ${parsed.name}`);
    console.log(`email: ${parsed.email}`);
    console.log(`skills (${parsed.skills.length}): ${parsed.skills.slice(0, 8).join(", ")}...`);
    console.log(`education entries: ${parsed.education.length}`);
    for (const edu of parsed.education) {
      console.log(`  - ${edu.institution} | ${edu.degree ?? "-"} | ${edu.period ?? "-"}`);
    }
    console.log(`experience entries: ${parsed.experience.length}`);
    for (const exp of parsed.experience) {
      console.log(
        `  - company="${exp.company}" role="${exp.role ?? ""}" period="${exp.period ?? ""}" location="${exp.location ?? ""}"`
      );
      if (exp.description) {
        console.log(`    desc: ${exp.description.split("\n")[0].slice(0, 60)}...`);
      }
    }
  }

  // Assertions on the critical case: all four jobs extracted separately.
  const multi = await heuristicResumeParser.parse({
    text: RESUMES["multi-experience ATS style (pipe separators)"],
    fileName: "test.pdf",
  });

  if (multi.experience.length !== 4) {
    console.error(`\nFAIL: expected 4 experience entries, got ${multi.experience.length}`);
    failures += 1;
  }
  const companies = multi.experience.map((e) => e.company).join(" || ");
  for (const expected of ["Telgoo5", "Apporio", "ParcelX", "Healthians"]) {
    if (!companies.includes(expected)) {
      console.error(`FAIL: missing company "${expected}" in: ${companies}`);
      failures += 1;
    }
  }
  const roles = multi.experience.map((e) => e.role ?? "").join(" || ");
  if (!/software engineer/i.test(roles)) {
    console.error(`FAIL: roles not mapped correctly: ${roles}`);
    failures += 1;
  }

  const nextLine = await heuristicResumeParser.parse({
    text: RESUMES["role-on-next-line format"],
    fileName: "test.pdf",
  });
  if (nextLine.experience.length !== 2) {
    console.error(`\nFAIL: role-on-next-line expected 2 entries, got ${nextLine.experience.length}`);
    failures += 1;
  }

  console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECKS FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

void main();
