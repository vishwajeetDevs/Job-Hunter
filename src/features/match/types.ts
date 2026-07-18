export type MatchScoreResult = {
  /** 0-100 */
  score: number;
  strengths: string[];
  missingSkills: string[];
  recommendations: string[];
  meta: {
    /** "ai" when produced by a model, "keyword" for the local fallback. */
    engine: "ai" | "keyword";
    generatedAt: string;
  };
};

export type MatchScoreResponse =
  | { success: true; result: MatchScoreResult }
  | { success: false; error: string };

function toStringList(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, max);
}

/** Validates untrusted model output into a safe MatchScoreResult. */
export function normalizeMatchScoreResult(
  value: unknown,
  engine: MatchScoreResult["meta"]["engine"]
): MatchScoreResult | null {
  if (!value || typeof value !== "object") return null;

  const data = value as Record<string, unknown>;
  const rawScore = typeof data.score === "number" ? data.score : Number(data.score);

  if (!Number.isFinite(rawScore)) return null;

  return {
    score: Math.min(100, Math.max(0, Math.round(rawScore))),
    strengths: toStringList(data.strengths, 5),
    missingSkills: toStringList(data.missingSkills, 5),
    recommendations: toStringList(data.recommendations, 5),
    meta: {
      engine,
      generatedAt: new Date().toISOString(),
    },
  };
}
