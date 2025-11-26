import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import VoiceMode from './components/VoiceMode';
import ChatMode from './components/ChatMode';
import VideoMode from './components/VideoMode';
import { AppMode } from './types';

const App: React.FC = () => {
  const [currentMode, setCurrentMode] = useState<AppMode>('voice');

  return (
    <div className="h-screen w-full bg-slate-50 flex overflow-hidden font-sans">
      
      {/* Sidebar Navigation */}
      <Sidebar 
        currentMode={currentMode} 
        onModeChange={setCurrentMode} 
      />

      {/* Main Content Area */}
      <main className="flex-1 h-full overflow-hidden relative flex flex-col">
        
        {/* Render Active Mode */}
        <div className="flex-1 h-full overflow-hidden relative">
          
          {/* Voice Mode */}
          <div className={`absolute inset-0 transition-opacity duration-300 ${currentMode === 'voice' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
            <VoiceMode isActive={currentMode === 'voice'} />
          </div>

          {/* Chat Mode */}
          {currentMode === 'chat' && (
             <div className="absolute inset-0 z-10 animate-in fade-in duration-300">
                <ChatMode />
             </div>
          )}

          {/* Video Mode */}
          {currentMode === 'video' && (
            <div className="absolute inset-0 z-10 animate-in fade-in duration-300">
               <VideoMode />
            </div>
          )}
          
        </div>

      </main>
    </div>
  );
};

export default App;
