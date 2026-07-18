import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { normalizeParsedResumeData } from "@/features/resume/types";
import { generateColdEmail } from "@/services/outreach/cold-email.service";
import { getResumeForUser } from "@/services/resumes/resume.service";
import { ensureDbUser } from "@/services/users/ensure-user";

export const runtime = "nodejs";

const MAX_FIELD_LENGTH = 200;

export async function POST(request: Request) {
  try {
    const { userId: clerkUserId } = await auth();

    if (!clerkUserId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const body = (await request.json().catch(() => null)) as {
      resumeId?: string;
      recruiterName?: string;
      company?: string;
      jobTitle?: string;
      regenerate?: boolean;
    } | null;

    const resumeId = body?.resumeId?.trim();
    const recruiterName = body?.recruiterName?.trim();
    const company = body?.company?.trim();
    const jobTitle = body?.jobTitle?.trim();

    if (!resumeId || !recruiterName || !company || !jobTitle) {
      return NextResponse.json(
        { error: "resumeId, recruiterName, company, and jobTitle are required." },
        { status: 400 }
      );
    }

    if (
      [recruiterName, company, jobTitle].some(
        (field) => field.length > MAX_FIELD_LENGTH
      )
    ) {
      return NextResponse.json(
        { error: "Input fields are too long." },
        { status: 400 }
      );
    }

    const user = await ensureDbUser(clerkUserId);
    const resume = await getResumeForUser(resumeId, user.id);

    if (!resume) {
      return NextResponse.json({ error: "Resume not found." }, { status: 404 });
    }

    const parsedData = normalizeParsedResumeData(resume.parsedData);

    if (!parsedData) {
      return NextResponse.json(
        { error: "Resume has no parsed data yet. Re-upload or edit it first." },
        { status: 422 }
      );
    }

    const result = await generateColdEmail({
      resume: parsedData,
      recruiterName,
      company,
      jobTitle,
      regenerate: body?.regenerate === true,
    });

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error("[POST /api/cold-email]", error);
    return NextResponse.json(
      { error: "Failed to generate cold email." },
      { status: 500 }
    );
  }
}
