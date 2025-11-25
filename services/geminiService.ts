import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { GEMINI_MODEL } from "../constants";

// Initialize the client with the environment variable key
// Note: In a production environment, ensure process.env.API_KEY is set.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const analyzeChart = async (
  imageBase64: string,
  promptText: string
): Promise<string> => {
  try {
    // Strip the data url prefix if present for the API call payload if needed, 
    // but the @google/genai helper usually handles cleaner input or we construct parts manually.
    // The modern SDK handles inlineData parts nicely.
    
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    const mimeType = imageBase64.match(/^data:(image\/\w+);base64,/)?.[1] || "image/png";

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Data,
              mimeType: mimeType,
            },
          },
          {
            text: promptText,
          },
        ],
      },
    });

    return response.text || "No analysis generated.";
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return `Error generating analysis: ${error instanceof Error ? error.message : String(error)}`;
  }
};

export const analyzeChartMulti = async (
  images: string[],
  promptText: string
): Promise<string> => {
  try {
    const parts: any[] = [];
    for (const img of images) {
      const base64Data = img.replace(/^data:image\/\w+;base64,/, "");
      const mimeType = img.match(/^data:(image\/\w+);base64,/)?.[1] || "image/png";
      parts.push({ inlineData: { data: base64Data, mimeType } });
    }
    parts.push({ text: promptText });
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: { parts }
    });
    return response.text || "No analysis generated.";
  } catch (error) {
    console.error("Gemini Multi Analysis Error:", error);
    return `Error generating analysis: ${error instanceof Error ? error.message : String(error)}`;
  }
};

export const sendChatMessage = async (
  history: { role: "user" | "model"; parts: { text: string }[] }[],
  newMessage: string
): Promise<string> => {
  try {
    const chat = ai.chats.create({
      model: GEMINI_MODEL,
      history: history,
    });

    const response: GenerateContentResponse = await chat.sendMessage({
      message: newMessage,
    });

    return response.text || "I couldn't process that.";
  } catch (error) {
    console.error("Gemini Chat Error:", error);
    return "Sorry, I encountered an error processing your message.";
  }
};

export const generateDailyTraining = async (topic: string): Promise<string> => {
    try {
        const response = await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents: topic
        });
        return response.text || "Keep calm and trade on.";
    } catch (error) {
        return "Daily training generator unavailable.";
    }
}
