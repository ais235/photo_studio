import { GoogleGenAI } from "@google/genai";

// Initialize the client
// The API key must be obtained exclusively from process.env.API_KEY
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const MODEL_NAME = 'gemini-2.5-flash-image';

export interface GeneratedImage {
  base64: string;
  mimeType: string;
}

/**
 * Generates an image from a text prompt with a specific aspect ratio.
 */
export const generateImage = async (prompt: string, aspectRatio: string = "1:1"): Promise<GeneratedImage | null> => {
  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: {
        parts: [{ text: prompt }],
      },
      config: {
        imageConfig: {
          aspectRatio: aspectRatio, 
        }
      }
    });

    return extractImageFromResponse(response);
  } catch (error) {
    console.error("Error generating image:", error);
    throw error;
  }
};

/**
 * Edits an existing image based on a text prompt.
 * Accepts an optional aspect ratio, otherwise defaults to 1:1 per API behavior if unspecified,
 * but we allow passing it to maintain consistency with the UI selector.
 */
export const editImage = async (
  base64Image: string,
  mimeType: string,
  prompt: string,
  aspectRatio: string = "1:1"
): Promise<GeneratedImage | null> => {
  try {
    // Strip the data url prefix if present (e.g., "data:image/png;base64,")
    const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, "");

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: {
        parts: [
          {
            inlineData: {
              data: cleanBase64,
              mimeType: mimeType,
            },
          },
          {
            text: prompt,
          },
        ],
      },
      config: {
         imageConfig: {
          aspectRatio: aspectRatio,
        }
      }
    });

    return extractImageFromResponse(response);
  } catch (error) {
    console.error("Error editing image:", error);
    throw error;
  }
};

/**
 * Helper to extract the first image from the response.
 * The response might contain text or multiple parts, we need to find the image.
 */
const extractImageFromResponse = (response: any): GeneratedImage | null => {
  if (!response.candidates || response.candidates.length === 0) {
    return null;
  }

  const parts = response.candidates[0].content.parts;
  for (const part of parts) {
    if (part.inlineData) {
      return {
        base64: part.inlineData.data,
        mimeType: part.inlineData.mimeType || "image/png",
      };
    }
  }
  return null;
};