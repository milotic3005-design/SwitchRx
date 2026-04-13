import { GoogleGenAI } from '@google/genai';

async function run() {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const chat = ai.chats.create({
      model: 'gemini-3-flash-preview',
      config: {
        tools: [{ googleSearch: {} }],
      }
    });
    const response = await chat.sendMessageStream({ message: "What is the weather in Tokyo?" });
    for await (const chunk of response) {
      process.stdout.write(chunk.text || '');
    }
    console.log("\nSuccess");
  } catch (e) {
    console.error("Error:", e);
  }
}
run();
