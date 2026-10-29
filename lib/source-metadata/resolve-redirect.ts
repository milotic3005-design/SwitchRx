/**
 * Resolves Gemini grounding redirect links to their real destination.
 *
 * The input URIs arrive from the browser, so this module is the SSRF boundary:
 * only `https://vertexaisearch.cloud.google.com/...` may be requested, the
 * request never follows redirects, and only the `Location` header is read.
 * The destination page is never fetched. Nothing here throws.
 */

export const GROUNDING_REDIRECT_HOST = 'vertexaisearch.cloud.google.com';

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

/** Parses `uri` and returns it only if it is an allowed grounding redirect URL. */
function parseAllowedUri(uri: unknown): URL | null {
  if (typeof uri !== 'string') return null;
  let url: URL;
  try {
    url = new URL(uri);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  if (url.hostname !== GROUNDING_REDIRECT_HOST) return null;
  // `port` is '' for the default https port (443), so any other port is refused.
  if (url.port !== '') return null;
  if (url.username !== '' || url.password !== '') return null;
  return url;
}

export function isAllowedGroundingUri(uri: string): boolean {
  return parseAllowedUri(uri) !== null;
}

/**
 * Issues one GET with `redirect: 'manual'` to an allowlisted grounding URI and
 * returns the (absolute) `Location` it points at, or `null` on any failure.
 */
export async function resolveRedirect(
  uri: string,
  fetchImpl: FetchLike,
  timeoutMs = 4000,
): Promise<string | null> {
  const allowed = parseAllowedUri(uri);
  if (!allowed) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    // Fetch the normalized, validated URL: what was checked is what is requested.
    const target = allowed.toString();
    const res = await fetchImpl(target, {
      method: 'GET',
      redirect: 'manual',
      signal: controller.signal,
    });
    // Only the headers are needed; release the connection without reading the body.
    res.body?.cancel().catch(() => {});
    if (!REDIRECT_STATUSES.has(res.status)) return null;
    const location = res.headers.get('location');
    if (!location) return null;
    const resolved = new URL(location, target);
    // The result is rendered as an href downstream: refuse javascript:, data:, ftp:, etc.
    if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') return null;
    return resolved.toString();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
