export interface TranscriptItem {
  id: string;
  source: 'user' | 'model';
  text: string;
  timestamp: Date;
  isPartial?: boolean;
}

export enum ConnectionState {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  ERROR = 'ERROR',
}

export interface AudioVisualizerProps {
  stream: MediaStream | null;
  isListening: boolean;
  analyser?: AnalyserNode;
}

export interface AppSettings {
  voiceName: string;
  deviceId: string;
  speakingRate: 'slow' | 'normal' | 'fast';
}

export interface FileContext {
  name: string;
  type: 'image' | 'text' | 'pdf' | 'doc' | 'excel';
  data: string; // base64 (without prefix) for image, raw string for text
  mimeType: string;
}

export type AppMode = 'voice' | 'chat' | 'video';

export interface GroundingChunk {
  web?: {
    uri: string;
    title: string;
  };
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
  attachments?: FileContext[];
  isError?: boolean;
  groundingChunks?: GroundingChunk[];
}

export interface GeneratedVideo {
  uri: string;
  expiryTime?: string;
}
