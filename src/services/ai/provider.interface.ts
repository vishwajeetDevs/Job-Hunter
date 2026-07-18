/**
 * Provider-agnostic AI contract.
 *
 * To swap models/providers:
 * 1. Implement this interface in `providers/<name>.provider.ts`.
 * 2. Register it in `src/services/ai/index.ts`.
 * 3. Point `AI_PROVIDER` (and related env vars) at the new provider.
 */
export type AiJsonRequest = {
  system: string;
  user: string;
  /** Cap output tokens to keep responses cheap. */
  maxTokens?: number;
  /** 0 = deterministic (default). Raise for creative variation. */
  temperature?: number;
};

export interface AiProvider {
  readonly id: string;
  /** Sends a prompt and returns the raw JSON text of the model reply. */
  completeJson(request: AiJsonRequest): Promise<string>;
}

export class AiProviderError extends Error {
  constructor(providerId: string, message: string) {
    super(`[ai:${providerId}] ${message}`);
    this.name = "AiProviderError";
  }
}
