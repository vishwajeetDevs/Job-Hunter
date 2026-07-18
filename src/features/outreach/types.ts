export type ColdEmailResult = {
  subject: string;
  body: string;
  meta: {
    /** "ai" when produced by a model, "template" for the local fallback. */
    engine: "ai" | "template";
    generatedAt: string;
  };
};

export type ColdEmailInput = {
  resumeId: string;
  recruiterName: string;
  company: string;
  jobTitle: string;
  /** Set on regenerate so the model produces a different variation. */
  regenerate?: boolean;
};

/** Validates untrusted model output into a safe ColdEmailResult. */
export function normalizeColdEmailResult(
  value: unknown,
  engine: ColdEmailResult["meta"]["engine"]
): ColdEmailResult | null {
  if (!value || typeof value !== "object") return null;

  const data = value as Record<string, unknown>;

  if (typeof data.subject !== "string" || typeof data.body !== "string") {
    return null;
  }

  const subject = data.subject.trim();
  const body = data.body.trim();

  if (!subject || !body) return null;

  return {
    subject,
    body,
    meta: {
      engine,
      generatedAt: new Date().toISOString(),
    },
  };
}
