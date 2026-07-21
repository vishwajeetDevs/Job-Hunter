/**
 * Resolves a real, public IP address to send as Careerjet's required
 * `user_ip` param.
 *
 * - In production (Vercel), the visitor's IP is the first public entry of
 *   the `x-forwarded-for` header.
 * - In local dev the forwarded IP is loopback/private, so we fetch the
 *   machine's public IP from an external service (cached for an hour).
 *
 * This keeps `user_ip` dynamic per request and avoids relying on a
 * hardcoded fallback.
 */

const IP_TTL_MS = 60 * 60 * 1000; // Re-check the public IP at most hourly.
let cachedPublicIp: { value: string; fetchedAt: number } | null = null;

/** True for loopback, link-local, and RFC-1918 private addresses. */
function isPrivateOrLoopback(ip: string): boolean {
  if (!ip) return true;

  // IPv6 loopback / unique-local / link-local.
  if (ip === "::1") return true;
  if (/^f[cd]/i.test(ip)) return true; // fc00::/7
  if (/^fe80/i.test(ip)) return true; // link-local

  // IPv4-mapped loopback (e.g. ::ffff:127.0.0.1).
  const normalized = ip.replace(/^::ffff:/i, "");

  if (
    normalized.startsWith("127.") ||
    normalized.startsWith("10.") ||
    normalized.startsWith("192.168.") ||
    normalized.startsWith("169.254.")
  ) {
    return true;
  }

  const m = normalized.match(/^172\.(\d{1,3})\./);
  if (m) {
    const second = Number(m[1]);
    if (second >= 16 && second <= 31) return true;
  }

  return false;
}

/** Fetches this server's public IP, cached to avoid repeated lookups. */
async function fetchPublicIp(): Promise<string | undefined> {
  if (cachedPublicIp && Date.now() - cachedPublicIp.fetchedAt < IP_TTL_MS) {
    return cachedPublicIp.value;
  }

  try {
    const response = await fetch("https://api.ipify.org?format=json", {
      cache: "no-store",
    });
    if (!response.ok) return cachedPublicIp?.value;

    const data = (await response.json()) as { ip?: string };
    if (data.ip) {
      cachedPublicIp = { value: data.ip, fetchedAt: Date.now() };
      return data.ip;
    }
  } catch {
    // Network hiccup — reuse the last known IP if we have one.
  }

  return cachedPublicIp?.value;
}

/**
 * Resolves the best public IP for the current request.
 * Prefers the first public IP in `x-forwarded-for`; otherwise falls back
 * to the server's public IP (fetched dynamically).
 */
export async function resolveUserIp(
  forwardedFor: string | null | undefined
): Promise<string | undefined> {
  const candidates = (forwardedFor ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  for (const ip of candidates) {
    if (!isPrivateOrLoopback(ip)) return ip;
  }

  return fetchPublicIp();
}
