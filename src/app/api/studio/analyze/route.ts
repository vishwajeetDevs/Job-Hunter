import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { normalizeParsedResumeData } from "@/features/resume/types";
import { analyzeResumeMatch } from "@/services/studio/analyze.service";
import {
  ensureResumeRawText,
  getJobForStudio,
  getMasterResume,
} from "@/services/studio/studio.service";
import { ensureDbUser } from "@/services/users/ensure-user";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { userId: clerkUserId } = await auth();

    if (!clerkUserId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const body = (await request.json().catch(() => null)) as {
      jobId?: string;
      resumeId?: string;
    } | null;

    const jobId = body?.jobId?.trim();

    if (!jobId) {
      return NextResponse.json({ error: "jobId is required." }, { status: 400 });
    }

    const user = await ensureDbUser(clerkUserId);

    const [job, master] = await Promise.all([
      getJobForStudio(jobId),
      getMasterResume(user.id, body?.resumeId?.trim() || undefined),
    ]);

    if (!job) {
      return NextResponse.json({ error: "Job not found." }, { status: 404 });
    }

    if (!job.description?.trim()) {
      return NextResponse.json(
        { error: "This job has no description to analyze against." },
        { status: 422 }
      );
    }

    if (!master) {
      return NextResponse.json(
        { error: "Upload a master resume in Resume Studio first." },
        { status: 422 }
      );
    }

    const resumeText = await ensureResumeRawText(master);
    const parsedData = normalizeParsedResumeData(master.parsedData);

    if (!resumeText.trim() && !parsedData) {
      return NextResponse.json(
        { error: "Could not read your resume. Re-upload it and try again." },
        { status: 422 }
      );
    }

    const report = await analyzeResumeMatch({
      resumeText,
      parsedData,
      jobTitle: job.title,
      jobCompany: job.company,
      jobDescription: job.description,
      jobExperienceLevel: job.experienceLevel,
    });

    return NextResponse.json({ success: true, report });
  } catch (error) {
    console.error("[POST /api/studio/analyze]", error);
    return NextResponse.json(
      { error: "Failed to analyze resume match." },
      { status: 500 }
    );
  }
}
