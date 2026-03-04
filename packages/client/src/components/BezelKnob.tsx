interface BezelKnobProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}

export function BezelKnob({ label, value, min, max, step = 0.01, onChange }: BezelKnobProps) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '4px',
      userSelect: 'none',
    }}>
      <span style={{
        fontSize: '0.55rem',
        color: 'var(--color-dim)',
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
      }}>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{
          writingMode: 'vertical-lr',
          direction: 'rtl',
          height: '80px',
          width: '20px',
          cursor: 'pointer',
          accentColor: 'var(--color-primary)',
          background: 'transparent',
        }}
      />
      <span style={{
        fontSize: '0.55rem',
        color: 'var(--color-primary)',
        letterSpacing: '0.05em',
      }}>{typeof value === 'number' ? value.toFixed(step < 1 ? 1 : 0) : value}</span>
    </div>
  );
}
