import React, { useRef, useEffect, useState, useCallback } from 'react';
import { FREQUENCY_MATCH_THRESHOLD } from '@void-sector/shared';

interface Props {
  onComplete: (matched: boolean) => void;
  onCancel: () => void;
}

function drawSineWave(
  ctx: CanvasRenderingContext2D,
  width: number,
  y: number,
  freq: number,
  amp: number,
) {
  ctx.beginPath();
  for (let x = 0; x < width; x++) {
    const val = Math.sin((x / width) * freq * Math.PI * 2) * amp * 0.4;
    if (x === 0) ctx.moveTo(x, y + val);
    else ctx.lineTo(x, y + val);
  }
  ctx.stroke();
}

export const FrequencyMinigame: React.FC<Props> = ({ onComplete, onCancel }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [playerFreq, setPlayerFreq] = useState(2.0);
  const targetFreq = useRef(3.5 + Math.random() * 3); // 3.5-6.5 Hz
  const [matchPercent, setMatchPercent] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Scanlines
    ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
    for (let y = 0; y < canvas.height; y += 3) {
      ctx.fillRect(0, y, canvas.width, 1);
    }

    // Target wave (green/dim)
    ctx.strokeStyle = 'rgba(0, 255, 100, 0.4)';
    ctx.lineWidth = 2;
    drawSineWave(ctx, canvas.width, canvas.height / 2 - 20, targetFreq.current, canvas.height / 4);

    // Player wave (amber)
    ctx.strokeStyle = '#FFB000';
    ctx.lineWidth = 2;
    drawSineWave(ctx, canvas.width, canvas.height / 2 + 20, playerFreq, canvas.height / 4);

    const match = 1 - Math.abs(playerFreq - targetFreq.current) / targetFreq.current;
    setMatchPercent(Math.max(0, Math.min(1, match)));
  }, [playerFreq]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') setPlayerFreq((f) => Math.max(0.5, f - 0.1));
      if (e.key === 'ArrowRight') setPlayerFreq((f) => Math.min(10, f + 0.1));
      if (e.key === 'Enter' && matchPercent >= FREQUENCY_MATCH_THRESHOLD) onComplete(true);
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [matchPercent, onComplete, onCancel]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    setPlayerFreq((f) => {
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      return Math.max(0.5, Math.min(10, f + delta));
    });
  }, []);

  const handleSliderChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setPlayerFreq(parseFloat(e.target.value));
  }, []);

  return (
    <div
      style={{
        background: 'rgba(5, 5, 5, 0.95)',
        border: '1px solid rgba(255, 176, 0, 0.4)',
        padding: 12,
      }}
    >
      <div
        style={{
          color: '#FFB000',
          textAlign: 'center',
          marginBottom: 8,
          letterSpacing: '0.2em',
          fontSize: '0.85rem',
        }}
      >
        GATE FREQUENCY LOCK
      </div>
      <canvas
        ref={canvasRef}
        width={280}
        height={120}
        onWheel={handleWheel}
        style={{ border: '1px solid rgba(255,176,0,0.2)', display: 'block', margin: '0 auto' }}
      />
      <input
        type="range"
        min="0.5"
        max="10"
        step="0.1"
        value={playerFreq}
        onChange={handleSliderChange}
        aria-label="Frequency tuner"
        className="frequency-slider"
        style={{
          display: 'block',
          width: '280px',
          margin: '8px auto 0',
          accentColor: '#FFB000',
          height: '44px',
          cursor: 'pointer',
        }}
      />
      <div style={{ textAlign: 'center', marginTop: 8, fontSize: '0.8rem' }}>
        <span style={{ color: matchPercent >= FREQUENCY_MATCH_THRESHOLD ? '#00FF88' : '#FFB000' }}>
          MATCH: {Math.floor(matchPercent * 100)}%
        </span>
        {matchPercent >= FREQUENCY_MATCH_THRESHOLD && (
          <span style={{ color: '#00FF88' }}> — LOCK ACQUIRED [ENTER]</span>
        )}
      </div>
      <div style={{ fontSize: '0.65rem', textAlign: 'center', opacity: 0.4, marginTop: 4 }}>
        SLIDE / ← → / MOUSEWHEEL to tune | ESC to cancel
      </div>
    </div>
  );
};
