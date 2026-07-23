/**
 * API Request Logger
 *
 * Wraps Next.js App Router route handlers and writes one row to
 * tbl_api_request_response for every call:
 *   • who called (userId, userName)
 *   • what endpoint (method, api path)
 *   • what was sent / returned (request / response bodies, status code)
 *   • how long it took (executionTime ms)
 *
 * Usage:
 *   // Simple route (no dynamic segment):
 *   async function handler(request: Request) { ... }
 *   export const POST = withApiLogger(handler);
 *
 *   // Dynamic-segment route:
 *   async function handler(request: Request, ctx: RouteContext) { ... }
 *   export const GET = withApiLogger(handler);
 *
 * The DB write is fire-and-forget so it adds zero latency to the response.
 * Logging errors are caught and printed; they never surface to callers.
 */

import { auth } from "@clerk/nextjs/server";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Payload sanitization
// ---------------------------------------------------------------------------

/** Maximum characters kept per string value in the stored JSON. */
const MAX_STR_LEN = 4_000;

/**
 * Recursively truncates long strings inside a JSON-serializable value so
 * large resume texts don't bloat the log table.
 */
function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 8) return "[deep]";
  if (typeof value === "string") {
    return value.length > MAX_STR_LEN
      ? `${value.slice(0, MAX_STR_LEN)} …[${value.length - MAX_STR_LEN} chars omitted]`
      : value;
  }
  if (Array.isArray(value)) return value.map((v) => sanitize(v, depth + 1));
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        sanitize(v, depth + 1),
      ])
    );
  }
  return value;
}

// ---------------------------------------------------------------------------
// Body capture helpers
// ---------------------------------------------------------------------------

/**
 * Reads the request body into a plain object without consuming the original
 * request stream (uses `request.clone()`).
 *
 * Returns:
 *   • parsed JSON for `application/json` requests
 *   • `{ _type: "multipart/form-data" }` for file-upload requests
 *   • `null` for GET / HEAD / other content types
 */
async function captureRequestBody(request: Request): Promise<unknown> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    return { _type: "multipart/form-data" };
  }

  if (contentType.includes("application/json")) {
    try {
      return await request.clone().json();
    } catch {
      return { _error: "Could not parse JSON body" };
    }
  }

  return null;
}

/**
 * Reads the response body into a plain object without consuming the original
 * stream (uses `response.clone()`).
 *
 * Returns:
 *   • parsed JSON for `application/json` responses
 *   • `{ _type, _bytes? }` for binary/non-JSON responses (PDF, file, etc.)
 *   • `null` on failure
 */
async function captureResponseBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    const bytes = response.headers.get("content-length");
    return {
      _type: contentType || "unknown",
      ...(bytes ? { _bytes: Number(bytes) } : {}),
    };
  }

  try {
    return await response.clone().json();
  } catch {
    return { _error: "Could not parse JSON response" };
  }
}

// ---------------------------------------------------------------------------
// Async log writer (fire-and-forget)
// ---------------------------------------------------------------------------

interface LogEntry {
  clerkUserId: string | null;
  method: string;
  api: string;
  requestBody: unknown;
  responseBody: unknown;
  statusCode: number;
  executionTime: number;
}

function writeApiLog(entry: LogEntry): void {
  void (async () => {
    try {
      let userId: string | null = null;
      let userName: string | null = null;

      // Resolve clerk user → internal user record
      if (entry.clerkUserId) {
        const user = await prisma.user.findUnique({
          where: { clerkUserId: entry.clerkUserId },
          select: { id: true, name: true, email: true },
        });
        if (user) {
          userId = user.id;
          userName = user.name ?? user.email;
        }
      }

      await prisma.apiRequestLog.create({
        data: {
          userId,
          userName,
          method: entry.method,
          api: entry.api,
          ...(entry.requestBody !== null && {
            request: sanitize(entry.requestBody) as Prisma.InputJsonValue,
          }),
          ...(entry.responseBody !== null && {
            response: sanitize(entry.responseBody) as Prisma.InputJsonValue,
          }),
          statusCode: entry.statusCode,
          executionTime: entry.executionTime,
        },
      });
    } catch (err) {
      // Logging must never break the application.
      console.error("[api-logger] Failed to write log entry:", err);
    }
  })();
}

// ---------------------------------------------------------------------------
// withApiLogger HOC — TypeScript overloads for with / without route context
// ---------------------------------------------------------------------------

// Overload 1 — simple handler (no dynamic-segment context)
export function withApiLogger(
  handler: (req: Request) => Promise<Response>
): (req: Request) => Promise<Response>;

// Overload 2 — handler with a route context (dynamic segments)
export function withApiLogger<C>(
  handler: (req: Request, ctx: C) => Promise<Response>
): (req: Request, ctx: C) => Promise<Response>;

// Implementation
export function withApiLogger(
  handler: (req: Request, ctx?: unknown) => Promise<Response>
): (req: Request, ctx?: unknown) => Promise<Response> {
  return async (request: Request, context?: unknown): Promise<Response> => {
    const startedAt = Date.now();
    const method = request.method;
    const api = new URL(request.url).pathname;

    // Capture Clerk user id while we're still inside the request context.
    // auth() is cached per request by Clerk so this is effectively free.
    let clerkUserId: string | null = null;
    try {
      const { userId } = await auth();
      clerkUserId = userId;
    } catch {
      // Expected for system/cron endpoints that don't carry a Clerk session.
    }

    // Capture request body (clone — original stream goes to the handler).
    const requestBody = await captureRequestBody(request);

    // Run the actual handler.
    let response: Response;
    try {
      response = await handler(request, context);
    } catch (error) {
      writeApiLog({
        clerkUserId,
        method,
        api,
        requestBody,
        responseBody: {
          _error: error instanceof Error ? error.message : String(error),
        },
        statusCode: 500,
        executionTime: Date.now() - startedAt,
      });
      throw error;
    }

    const executionTime = Date.now() - startedAt;
    const statusCode = response.status;

    // Capture response body (clone — original is returned to Next.js as-is).
    const responseBody = await captureResponseBody(response);

    writeApiLog({
      clerkUserId,
      method,
      api,
      requestBody,
      responseBody,
      statusCode,
      executionTime,
    });

    return response;
  };
}
