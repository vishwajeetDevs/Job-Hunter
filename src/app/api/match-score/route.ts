import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { normalizeParsedResumeData } from "@/features/resume/types";
import { computeMatchScore } from "@/services/match/match-score.service";
import { getResumeWithTextForUser } from "@/services/resumes/resume.service";
import { ensureResumeRawText } from "@/services/studio/studio.service";
import { ensureDbUser } from "@/services/users/ensure-user";

export const runtime = "nodejs";

const MAX_JOB_DESCRIPTION_LENGTH = 20_000;

export async function POST(request: Request) {
  try {
    const { userId: clerkUserId } = await auth();

    if (!clerkUserId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const body = (await request.json().catch(() => null)) as {
      resumeId?: string;
      jobDescription?: string;
    } | null;

    const resumeId = body?.resumeId?.trim();
    const jobDescription = body?.jobDescription?.trim();

    if (!resumeId || !jobDescription) {
      return NextResponse.json(
        { error: "resumeId and jobDescription are required." },
        { status: 400 }
      );
    }

    if (jobDescription.length > MAX_JOB_DESCRIPTION_LENGTH) {
      return NextResponse.json(
        { error: "Job description is too long." },
        { status: 400 }
      );
    }

    const user = await ensureDbUser(clerkUserId);
    const resume = await getResumeWithTextForUser(resumeId, user.id);

    if (!resume) {
      return NextResponse.json({ error: "Resume not found." }, { status: 404 });
    }

    const parsedData = normalizeParsedResumeData(resume.parsedData);
    const resumeText = await ensureResumeRawText(resume);

    if (!parsedData && !resumeText.trim()) {
      return NextResponse.json(
        { error: "Resume has no parsed data yet. Re-upload or edit it first." },
        { status: 422 }
      );
    }

    const result = computeMatchScore({ parsedData, resumeText, jobDescription });

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error("[POST /api/match-score]", error);
    return NextResponse.json(
      { error: "Failed to compute match score." },
      { status: 500 }
    );
  }
}
