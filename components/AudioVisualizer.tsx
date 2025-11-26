import React, { useEffect, useRef } from 'react';

interface Props {
  analyser: AnalyserNode | null;
  isConnected: boolean;
  isSpeaking: boolean; // True if model is speaking (inferred from transcript or activity)
}

const AudioVisualizer: React.FC<Props> = ({ analyser, isConnected }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const resizeCanvas = () => {
      canvas.width = canvas.parentElement?.offsetWidth || 300;
      canvas.height = 100;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const draw = () => {
      if (!analyser || !isConnected) {
        // Idle state
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.beginPath();
        ctx.moveTo(0, canvas.height / 2);
        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.strokeStyle = '#e2e8f0'; // Slate-200
        ctx.lineWidth = 2;
        ctx.stroke();
        return;
      }

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyser.getByteTimeDomainData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.lineWidth = 3;
      
      // Gradient stroke
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
      gradient.addColorStop(0, '#3b82f6'); // Blue-500
      gradient.addColorStop(0.5, '#8b5cf6'); // Violet-500
      gradient.addColorStop(1, '#ec4899'); // Pink-500
      ctx.strokeStyle = gradient;

      ctx.beginPath();
      const sliceWidth = (canvas.width * 1.0) / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0; // 128 is zero-point for 8-bit
        const y = (v * canvas.height) / 2;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
        x += sliceWidth;
      }

      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();
      
      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [analyser, isConnected]);

  return (
    <div className="w-full h-24 bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden relative">
        {!isConnected && (
            <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-sm">
                Press Connect to Start Class
            </div>
        )}
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
};

export default AudioVisualizer;
