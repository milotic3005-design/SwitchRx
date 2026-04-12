import { GoogleGenAI, ThinkingLevel } from '@google/genai';

async function run() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const response = await ai.models.generateContentStream({
    model: 'gemini-3.1-pro-preview',
    contents: 'What is 2+2? Explain your reasoning.',
    config: {
      thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH }
    }
  });

  for await (const chunk of response) {
    console.log(JSON.stringify(chunk.candidates?.[0]?.content?.parts, null, 2));
  }
}

run().catch(console.error);
