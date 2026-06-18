import { runAIStream, type StreamEvent } from '@/lib/ai-server';

// Node runtime (the Gemini SDK needs Node APIs) and a generous duration so long
// consult briefs (HIGH thinking + Google Search grounding) can stream fully.
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

  const { system, messages, webSearch } = body ?? {};
  if (typeof system !== 'string' || !Array.isArray(messages)) {
    return new Response('Expected { system: string, messages: ChatMessage[] }', {
      status: 400,
    });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: StreamEvent) =>
        controller.enqueue(encoder.encode(JSON.stringify(e) + '\n'));
      try {
        await runAIStream({
          system,
          messages,
          webSearch: !!webSearch,
          onEvent: send,
        });
        send({ type: 'done' });
      } catch (err: any) {
        console.error('AI stream route error:', err);
        send({ type: 'error', message: err?.message || 'AI request failed' });
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
