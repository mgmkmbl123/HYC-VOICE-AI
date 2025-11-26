import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GeminiLiveService } from '../services/geminiLiveService';
import AudioVisualizer from './AudioVisualizer';
import SettingsModal from './SettingsModal';
import { TranscriptItem, ConnectionState, AppSettings, FileContext } from '../types';
import { DEFAULT_SETTINGS } from '../constants';
import { Mic, MicOff, RefreshCw, Settings, Paperclip, X, FileText, Image as ImageIcon, FileSpreadsheet, File as FileIcon } from 'lucide-react';
import { parseFileToText } from '../utils/fileParsers';

interface VoiceModeProps {
  isActive: boolean;
}

const VoiceMode: React.FC<VoiceModeProps> = ({ isActive }) => {
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.DISCONNECTED);
  const [transcripts, setTranscripts] = useState<TranscriptItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [fileContext, setFileContext] = useState<FileContext | null>(null);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  
  const liveServiceRef = useRef<GeminiLiveService | null>(null);
  const transcriptContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize service
  useEffect(() => {
    liveServiceRef.current = new GeminiLiveService();
    return () => {
      liveServiceRef.current?.disconnect();
    };
  }, []);

  // Handle active state changes
  useEffect(() => {
    if (!isActive && connectionState !== ConnectionState.DISCONNECTED) {
      liveServiceRef.current?.disconnect();
      setConnectionState(ConnectionState.DISCONNECTED);
    }
  }, [isActive, connectionState]);

  // Auto-scroll
  useEffect(() => {
    if (transcriptContainerRef.current) {
      transcriptContainerRef.current.scrollTop = transcriptContainerRef.current.scrollHeight;
    }
  }, [transcripts]);

  const handleTranscript = useCallback((text: string, isUser: boolean, isFinal: boolean) => {
    setTranscripts(prev => {
      const newTranscripts = [...prev];
      const lastItem = newTranscripts[newTranscripts.length - 1];

      if (lastItem && lastItem.source === (isUser ? 'user' : 'model') && !lastItem.isPartial && isFinal === false) {
           return [...prev, {
               id: Date.now().toString(),
               source: isUser ? 'user' : 'model',
               text,
               timestamp: new Date(),
               isPartial: !isFinal
           }];
      } else if (lastItem && lastItem.source === (isUser ? 'user' : 'model') && lastItem.isPartial) {
        if (isFinal) {
             lastItem.text = text;
             lastItem.isPartial = false;
             return [...newTranscripts];
        } else {
             lastItem.text = text;
             return [...newTranscripts];
        }
      } else {
         if (!text.trim()) return prev;
         return [...prev, {
            id: Date.now().toString(),
            source: isUser ? 'user' : 'model',
            text,
            timestamp: new Date(),
            isPartial: !isFinal
         }];
      }
    });
  }, []);

  const toggleConnection = async () => {
    if (connectionState === ConnectionState.CONNECTED || connectionState === ConnectionState.CONNECTING) {
      liveServiceRef.current?.disconnect();
      setConnectionState(ConnectionState.DISCONNECTED);
      return;
    }

    setConnectionState(ConnectionState.CONNECTING);
    setError(null);

    await liveServiceRef.current?.connect(
      settings,
      fileContext,
      handleTranscript,
      (err) => {
        setError(err.message);
        setConnectionState(ConnectionState.ERROR);
      },
      () => {
        setConnectionState(ConnectionState.DISCONNECTED);
      }
    );
    
    setConnectionState(ConnectionState.CONNECTED);
  };

  const clearTranscripts = () => {
      setTranscripts([]);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (connectionState === ConnectionState.CONNECTED) {
      liveServiceRef.current?.disconnect();
      setConnectionState(ConnectionState.DISCONNECTED);
      setError("Session restarted to apply new file.");
    }

    setIsProcessingFile(true);
    setError(null);

    try {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const base64String = event.target?.result as string;
          const data = base64String.split(',')[1];
          setFileContext({
            name: file.name,
            type: 'image',
            data: data,
            mimeType: file.type
          });
          setIsProcessingFile(false);
        };
        reader.readAsDataURL(file);
      } else {
        const text = await parseFileToText(file);
        setFileContext({
          name: file.name,
          type: 'text',
          data: text,
          mimeType: 'text/plain'
        });
        setIsProcessingFile(false);
      }
    } catch (err) {
      console.error("Error reading file", err);
      setError("Failed to read file.");
      setIsProcessingFile(false);
    }
    
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = () => {
    setFileContext(null);
    if (connectionState === ConnectionState.CONNECTED) {
      liveServiceRef.current?.disconnect();
      setConnectionState(ConnectionState.DISCONNECTED);
      setError("Session ended. Start class again without file context.");
    }
  };

  const getFileIcon = (name: string) => {
    const ext = name.split('.').pop()?.toLowerCase();
    if (['jpg', 'png', 'webp', 'jpeg'].includes(ext || '')) return <ImageIcon size={14} />;
    if (['xls', 'xlsx', 'csv'].includes(ext || '')) return <FileSpreadsheet size={14} />;
    if (['pdf', 'doc', 'docx'].includes(ext || '')) return <FileText size={14} />;
    return <FileIcon size={14} />;
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
        
        {/* Visualizer Header */}
        <div className="bg-white p-6 border-b border-slate-100 relative shadow-sm z-10">
           <div className="flex justify-between items-center mb-4">
             <div>
                <h2 className="text-xl font-bold text-slate-800">Voice Class</h2>
                <p className="text-sm text-slate-500">Live conversation with Gemini 2.5</p>
             </div>
             <div className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-2 ${
                connectionState === ConnectionState.CONNECTED 
                ? 'bg-green-100 text-green-700 border border-green-200'
                : connectionState === ConnectionState.CONNECTING
                ? 'bg-yellow-100 text-yellow-700 border border-yellow-200'
                : 'bg-slate-100 text-slate-500 border border-slate-200'
            }`}>
                <span className={`w-2 h-2 rounded-full ${
                    connectionState === ConnectionState.CONNECTED ? 'bg-green-500 animate-pulse' : 
                    connectionState === ConnectionState.CONNECTING ? 'bg-yellow-500 animate-bounce' : 'bg-slate-400'
                }`}></span>
                {connectionState === ConnectionState.CONNECTED ? 'Live' : 
                 connectionState === ConnectionState.CONNECTING ? 'Connecting...' : 'Offline'}
            </div>
           </div>

           <AudioVisualizer 
              analyser={liveServiceRef.current?.getOutputAnalyser() || null} 
              isConnected={connectionState === ConnectionState.CONNECTED} 
              isSpeaking={false} 
           />
           
           <button 
              onClick={() => setIsSettingsOpen(true)}
              className="absolute top-6 right-6 p-2 bg-white hover:bg-slate-50 text-slate-400 hover:text-indigo-600 rounded-full border border-slate-200 transition-colors"
              title="Settings"
              disabled={connectionState === ConnectionState.CONNECTED} 
           >
              <Settings size={20} />
           </button>
        </div>

        {/* Transcript Area */}
        <div 
          ref={transcriptContainerRef}
          className="flex-grow overflow-y-auto p-6 space-y-4 bg-slate-50/50"
        >
          {transcripts.length === 0 && !fileContext && (
            <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 p-8 opacity-60">
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-4 shadow-sm text-indigo-300">
                    <Mic size={32} />
                </div>
                <p className="text-sm font-medium text-slate-500">Ready to start?</p>
                <p className="text-xs">Click "Start Class" to begin talking.</p>
            </div>
          )}

          {fileContext && (
            <div className="flex justify-center mb-4">
              <div className="bg-white border border-indigo-100 text-indigo-700 px-3 py-1.5 rounded-full text-sm flex items-center gap-2 shadow-sm">
                {getFileIcon(fileContext.name)}
                <span className="max-w-[150px] truncate font-medium">{fileContext.name}</span>
                <button onClick={removeFile} className="hover:bg-indigo-50 p-0.5 rounded-full"><X size={14} /></button>
              </div>
            </div>
          )}

          {transcripts.map((msg) => (
            <div key={msg.id} className={`flex w-full ${msg.source === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-5 py-3 text-sm leading-relaxed shadow-sm ${
                  msg.source === 'user' 
                    ? 'bg-indigo-600 text-white rounded-tr-none' 
                    : 'bg-white text-slate-800 rounded-tl-none border border-slate-200'
                } ${msg.isPartial ? 'opacity-70' : 'opacity-100'}`}>
                <p className="whitespace-pre-wrap">{msg.text}</p>
                {msg.isPartial && <span className="inline-block w-1.5 h-1.5 bg-current rounded-full ml-1 animate-pulse"/>}
              </div>
            </div>
          ))}
          
          {error && (
            <div className="w-full bg-red-50 text-red-600 p-3 rounded-lg text-sm text-center border border-red-100 mt-4">
              {error}
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="p-4 bg-white border-t border-slate-100 flex justify-between items-center gap-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
            <div className="flex gap-2">
                <button 
                    onClick={clearTranscripts}
                    className="p-3 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors border border-slate-200"
                >
                    <RefreshCw size={20} />
                </button>
                
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept=".txt,.md,.json,.csv,.pdf,.docx,.doc,.xlsx,.xls,image/png,image/jpeg,image/webp"
                    onChange={handleFileSelect}
                />
                <button 
                    onClick={() => !isProcessingFile && fileInputRef.current?.click()}
                    disabled={isProcessingFile}
                    className={`p-3 rounded-full transition-colors border ${
                        fileContext 
                        ? 'bg-indigo-50 text-indigo-600 border-indigo-200' 
                        : 'bg-white text-slate-400 hover:text-slate-600 hover:bg-slate-100 border-slate-200'
                    }`}
                >
                    {isProcessingFile ? <div className="w-5 h-5 border-2 border-slate-300 border-t-indigo-600 rounded-full animate-spin"></div> : <Paperclip size={20} />}
                </button>
            </div>

            <button
                onClick={toggleConnection}
                disabled={connectionState === ConnectionState.CONNECTING || isProcessingFile}
                className={`flex-grow flex items-center justify-center gap-3 px-6 py-3 rounded-full font-bold shadow-md transition-all transform active:scale-95 ${
                    connectionState === ConnectionState.CONNECTED 
                    ? 'bg-red-500 hover:bg-red-600 text-white shadow-red-200' 
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200'
                }`}
            >
                {connectionState === ConnectionState.CONNECTED ? <MicOff size={20} /> : <Mic size={20} />}
                {connectionState === ConnectionState.CONNECTED ? 'End Class' : 'Start Class'}
            </button>
        </div>

        <SettingsModal 
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          currentSettings={settings}
          onSave={setSettings}
        />
    </div>
  );
};

export default VoiceMode;
