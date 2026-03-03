import { useRef, useCallback } from 'react';

interface BezelKnobProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}

export function BezelKnob({ label, value, min, max, onChange }: BezelKnobProps) {
  const startY = useRef(0);
  const startVal = useRef(0);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    startY.current = e.clientY;
    startVal.current = value;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [value]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!e.buttons) return;
    const delta = (startY.current - e.clientY) / 100;
    const range = max - min;
    const newVal = Math.max(min, Math.min(max, startVal.current + delta * range));
    onChange(newVal);
  }, [min, max, onChange]);

  const rotation = ((value - min) / (max - min)) * 270 - 135;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        style={{
          width: 28, height: 28, borderRadius: '50%',
          background: 'linear-gradient(135deg, #3a3a3a, #1a1a1a)',
          border: '2px solid #555', cursor: 'ns-resize',
          transform: `rotate(${rotation}deg)`, position: 'relative',
        }}
      >
        <div style={{
          position: 'absolute', top: 2, left: '50%', width: 2, height: 8,
          background: '#FFB000', transform: 'translateX(-50%)',
        }} />
      </div>
      <span style={{ fontSize: '0.5rem', color: '#666', letterSpacing: '0.1em' }}>{label}</span>
    </div>
  );
}
