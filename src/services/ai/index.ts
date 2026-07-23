import type { AiProvider } from "@/services/ai/provider.interface";
import { openAiCompatibleProvider } from "@/services/ai/providers/openai.provider";
import { cursorAgentProvider } from "@/services/ai/providers/cursor.provider";
import { FallbackAiProvider } from "@/services/ai/fallback.provider";

/**
 * Provider registry. Register new AI providers here and select
 * one via the AI_PROVIDER env var.
 */
const providers: Record<string, AiProvider> = {
  openai: openAiCompatibleProvider,
  cursor: cursorAgentProvider,
};

export function isAiConfigured(): boolean {
  // AI_API_KEY (Groq) is the always-on base/fallback provider and must stay
  // configured even when the Cursor Agent integration is enabled.
  return Boolean(process.env.AI_API_KEY);
}

export function getAiProvider(): AiProvider {
  const kind = process.env.AI_PROVIDER ?? "openai";
  return providers[kind] ?? openAiCompatibleProvider;
}

/**
 * True when the Cursor Agent integration should act as the PRIMARY provider
 * for resume generation. Requires BOTH the explicit enable flag AND a key,
 * so production behaviour is unchanged until both are set in Vercel.
 */
export function isCursorAgentEnabled(): boolean {
  return (
    process.env.CURSOR_AGENT_ENABLED === "true" &&
    Boolean(process.env.CURSOR_API_KEY)
  );
}

/**
 * Provider used specifically for resume generation/optimization.
 *
 * - Cursor enabled  → Cursor Agent is PRIMARY, existing Groq provider is the
 *   automatic fallback (used if Cursor is disabled/unavailable/fails).
 * - Cursor disabled → the existing Groq provider is used directly, so the
 *   live resume flow is byte-for-byte identical to today.
 *
 * Toggle at runtime purely via env vars — no code change or redeploy of
 * logic required.
 */
export function getResumeAiProvider(): AiProvider {
  const base = getAiProvider();
  if (isCursorAgentEnabled()) {
    return new FallbackAiProvider(cursorAgentProvider, base);
  }
  return base;
}
