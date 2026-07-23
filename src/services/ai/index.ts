import type { AiProvider } from "@/services/ai/provider.interface";
import { openAiCompatibleProvider } from "@/services/ai/providers/openai.provider";

/**
 * Provider registry. Register new AI providers here and select
 * one via the AI_PROVIDER env var.
 */
const providers: Record<string, AiProvider> = {
  openai: openAiCompatibleProvider,
};

export function isAiConfigured(): boolean {
  return Boolean(process.env.AI_API_KEY);
}

export function getAiProvider(): AiProvider {
  const kind = process.env.AI_PROVIDER ?? "openai";
  return providers[kind] ?? openAiCompatibleProvider;
}
