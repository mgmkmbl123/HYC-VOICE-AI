import React, { useEffect, useState } from 'react';
import { X, Mic, Volume2, Gauge } from 'lucide-react';
import { AppSettings } from '../types';
import { VOICES } from '../constants';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSettings: AppSettings;
  onSave: (settings: AppSettings) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, currentSettings, onSave }) => {
  const [settings, setSettings] = useState<AppSettings>(currentSettings);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);

  useEffect(() => {
    setSettings(currentSettings);
  }, [currentSettings, isOpen]);

  useEffect(() => {
    if (isOpen) {
      loadAudioDevices();
    }
  }, [isOpen]);

  const loadAudioDevices = async () => {
    setLoadingDevices(true);
    try {
      // Request permission briefly if we don't have it, to get labels
      // Note: This might trigger a prompt if not already granted.
      // If we are already connected, we have permission.
      const devices = await navigator.mediaDevices.enumerateDevices();
      const inputDevices = devices.filter(d => d.kind === 'audioinput');
      setAudioDevices(inputDevices);
    } catch (err) {
      console.error('Error loading devices:', err);
    } finally {
      setLoadingDevices(false);
    }
  };

  const handleSave = () => {
    onSave(settings);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-800">Classroom Settings</h2>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          
          {/* Input Device */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <Mic size={16} className="text-indigo-600" />
              Microphone
            </label>
            <div className="relative">
              <select
                value={settings.deviceId}
                onChange={(e) => setSettings({ ...settings, deviceId: e.target.value })}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none appearance-none"
                disabled={loadingDevices}
              >
                <option value="default">Default Microphone</option>
                {audioDevices.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `Microphone ${device.deviceId.slice(0, 5)}...`}
                  </option>
                ))}
              </select>
            </div>
            {audioDevices.length === 0 && !loadingDevices && (
               <p className="text-xs text-amber-600">
                 Note: Start the class once to grant microphone permission, then settings will show your devices.
               </p>
            )}
          </div>

          {/* Voice Selection */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <Volume2 size={16} className="text-indigo-600" />
              Teacher's Voice
            </label>
            <div className="grid grid-cols-2 gap-2">
              {VOICES.map((voice) => (
                <button
                  key={voice.name}
                  onClick={() => setSettings({ ...settings, voiceName: voice.name })}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    settings.voiceName === voice.name
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700 ring-1 ring-indigo-500'
                      : 'border-slate-200 hover:border-slate-300 text-slate-600'
                  }`}
                >
                  <div className="font-medium text-sm">{voice.name}</div>
                  <div className="text-xs opacity-70">{voice.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Speaking Rate */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <Gauge size={16} className="text-indigo-600" />
              Speaking Pace
            </label>
            <div className="flex bg-slate-100 p-1 rounded-lg">
              {(['slow', 'normal', 'fast'] as const).map((rate) => (
                <button
                  key={rate}
                  onClick={() => setSettings({ ...settings, speakingRate: rate })}
                  className={`flex-1 py-1.5 text-sm font-medium rounded-md capitalize transition-all ${
                    settings.speakingRate === rate
                      ? 'bg-white text-indigo-600 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {rate}
                </button>
              ))}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors"
          >
            Save Changes
          </button>
        </div>

      </div>
    </div>
  );
};

export default SettingsModal;
