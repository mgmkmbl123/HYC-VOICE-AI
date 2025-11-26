import { GoogleGenAI, Modality } from '@google/genai';
import { 
  CHAT_MODEL_COMPLEX, 
  CHAT_MODEL_FAST, 
  CHAT_MODEL_SEARCH, 
  CHAT_MODEL_THINKING,
  TTS_MODEL_NAME,
  TEACHER_SYSTEM_INSTRUCTION 
} from '../constants';
import { ChatMessage, FileContext, GroundingChunk } from '../types';
import { base64ToUint8Array, decodeAudioData } from '../utils/audioUtils';

export interface ChatOptions {
  useSearch?: boolean;
  useThinking?: boolean;
}

export interface ChatResponse {
  text: string;
  groundingChunks?: GroundingChunk[];
}

export class ChatService {
  private ai: GoogleGenAI;
  private audioContext: AudioContext | null = null;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  async sendMessage(
    history: ChatMessage[], 
    newMessage: string, 
    attachments: FileContext[] = [],
    options: ChatOptions = {}
  ): Promise<ChatResponse> {
    
    // Determine Model and Config
    let modelName = CHAT_MODEL_FAST;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let toolConfig: any = undefined;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let tools: any[] | undefined = undefined;

    const hasImage = attachments.some(a => a.type === 'image');

    if (options.useThinking) {
      modelName = CHAT_MODEL_THINKING;
      toolConfig = { thinkingConfig: { thinkingBudget: 32768 } };
    } else if (options.useSearch) {
      modelName = CHAT_MODEL_SEARCH;
      tools = [{ googleSearch: {} }];
    } else if (hasImage) {
      modelName = CHAT_MODEL_COMPLEX;
    } else {
      modelName = CHAT_MODEL_FAST;
    }

    // Prepare Content
    const parts: any[] = [];

    // Add attachments
    for (const att of attachments) {
      if (att.type === 'image') {
        parts.push({
          inlineData: {
            mimeType: att.mimeType,
            data: att.data
          }
        });
      } else {
        parts.push({ text: `[Context from ${att.name}]:\n${att.data}\n` });
      }
    }

    // Add text prompt
    parts.push({ text: newMessage });

    try {
      const contents = [
        ...history.map(msg => ({
          role: msg.role,
          parts: [{ text: msg.text }] 
        })),
        {
          role: 'user',
          parts: parts
        }
      ];

      // Remove system instruction for Search grounding (sometimes conflicts or is redundant) 
      // but usually safe to keep. For Thinking, it's definitely needed.
      const config: any = {
        systemInstruction: TEACHER_SYSTEM_INSTRUCTION,
      };

      if (toolConfig) {
        Object.assign(config, toolConfig);
      }
      if (tools) {
        config.tools = tools;
      }

      // Thinking budget setting requires specific structure
      if (options.useThinking) {
         config.thinkingConfig = { thinkingBudget: 32768 };
         // config.maxOutputTokens should NOT be set when using thinking
      }

      const response = await this.ai.models.generateContent({
        model: modelName,
        contents: contents,
        config: config
      });

      const text = response.text || "I couldn't generate a response.";
      const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks as GroundingChunk[];

      return { text, groundingChunks };

    } catch (error) {
      console.error("Chat Error:", error);
      throw error;
    }
  }

  async playTextToSpeech(text: string, voiceName: string = 'Kore') {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }

    try {
      const response = await this.ai.models.generateContent({
        model: TTS_MODEL_NAME,
        contents: [{ parts: [{ text: text }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voiceName },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) throw new Error("No audio data returned");

      const audioData = base64ToUint8Array(base64Audio);
      const audioBuffer = await decodeAudioData(audioData, this.audioContext, 24000, 1);
      
      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioContext.destination);
      source.start();

    } catch (e) {
      console.error("TTS Error:", e);
      throw e;
    }
  }
}
