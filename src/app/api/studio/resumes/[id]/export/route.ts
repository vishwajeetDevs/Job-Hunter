import { auth } from "@clerk/nextjs/server";

import { normalizeOptimizedResumeContent } from "@/features/studio/types";
import { isResumeExportFormat } from "@/services/studio/exporters/exporter.interface";
import { getResumeExporter } from "@/services/studio/exporters";
import { getOptimizedResumeById } from "@/services/studio/studio.service";
import { getDbUserByClerkId } from "@/services/users/ensure-user";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function sanitizeDownloadName(name: string): string {
  return name.replace(/[^a-zA-Z0-9 _.-]/g, "").trim() || "optimized-resume";
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { userId: clerkUserId } = await auth();

    if (!clerkUserId) {
      return new Response("Unauthorized", { status: 401 });
    }

    const user = await getDbUserByClerkId(clerkUserId);
    if (!user) {
      return new Response("Unauthorized", { status: 401 });
    }

    const format = new URL(request.url).searchParams.get("format") ?? "pdf";

    if (!isResumeExportFormat(format)) {
      return new Response("Unsupported format.", { status: 400 });
    }

    const exporter = getResumeExporter(format);

    if (!exporter) {
      // Format is declared (e.g. docx) but the exporter isn't built yet.
      return new Response(
        `Export to ${format.toUpperCase()} is not available yet.`,
        { status: 501 }
      );
    }

    const { id } = await context.params;
    const resume = await getOptimizedResumeById(user.id, id);

    if (!resume) {
      return new Response("Not found", { status: 404 });
    }

    const content = normalizeOptimizedResumeContent(resume.content, 1);

    if (!content) {
      return new Response("This resume has no generated content.", {
        status: 422,
      });
    }

    const title = resume.job
      ? `${content.name ?? "Resume"} — ${resume.job.title} @ ${resume.job.company}`
      : resume.originalFileName;

    const bytes = await exporter.render(content, title);
    const downloadName = sanitizeDownloadName(
      `${content.name ?? "Optimized resume"} - ${resume.job?.company ?? "job"}`
    );

    return new Response(Buffer.from(bytes), {
      headers: {
        "Content-Type": exporter.contentType,
        "Content-Disposition": `attachment; filename="${downloadName}${exporter.extension}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("[GET /api/studio/resumes/[id]/export]", error);
    return new Response("Export failed.", { status: 500 });
  }
}
