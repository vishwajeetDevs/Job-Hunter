import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { serializeResumeListItem } from "@/features/resume/utils";
import { validateResumeFile } from "@/lib/resume/validation";
import { saveUploadedResume } from "@/services/resumes/resume.service";
import { ensureDbUser } from "@/services/users/ensure-user";
import { withApiLogger } from "@/lib/api-logger";

export const runtime = "nodejs";

async function handler(request: Request) {
  try {
    const { userId: clerkUserId } = await auth();

    if (!clerkUserId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided." }, { status: 400 });
    }

    const validation = validateResumeFile(file);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const user = await ensureDbUser(clerkUserId);
    const buffer = Buffer.from(await file.arrayBuffer());

    const resume = await saveUploadedResume({
      userId: user.id,
      fileName: file.name,
      buffer,
    });

    return NextResponse.json({
      resume: serializeResumeListItem(resume),
    });
  } catch (error) {
    console.error("[POST /api/resumes/upload]", error);
    return NextResponse.json(
      { error: "Failed to upload resume." },
      { status: 500 }
    );
  }
}

export const POST = withApiLogger(handler);
