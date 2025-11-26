import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { LIVE_MODEL_NAME as MODEL_NAME, TEACHER_SYSTEM_INSTRUCTION } from '../constants';
import { createPcmBlob, decodeAudioData, base64ToUint8Array } from '../utils/audioUtils';
import { AppSettings, FileContext } from '../types';

export type TranscriptCallback = (text: string, isUser: boolean, isFinal: boolean) => void;
export type ErrorCallback = (error: Error) => void;
export type CloseCallback = () => void;

export class GeminiLiveService {
  private ai: GoogleGenAI;
  private inputAudioContext: AudioContext | null = null;
  private outputAudioContext: AudioContext | null = null;
  private inputSource: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private outputNode: GainNode | null = null;
  private nextStartTime: number = 0;
  private stream: MediaStream | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private sessionPromise: Promise<any> | null = null;
  private isConnected: boolean = false;
  
  // Track transcription state
  private currentInputTranscription = '';
  private currentOutputTranscription = '';

  // Analyser for visualization
  public outputAnalyser: AnalyserNode | null = null;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  public async connect(
    settings: AppSettings,
    fileContext: FileContext | null,
    onTranscript: TranscriptCallback,
    onError: ErrorCallback,
    onClose: CloseCallback
  ) {
    if (this.isConnected) return;

    try {
      // 1. Initialize Audio Contexts
      this.inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      this.outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      
      // Setup output path for speaker
      this.outputNode = this.outputAudioContext.createGain();
      this.outputAnalyser = this.outputAudioContext.createAnalyser();
      this.outputAnalyser.fftSize = 256;
      this.outputNode.connect(this.outputAnalyser);
      this.outputAnalyser.connect(this.outputAudioContext.destination);

      // 2. Get Microphone Stream with Fallback
      try {
        const constraints: MediaStreamConstraints = {
          audio: settings.deviceId !== 'default' 
            ? { deviceId: { exact: settings.deviceId } } 
            : true
        };
        this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err) {
        console.warn(`Failed to get specific device ${settings.deviceId}, falling back to default.`, err);
        // Fallback to default audio device if specific one fails
        this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }

      // 3. Prepare System Instructions
      let systemInstruction = TEACHER_SYSTEM_INSTRUCTION;
      
      // Apply Rate
      if (settings.speakingRate === 'slow') {
        systemInstruction += '\n\nPlease speak slowly and clearly.';
      } else if (settings.speakingRate === 'fast') {
        systemInstruction += '\n\nPlease speak at a brisk pace.';
      }

      // Apply File Context (Text)
      if (fileContext && fileContext.type === 'text') {
        systemInstruction += `\n\n[USER UPLOADED FILE CONTEXT: ${fileContext.name}]\n${fileContext.data}\n[END OF FILE CONTEXT]\n\nThe user has uploaded this file. Use this information to answer their questions.`;
      }

      // 4. Connect to Gemini Live
      this.sessionPromise = this.ai.live.connect({
        model: MODEL_NAME,
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: systemInstruction,
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: settings.voiceName } },
          },
          inputAudioTranscription: { model: MODEL_NAME }, // Enable user transcription
          outputAudioTranscription: { model: MODEL_NAME }, // Enable model transcription
        },
        callbacks: {
          onopen: () => {
            console.log('Gemini Live Connected');
            this.isConnected = true;
            
            // If Image Context, send it immediately
            if (fileContext && fileContext.type === 'image') {
               this.sessionPromise?.then(session => {
                  session.sendRealtimeInput({
                    media: {
                      mimeType: fileContext.mimeType,
                      data: fileContext.data
                    }
                  });
                  console.log('Sent image context');
               });
            }

            this.startAudioInput();
          },
          onmessage: async (message: LiveServerMessage) => {
             this.handleMessage(message, onTranscript);
          },
          onerror: (e: ErrorEvent) => {
            console.error('Gemini Live Error', e);
            onError(new Error('Connection error occurred.'));
            this.disconnect();
          },
          onclose: (e: CloseEvent) => {
            console.log('Gemini Live Closed', e);
            this.isConnected = false;
            onClose();
          },
        },
      });

    } catch (error) {
      onError(error instanceof Error ? error : new Error('Failed to connect'));
      this.disconnect();
    }
  }

  private startAudioInput() {
    if (!this.inputAudioContext || !this.stream || !this.sessionPromise) return;

    this.inputSource = this.inputAudioContext.createMediaStreamSource(this.stream);
    // Use ScriptProcessor for raw PCM access (standard for this API usage)
    this.processor = this.inputAudioContext.createScriptProcessor(4096, 1, 1);

    this.processor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);
      const pcmBlob = createPcmBlob(inputData);
      
      this.sessionPromise?.then((session) => {
        session.sendRealtimeInput({ media: pcmBlob });
      });
    };

    this.inputSource.connect(this.processor);
    this.processor.connect(this.inputAudioContext.destination);
  }

  private async handleMessage(message: LiveServerMessage, onTranscript: TranscriptCallback) {
    // 1. Handle Audio Output
    const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
    if (base64Audio && this.outputAudioContext && this.outputNode) {
      try {
        const audioData = base64ToUint8Array(base64Audio);
        const audioBuffer = await decodeAudioData(audioData, this.outputAudioContext, 24000, 1);
        
        // Schedule playback
        this.nextStartTime = Math.max(this.nextStartTime, this.outputAudioContext.currentTime);
        const source = this.outputAudioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(this.outputNode); // Connect to gain->analyser->dest
        source.start(this.nextStartTime);
        this.nextStartTime += audioBuffer.duration;
      } catch (err) {
        console.error("Error decoding audio", err);
      }
    }

    // 2. Handle Transcription
    const serverContent = message.serverContent;
    if (serverContent) {
      if (serverContent.modelTurn?.parts?.[0]?.text) {
         // Sometimes text comes directly in modelTurn (rare in audio mode but possible)
      }

      if (serverContent.outputTranscription) {
        const text = serverContent.outputTranscription.text;
        this.currentOutputTranscription += text;
        onTranscript(this.currentOutputTranscription, false, false); // Partial model
      }
      
      if (serverContent.inputTranscription) {
        const text = serverContent.inputTranscription.text;
        this.currentInputTranscription += text;
        onTranscript(this.currentInputTranscription, true, false); // Partial user
      }

      if (serverContent.turnComplete) {
        // Finalize transcripts
        if (this.currentInputTranscription.trim()) {
          onTranscript(this.currentInputTranscription, true, true);
          this.currentInputTranscription = '';
        }
        if (this.currentOutputTranscription.trim()) {
          onTranscript(this.currentOutputTranscription, false, true);
          this.currentOutputTranscription = '';
        }
        
        // Reset audio timing slightly to prevent drift if there was a pause
        if (this.outputAudioContext) {
           this.nextStartTime = Math.max(this.nextStartTime, this.outputAudioContext.currentTime);
        }
      }
    }
  }

  public disconnect() {
    this.isConnected = false;
    
    // Stop tracks
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    // Disconnect audio nodes
    this.processor?.disconnect();
    this.inputSource?.disconnect();
    
    // Close audio contexts
    this.inputAudioContext?.close();
    this.outputAudioContext?.close();
    
    this.inputAudioContext = null;
    this.outputAudioContext = null;

    // We can't explicitly close the session object easily without the reference from the promise
    // but the `onclose` callback handles cleanup state. 
    this.sessionPromise?.then(session => {
        // session.close() // If available in SDK
    });
    this.sessionPromise = null;
  }
  
  public getOutputAnalyser(): AnalyserNode | null {
      return this.outputAnalyser;
  }
}