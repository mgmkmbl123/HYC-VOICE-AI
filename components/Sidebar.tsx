import React from 'react';
import { Mic, MessageSquare, Video, GraduationCap } from 'lucide-react';
import { AppMode } from '../types';

interface SidebarProps {
  currentMode: AppMode;
  onModeChange: (mode: AppMode) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentMode, onModeChange }) => {
  const menuItems = [
    { id: 'voice' as AppMode, label: 'Voice Class', icon: Mic, desc: 'Live Conversation' },
    { id: 'chat' as AppMode, label: 'Study Buddy', icon: MessageSquare, desc: 'Text & Analysis' },
    { id: 'video' as AppMode, label: 'Creative Lab', icon: Video, desc: 'Animate Ideas' },
  ];

  return (
    <div className="w-full md:w-64 bg-white border-r border-slate-200 flex-shrink-0 flex flex-col h-full">
      <div className="p-6 border-b border-slate-100 flex items-center gap-3">
        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-md">
          <GraduationCap size={20} />
        </div>
        <span className="font-bold text-slate-800 text-lg tracking-tight">GuruVoice</span>
      </div>

      <nav className="flex-1 p-4 space-y-2">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onModeChange(item.id)}
            className={`w-full flex items-center gap-4 p-3 rounded-xl transition-all duration-200 group ${
              currentMode === item.id
                ? 'bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-100'
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <div className={`p-2 rounded-lg transition-colors ${
              currentMode === item.id ? 'bg-white text-indigo-600 shadow-sm' : 'bg-slate-100 text-slate-500 group-hover:bg-white group-hover:text-slate-700'
            }`}>
              <item.icon size={20} />
            </div>
            <div className="text-left">
              <div className="font-semibold text-sm">{item.label}</div>
              <div className="text-xs opacity-70 font-medium">{item.desc}</div>
            </div>
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-100">
        <div className="bg-slate-50 rounded-xl p-4 text-xs text-slate-500">
          <p className="font-semibold text-slate-700 mb-1">Student Dashboard</p>
          <p>Switch modes to access different AI tools.</p>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
