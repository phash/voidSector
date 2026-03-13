// packages/client/src/components/overlays/AreaScanSummaryOverlay.tsx
import { useEffect } from 'react';
import { useStore } from '../../state/store';

export function AreaScanSummaryOverlay() {
  const summary = useStore((s) => s.areaScanSummary);
  const setAreaScanSummary = useStore((s) => s.setAreaScanSummary);

  useEffect(() => {
    if (!summary) return;
    const timer = setTimeout(() => setAreaScanSummary(null), 5000);
    return () => clearTimeout(timer);
  }, [summary, setAreaScanSummary]);

  if (!summary) return null;

  return (
    <div
      onClick={() => setAreaScanSummary(null)}
      style={{
        position: 'fixed',
        bottom: 80,
        right: 16,
        zIndex: 9200,
        background: '#080808',
        border: '1px solid var(--color-primary)',
        borderLeft: '3px solid var(--color-primary)',
        padding: '10px 14px',
        fontFamily: 'var(--font-mono)',
        fontSize: '0.7rem',
        color: 'var(--color-primary)',
        letterSpacing: '0.08em',
        cursor: 'pointer',
        maxWidth: 220,
        pointerEvents: 'auto',
      }}
    >
      <div style={{ marginBottom: 4, opacity: 0.6 }}>AREA SCAN KOMPLETT</div>
      <div style={{ marginBottom: summary.notable.length > 0 ? 6 : 0 }}>
        {summary.sectorsScanned} SEKTOREN
        {summary.newSectors > 0 && (
          <span style={{ opacity: 0.7 }}> ({summary.newSectors} NEU)</span>
        )}
      </div>
      {summary.notable.length > 0 && (
        <div style={{ color: 'var(--color-warning, #ff8c00)', fontSize: '0.65rem' }}>
          {summary.notable.join(' · ')}
        </div>
      )}
    </div>
  );
}
