import { NextRequest } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { CLINICAL_SYSTEM_PROMPT } from '@/lib/ai-prompts';

export async function POST(req: NextRequest) {
  try {
    const { messageParts, history } = await req.json();

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Gemini API key is not configured' }), { status: 500 });
    }

    const ai = new GoogleGenAI({ apiKey });
    const chat = ai.chats.create({
      model: 'gemini-3-flash-preview',
      config: {
        systemInstruction: CLINICAL_SYSTEM_PROMPT,
        temperature: 0.1,
        tools: [{ googleSearch: {} }],
      },
      history: history || [],
    });

    const streamResponse = await chat.sendMessageStream({ message: messageParts });

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of streamResponse) {
            if (chunk.text) {
              controller.enqueue(encoder.encode(chunk.text));
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
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error: any) {
    console.error('Error in chat API:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), { status: 500 });
  }
}
