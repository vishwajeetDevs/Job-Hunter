import { auth } from "@clerk/nextjs/server";
import path from "node:path";

import { readResumeFile } from "@/lib/storage/resume-storage";
import { getDbUserByClerkId } from "@/services/users/ensure-user";
import { getResumeForUser } from "@/services/resumes/resume.service";
import { withApiLogger } from "@/lib/api-logger";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function contentTypeFromFileName(fileName: string): string {
  const extension = path.extname(fileName).toLowerCase();
  if (extension === ".pdf") return "application/pdf";
  if (extension === ".docx") {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  return "application/octet-stream";
}

async function handler(_request: Request, context: RouteContext) {
  try {
    const { userId: clerkUserId } = await auth();

    if (!clerkUserId) {
      return new Response("Unauthorized", { status: 401 });
    }

    const user = await getDbUserByClerkId(clerkUserId);
    if (!user) {
      return new Response("Unauthorized", { status: 401 });
    }

    const { id } = await context.params;
    const resume = await getResumeForUser(id, user.id);

    if (!resume?.originalFileUrl) {
      return new Response("Not found", { status: 404 });
    }

    const buffer = await readResumeFile(resume.originalFileUrl);

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentTypeFromFileName(resume.originalFileName),
        "Content-Disposition": `attachment; filename="${resume.originalFileName}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("[GET /api/resumes/[id]/download]", error);
    return new Response("Not found", { status: 404 });
  }
}

export const GET = withApiLogger(handler);
