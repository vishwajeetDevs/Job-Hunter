import type {
  AiJsonRequest,
  AiProvider,
} from "@/services/ai/provider.interface";

/**
 * Wraps a PRIMARY provider with an automatic FALLBACK provider.
 *
 * If the primary throws for ANY reason — not configured, package load
 * failure, timeout, non-finished run, malformed/empty output, network
 * error — the request is transparently retried on the fallback provider.
 *
 * This guarantees the resume-generation flow never breaks when the primary
 * (e.g. the Cursor Agent SDK) is disabled, unavailable, or failing.
 */
export class FallbackAiProvider implements AiProvider {
  readonly id: string;

  constructor(
    private readonly primary: AiProvider,
    private readonly fallback: AiProvider
  ) {
    this.id = `${primary.id}->${fallback.id}`;
  }

  async completeJson(request: AiJsonRequest): Promise<string> {
    try {
      return await this.primary.completeJson(request);
    } catch (err) {
      console.warn(
        `[ai] primary provider "${this.primary.id}" failed — falling back to "${this.fallback.id}": ${
          err instanceof Error ? err.message : String(err)
        }`
      );
      return this.fallback.completeJson(request);
    }
  }
}
