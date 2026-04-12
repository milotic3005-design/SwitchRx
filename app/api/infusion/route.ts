import { NextRequest } from 'next/server';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { INFUSION_SYSTEM_PROMPT } from '@/lib/ai-prompts';

export async function POST(req: NextRequest) {
  try {
    const { scenario } = await req.json();

    if (!scenario) {
      return new Response(JSON.stringify({ error: 'Scenario is required' }), { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Gemini API key is not configured' }), { status: 500 });
    }

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContentStream({
      model: 'gemini-3.1-pro-preview',
      contents: scenario,
      config: {
        systemInstruction: INFUSION_SYSTEM_PROMPT,
        thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
      }
    });

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of response) {
            const parts = chunk.candidates?.[0]?.content?.parts;
            if (parts) {
              for (const part of parts) {
                controller.enqueue(encoder.encode(JSON.stringify(part) + '\n'));
              }
            }
          }
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/x-ndjson',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error: any) {
    console.error('Error in infusion API:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), { status: 500 });
  }
}
