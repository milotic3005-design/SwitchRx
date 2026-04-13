import { GoogleGenAI } from '@google/genai';

async function run() {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    const ai = new GoogleGenAI({ apiKey });
    const chat = ai.chats.create({
      model: 'gemini-3-flash-preview',
      config: {
        temperature: 0.1,
        tools: [{ googleSearch: {} }],
      }
    });
    console.log("Chat initialized successfully");
  } catch (err) {
    console.error("Failed to initialize chat:", err);
  }
}

run();
