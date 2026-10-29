import type { GroundingSource } from '@/lib/ai';
import { enrichSources } from '@/lib/source-metadata/enrich';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_SOURCES = 40;

const badRequest = (message: string) =>
  new Response(message, {
    status: 400,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });

/** Returns the sources if `body` is `{ sources: { uri: string; title: string }[] }` with 1-40 items. */
function parseSources(body: unknown): GroundingSource[] | null {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return null;
  const { sources } = body as { sources?: unknown };
  if (!Array.isArray(sources) || sources.length < 1 || sources.length > MAX_SOURCES) return null;

  const parsed: GroundingSource[] = [];
  for (const item of sources) {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) return null;
    const { uri, title } = item as { uri?: unknown; title?: unknown };
    if (typeof uri !== 'string' || typeof title !== 'string') return null;
    parsed.push({ uri, title });
  }
  return parsed;
}

/**
 * Resolves the web-search sources of a Copilot answer to verified reference details.
 * The body comes from the browser; `enrichSources` only ever requests allowlisted grounding
 * redirects and NCBI APIs, never a resolved destination page.
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest('Invalid JSON body');
  }

  const sources = parseSources(body);
  if (!sources) return badRequest(`Expected { sources: [{ uri, title }] } with 1-${MAX_SOURCES} items`);

  const enriched = await enrichSources(sources, { fetchImpl: fetch });
  return Response.json({ sources: enriched });
}
