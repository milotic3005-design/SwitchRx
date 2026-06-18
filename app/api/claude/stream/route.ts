import { runClaudeStream, type StreamEvent } from '@/lib/claude-server';

// Node runtime (the Anthropic SDK needs Node APIs) and a generous duration so
// long consult briefs (thinking + web search) can stream to completion.
export const runtime = 'nodejs';
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response('Invalid JSON body', { status: 400 });
  }

  const { system, messages, maxTokens, webSearch } = body ?? {};
  if (typeof system !== 'string' || !Array.isArray(messages)) {
    return new Response('Expected { system: string, messages: MessageParam[] }', {
      status: 400,
    });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: StreamEvent) =>
        controller.enqueue(encoder.encode(JSON.stringify(e) + '\n'));
      try {
        await runClaudeStream({
          system,
          messages,
          maxTokens,
          webSearch: !!webSearch,
          onEvent: send,
        });
        send({ type: 'done' });
      } catch (err: any) {
        console.error('Claude stream route error:', err);
        send({ type: 'error', message: err?.message || 'Claude request failed' });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store, no-transform',
      'X-Accel-Buffering': 'no',
    },
  });
}
