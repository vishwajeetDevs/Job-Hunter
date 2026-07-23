import {
  AiProviderError,
  type AiJsonRequest,
  type AiProvider,
} from "@/services/ai/provider.interface";

/**
 * Cursor Agent SDK provider (@cursor/sdk).
 *
 * Runs the prompt through `Agent.prompt(...)` and returns the agent's final
 * text output, which the caller parses as JSON. This is intentionally used
 * as a *completion-style* provider: the prompt instructs the agent NOT to
 * touch files or run commands, only to emit the structured JSON resume.
 *
 * IMPORTANT — production safety:
 * - The @cursor/sdk import is DYNAMIC so a missing/broken package can never
 *   break the build or the Groq path.
 * - Every failure (missing key, load error, timeout, non-finished run,
 *   empty output) throws an AiProviderError, which the FallbackAiProvider
 *   wrapper catches to fall back to Groq automatically.
 * - A hard timeout guarantees a hung agent can never exceed the route's
 *   maxDuration; it fails fast and hands off to the fallback.
 *
 * Env vars:
 * - CURSOR_API_KEY       (required to use this provider)
 * - CURSOR_MODEL         (optional, default "auto")
 * - CURSOR_TIMEOUT_MS    (optional, default 30000)
 */
export class CursorAgentProvider implements AiProvider {
  readonly id = "cursor";

  async completeJson(request: AiJsonRequest): Promise<string> {
    const apiKey = process.env.CURSOR_API_KEY;
    if (!apiKey) {
      throw new AiProviderError(this.id, "CURSOR_API_KEY is not configured.");
    }

    // Dynamic import — isolates package load failures to the fallback path.
    let Agent: (typeof import("@cursor/sdk"))["Agent"];
    try {
      ({ Agent } = await import("@cursor/sdk"));
    } catch (err) {
      throw new AiProviderError(
        this.id,
        `Failed to load @cursor/sdk: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    const model = process.env.CURSOR_MODEL ?? "auto";
    const timeoutMs = Number(process.env.CURSOR_TIMEOUT_MS ?? 30000);

    // Fold system + user into a single message and forbid any repo actions
    // so the agent behaves like a pure JSON completion endpoint.
    const message = [
      request.system,
      "",
      request.user,
      "",
      "STRICT OUTPUT CONTRACT: Do NOT create, edit, read, or list any files. Do NOT run any shell commands or tools. Reply with ONLY the minified JSON object specified above — no prose, no markdown fences, nothing else.",
    ].join("\n");

    const result = await withTimeout(
      Agent.prompt(message, {
        apiKey,
        model: { id: model },
        // Local runtime against the deployment cwd. If the local executor is
        // unavailable (e.g. serverless), this throws and the fallback runs.
        local: { cwd: process.cwd() },
      }),
      timeoutMs,
      this.id
    );

    if (result.status !== "finished") {
      const detail = result.error
        ? ` (${JSON.stringify(result.error).slice(0, 200)})`
        : "";
      throw new AiProviderError(
        this.id,
        `Agent run ${result.status}${detail}`
      );
    }

    const text = result.result?.trim();
    if (!text) {
      throw new AiProviderError(this.id, "Agent returned an empty result.");
    }

    return text;
  }
}

/** Rejects with an AiProviderError if the promise does not settle in time. */
async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  providerId: string
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () =>
        reject(new AiProviderError(providerId, `Timed out after ${ms}ms.`)),
      ms
    );
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export const cursorAgentProvider = new CursorAgentProvider();
