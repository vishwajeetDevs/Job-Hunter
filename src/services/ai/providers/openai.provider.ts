import {
  AiProviderError,
  type AiJsonRequest,
  type AiProvider,
} from "@/services/ai/provider.interface";

type ChatCompletionResponse = {
  choices?: Array<{ message?: { content?: string } }>;
};

/**
 * Works with any OpenAI-compatible chat completions API
 * (OpenAI, Groq, OpenRouter, Together, local servers, ...).
 *
 * Env vars:
 * - AI_API_KEY           (required)
 * - AI_MODEL             (default: gpt-4o-mini)
 * - AI_BASE_URL          (default: https://api.openai.com/v1)
 * - AI_REASONING_EFFORT  (optional: low|medium|high — for reasoning models
 *                         like gpt-oss; keeps token usage down on Groq)
 */
export class OpenAiCompatibleProvider implements AiProvider {
  readonly id = "openai";

  async completeJson(request: AiJsonRequest): Promise<string> {
    const apiKey = process.env.AI_API_KEY;

    if (!apiKey) {
      throw new AiProviderError(this.id, "AI_API_KEY is not configured.");
    }

    const baseUrl = (process.env.AI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");
    const model = process.env.AI_MODEL ?? "gpt-4o-mini";
    const reasoningEffort = process.env.AI_REASONING_EFFORT;

    // Reasoning models (gpt-oss, o-series) consume completion tokens while
    // thinking, so give them headroom above the caller's output budget.
    const maxTokens = (request.maxTokens ?? 400) + (reasoningEffort ? 1024 : 0);

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: request.temperature ?? 0,
        max_tokens: maxTokens,
        response_format: { type: "json_object" },
        ...(reasoningEffort ? { reasoning_effort: reasoningEffort } : {}),
        messages: [
          { role: "system", content: request.system },
          { role: "user", content: request.user },
        ],
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new AiProviderError(
        this.id,
        `Request failed with status ${response.status}: ${body.slice(0, 300)}`
      );
    }

    const data = (await response.json()) as ChatCompletionResponse;
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new AiProviderError(this.id, "Empty response from model.");
    }

    return content;
  }
}

export const openAiCompatibleProvider = new OpenAiCompatibleProvider();
