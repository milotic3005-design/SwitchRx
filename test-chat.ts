import { GoogleGenAI } from '@google/genai';
const ai = new GoogleGenAI({ apiKey: 'dummy' });
const chat = ai.chats.create({ model: 'gemini-3.1-pro-preview' });
chat.sendMessageStream({ message: [{ text: 'hello' }] });
