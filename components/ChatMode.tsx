import React, { useState, useRef, useEffect } from 'react';
import { Send, Image as ImageIcon, X, Zap, Loader2, Sparkles, Globe, BrainCircuit, Volume2, ExternalLink } from 'lucide-react';
import { ChatMessage, FileContext } from '../types';
import { ChatService } from '../services/chatService';

const ChatMode: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [attachments, setAttachments] = useState<FileContext[]>([]);
  
  // Feature Toggles
  const [useSearch, setUseSearch] = useState(false);
  const [useThinking, setUseThinking] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState<string | null>(null);

  const chatServiceRef = useRef(new ChatService());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if ((!inputText.trim() && attachments.length === 0) || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: inputText,
      timestamp: new Date(),
      attachments: [...attachments]
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setAttachments([]);
    setIsLoading(true);

    try {
      const response = await chatServiceRef.current.sendMessage(
        messages, 
        userMessage.text, 
        userMessage.attachments,
        { useSearch, useThinking }
      );
      
      const botMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: response.text,
        timestamp: new Date(),
        groundingChunks: response.groundingChunks
      };
      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'model',
        text: "I'm sorry, I encountered an error. Please try again.",
        timestamp: new Date(),
        isError: true
      }]);
    } finally {
      setIsLoading(false);
      // Reset special modes after use? Optional. Let's keep them persistent for the session or until toggled off.
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    if (!file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64String = event.target?.result as string;
      const data = base64String.split(',')[1];
      setAttachments(prev => [...prev, {
        name: file.name,
        type: 'image',
        data: data,
        mimeType: file.type
      }]);
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const playTTS = async (text: string, id: string) => {
    if (isPlayingAudio) return;
    setIsPlayingAudio(id);
    try {
      await chatServiceRef.current.playTextToSpeech(text);
    } catch (e) {
      console.error("Failed to play audio", e);
    } finally {
      setIsPlayingAudio(null);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      
      {/* Header */}
      <div className="bg-white p-6 border-b border-slate-100 shadow-sm">
        <h2 className="text-xl font-bold text-slate-800">Study Buddy</h2>
        <p className="text-sm text-slate-500">Ask questions, analyze images, and get help fast.</p>
        <div className="mt-2 flex gap-2 flex-wrap">
             {!useSearch && !useThinking && (
                <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded border border-indigo-100 flex items-center gap-1 animate-in fade-in">
                    <Zap size={10} /> Fast Chat
                </span>
             )}
             {useSearch && (
                <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded border border-blue-100 flex items-center gap-1 animate-in fade-in">
                    <Globe size={10} /> Web Search
                </span>
             )}
             {useThinking && (
                <span className="text-xs bg-teal-50 text-teal-700 px-2 py-1 rounded border border-teal-100 flex items-center gap-1 animate-in fade-in">
                    <BrainCircuit size={10} /> Deep Thinking
                </span>
             )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-grow overflow-y-auto p-6 space-y-6 bg-slate-50/50">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 opacity-60">
            <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mb-4 shadow-sm text-indigo-300 transform rotate-3">
              <Sparkles size={32} />
            </div>
            <p className="text-sm font-medium text-slate-500">How can I help you today?</p>
            <p className="text-xs mt-1">Try toggling <Globe size={12} className="inline"/> Search or <BrainCircuit size={12} className="inline"/> Thinking for complex topics.</p>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] space-y-2`}>
              {msg.attachments && msg.attachments.length > 0 && (
                  <div className={`flex flex-wrap gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      {msg.attachments.map((att, i) => (
                          <div key={i} className="rounded-lg overflow-hidden border border-slate-200 shadow-sm w-32 h-32 relative">
                              <img 
                                src={`data:${att.mimeType};base64,${att.data}`} 
                                alt={att.name} 
                                className="w-full h-full object-cover"
                              />
                          </div>
                      ))}
                  </div>
              )}
              
              <div className={`relative group rounded-2xl px-5 py-3 text-sm leading-relaxed shadow-sm ${
                msg.role === 'user' 
                  ? 'bg-indigo-600 text-white rounded-tr-none' 
                  : msg.isError 
                  ? 'bg-red-50 text-red-600 border border-red-100'
                  : 'bg-white text-slate-800 rounded-tl-none border border-slate-200'
              }`}>
                <p className="whitespace-pre-wrap">{msg.text}</p>
                
                {/* Grounding Sources */}
                {msg.groundingChunks && msg.groundingChunks.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-100">
                        <p className="text-xs font-semibold text-slate-500 mb-1 flex items-center gap-1">
                            <Globe size={10} /> Sources
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {msg.groundingChunks.map((chunk, i) => chunk.web?.uri && (
                                <a 
                                    key={i} 
                                    href={chunk.web.uri} 
                                    target="_blank" 
                                    rel="noreferrer"
                                    className="text-xs bg-slate-50 hover:bg-slate-100 text-indigo-600 px-2 py-1 rounded border border-slate-200 flex items-center gap-1 transition-colors"
                                >
                                    {chunk.web.title || new URL(chunk.web.uri).hostname}
                                    <ExternalLink size={8} />
                                </a>
                            ))}
                        </div>
                    </div>
                )}

                {/* TTS Button for Model */}
                {msg.role === 'model' && !msg.isError && (
                    <button 
                        onClick={() => playTTS(msg.text, msg.id)}
                        disabled={isPlayingAudio !== null}
                        className={`absolute -bottom-8 left-0 p-1.5 rounded-full text-slate-400 hover:text-indigo-600 hover:bg-slate-100 transition-colors opacity-0 group-hover:opacity-100 ${isPlayingAudio === msg.id ? 'opacity-100 text-indigo-600' : ''}`}
                        title="Read Aloud"
                    >
                        {isPlayingAudio === msg.id ? <Loader2 size={16} className="animate-spin" /> : <Volume2 size={16} />}
                    </button>
                )}
              </div>
            </div>
          </div>
        ))}
        
        {isLoading && (
            <div className="flex w-full justify-start">
                <div className="bg-white px-4 py-3 rounded-2xl rounded-tl-none border border-slate-200 shadow-sm flex items-center gap-3">
                    <div className="flex gap-1">
                        <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                        <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                        <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                    </div>
                    <span className="text-xs text-slate-400 font-medium">
                        {useThinking ? 'Thinking deeply...' : useSearch ? 'Searching web...' : 'Typing...'}
                    </span>
                </div>
            </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-slate-100 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        {attachments.length > 0 && (
            <div className="flex gap-2 mb-3 overflow-x-auto pb-2">
                {attachments.map((att, i) => (
                    <div key={i} className="relative group">
                        <div className="w-16 h-16 rounded-lg overflow-hidden border border-slate-200">
                             <img src={`data:${att.mimeType};base64,${att.data}`} className="w-full h-full object-cover" />
                        </div>
                        <button 
                           onClick={() => removeAttachment(i)}
                           className="absolute -top-1 -right-1 bg-white rounded-full p-0.5 shadow-md text-slate-500 hover:text-red-500"
                        >
                            <X size={12} />
                        </button>
                    </div>
                ))}
            </div>
        )}
        
        <div className="flex flex-col gap-2">
            {/* Toolbar */}
            <div className="flex items-center gap-2 px-1">
                <button
                    onClick={() => {
                        setUseSearch(!useSearch);
                        if (!useSearch) setUseThinking(false); // Mutually exclusive usually, or prioritize logic
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                        useSearch 
                        ? 'bg-blue-50 text-blue-700 border-blue-200' 
                        : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                    }`}
                >
                    <Globe size={12} /> Search
                </button>
                <button
                    onClick={() => {
                        setUseThinking(!useThinking);
                        if (!useThinking) setUseSearch(false);
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                        useThinking 
                        ? 'bg-teal-50 text-teal-700 border-teal-200' 
                        : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                    }`}
                >
                    <BrainCircuit size={12} /> Deep Think
                </button>
            </div>

            {/* Input Bar */}
            <div className="flex items-end gap-2">
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleFileSelect}
                />
                <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="p-3 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors mb-0.5"
                    title="Attach Image"
                >
                    <ImageIcon size={20} />
                </button>
                <textarea
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendMessage();
                        }
                    }}
                    placeholder={useThinking ? "Ask a complex question..." : useSearch ? "Ask for recent info..." : "Ask a question..."}
                    className="flex-grow bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none max-h-32 min-h-[48px]"
                    rows={1}
                />
                <button
                    onClick={handleSendMessage}
                    disabled={(!inputText.trim() && attachments.length === 0) || isLoading}
                    className={`p-3 text-white rounded-xl shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all mb-0.5 ${
                        useThinking ? 'bg-teal-600 hover:bg-teal-700' : 
                        useSearch ? 'bg-blue-600 hover:bg-blue-700' :
                        'bg-indigo-600 hover:bg-indigo-700'
                    }`}
                >
                    {isLoading ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                </button>
            </div>
        </div>
      </div>

    </div>
  );
};

export default ChatMode;