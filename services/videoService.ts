import { GoogleGenAI } from '@google/genai';
import { VIDEO_MODEL_NAME } from '../constants';

export class VideoService {
  
  async generateVideo(prompt: string, imageBase64: string, mimeType: string, aspectRatio: '16:9' | '9:16' = '16:9'): Promise<string> {
    
    // Check for API Key selection (Required for Veo)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const aistudio = (window as any).aistudio;
    
    if (aistudio) {
      const hasKey = await aistudio.hasSelectedApiKey();
      if (!hasKey) {
        await aistudio.openSelectKey();
        // Race condition mitigation: assume success if dialog closes/promise resolves
      }
    }

    // Create a new instance to ensure we capture the selected key if applicable
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    try {
      let operation = await ai.models.generateVideos({
        model: VIDEO_MODEL_NAME,
        prompt: prompt,
        image: {
          imageBytes: imageBase64,
          mimeType: mimeType,
        },
        config: {
          numberOfVideos: 1,
          resolution: '720p',
          aspectRatio: aspectRatio
        }
      });

      // Poll for completion
      while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 5000)); // Poll every 5s
        operation = await ai.operations.getVideosOperation({ operation: operation });
      }

      const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
      if (!videoUri) throw new Error("No video URI returned.");

      // Append API key for download
      return `${videoUri}&key=${process.env.API_KEY}`;
      
    } catch (error) {
      // If we get the specific entity not found error, prompt for key again
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const aistudio = (window as any).aistudio;
      if (error instanceof Error && error.message.includes('Requested entity was not found') && aistudio) {
         await aistudio.openSelectKey();
         throw new Error("Please select a paid project API key and try again.");
      }
      console.error("Video Generation Error:", error);
      throw error;
    }
  }
}
