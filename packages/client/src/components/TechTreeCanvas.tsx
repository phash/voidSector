import { useRef, useEffect, useCallback, useState } from 'react';
import { useStore } from '../state/store';
import { MODULES, isModuleFreelyAvailable } from '@void-sector/shared';
import type { ModuleDefinition } from '@void-sector/shared';

const CATEGORIES = [
  'drive',
  'cargo',
  'scanner',
  'armor',
  'weapon',
  'shield',
  'defense',
  'mining',
] as const;
const CATEGORY_LABELS: Record<string, string> = {
  drive: 'ANTRIEB',
  cargo: 'FRACHT',
  scanner: 'SCANNER',
  armor: 'PANZER',
  weapon: 'WAFFEN',
  shield: 'SCHILD',
  defense: 'VERTEID.',
  mining: 'BERGBAU',
};

const COL_WIDTH = 140;
const ROW_HEIGHT = 68;
const NODE_W = 120;
const NODE_H = 34;
const HEADER_H = 36;
const PADDING_X = 12;
const PADDING_Y = 12;

const WORLD_W = CATEGORIES.length * COL_WIDTH + PADDING_X * 2;
const WORLD_H = 5 * ROW_HEIGHT + HEADER_H + PADDING_Y * 2;

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.5;

type NodeStatus = 'free' | 'unlocked' | 'blueprint' | 'locked';

function getStatus(
  mod: ModuleDefinition,
  research: {
    unlockedModules: string[];
    blueprints: string[];
  },
): NodeStatus {
  if (isModuleFreelyAvailable(mod.id)) return 'free';
  if (research.unlockedModules.includes(mod.id)) return 'unlocked';
  if (research.blueprints.includes(mod.id)) return 'blueprint';
  return 'locked';
}

function statusColor(status: NodeStatus): string {
  switch (status) {
    case 'free':
      return '#00FF88';
    case 'unlocked':
      return '#00AA55';
    case 'blueprint':
      return '#00BFFF';
    case 'locked':
      return '#444';
  }
}

const LEGEND: { label: string; color: string }[] = [
  { label: 'Frei', color: '#00FF88' },
  { label: 'Erforscht', color: '#00AA55' },
  { label: 'Blueprint', color: '#00BFFF' },
  { label: 'Gesperrt', color: '#444' },
];

export function TechTreeCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const research = useStore((s) => s.research);
  const selectedModuleId = useStore((s) => s.selectedTechModule);
  const setSelectedTechModule = useStore((s) => s.setSelectedTechModule);

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const [showHelp, setShowHelp] = useState(false);

  // Build node grid
  const nodeGrid = new Map<string, { mod: ModuleDefinition; col: number; row: number }>();
  for (const [id, mod] of Object.entries(MODULES)) {
    const col = CATEGORIES.indexOf(mod.category as (typeof CATEGORIES)[number]);
    if (col === -1) continue;
    const row = 5 - mod.tier;
    nodeGrid.set(id, { mod, col, row });
  }

  const nodeX = (col: number) => PADDING_X + col * COL_WIDTH + (COL_WIDTH - NODE_W) / 2;
  const nodeY = (row: number) =>
    HEADER_H + PADDING_Y + row * ROW_HEIGHT + (ROW_HEIGHT - NODE_H) / 2;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const displayW = container.clientWidth;
    const displayH = container.clientHeight - 52; // reserve space for header + legend
    canvas.width = displayW * dpr;
    canvas.height = displayH * dpr;
    canvas.style.width = `${displayW}px`;
    canvas.style.height = `${displayH}px`;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, displayW, displayH);
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, displayW, displayH);

    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    // Column headers
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    for (let c = 0; c < CATEGORIES.length; c++) {
      ctx.fillStyle = '#888';
      ctx.fillText(CATEGORY_LABELS[CATEGORIES[c]], PADDING_X + c * COL_WIDTH + COL_WIDTH / 2, 24);
    }

    // Dependency arrows
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    for (const [, { mod, col, row }] of nodeGrid) {
      if (!mod.prerequisite) continue;
      const prereq = nodeGrid.get(mod.prerequisite);
      if (!prereq) continue;
      const x1 = nodeX(prereq.col) + NODE_W / 2;
      const y1 = nodeY(prereq.row) + NODE_H;
      const x2 = nodeX(col) + NODE_W / 2;
      const y2 = nodeY(row);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    // Nodes
    for (const [id, { mod, col, row }] of nodeGrid) {
      const x = nodeX(col);
      const y = nodeY(row);
      const status = getStatus(mod, research);
      const isSelected = id === selectedModuleId;
      const color = statusColor(status);

      ctx.fillStyle = status === 'locked' ? '#111' : '#0d0d0d';
      ctx.fillRect(x, y, NODE_W, NODE_H);
      ctx.strokeStyle = isSelected ? '#FFF' : color;
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.strokeRect(x, y, NODE_W, NODE_H);

      ctx.fillStyle = status === 'locked' ? '#555' : color;
      ctx.font = '11px monospace';
      ctx.textAlign = 'center';
      const label = mod.name.length > 16 ? mod.name.substring(0, 15) + '\u2026' : mod.name;
      ctx.fillText(label, x + NODE_W / 2, y + 21);
    }

    ctx.restore();
  }, [research, selectedModuleId, nodeGrid, zoom, pan]);

  useEffect(() => {
    draw();
  }, [draw]);

  // Resize observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const obs = new ResizeObserver(() => draw());
    obs.observe(container);
    return () => obs.disconnect();
  }, [draw]);

  // Screen → world coordinates
  const screenToWorld = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return { wx: 0, wy: 0 };
      const rect = canvas.getBoundingClientRect();
      const sx = clientX - rect.left;
      const sy = clientY - rect.top;
      return { wx: (sx - pan.x) / zoom, wy: (sy - pan.y) / zoom };
    },
    [pan, zoom],
  );

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (dragging) return;
      const { wx, wy } = screenToWorld(e.clientX, e.clientY);
      for (const [id, { col, row }] of nodeGrid) {
        const x = nodeX(col);
        const y = nodeY(row);
        if (wx >= x && wx <= x + NODE_W && wy >= y && wy <= y + NODE_H) {
          setSelectedTechModule(id);
          return;
        }
      }
    },
    [setSelectedTechModule, nodeGrid, screenToWorld, dragging],
  );

  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      const { wx, wy } = screenToWorld(e.clientX, e.clientY);
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * factor));
      // Adjust pan so the point under the cursor stays fixed
      setPan({
        x: e.clientX - canvasRef.current!.getBoundingClientRect().left - wx * newZoom,
        y: e.clientY - canvasRef.current!.getBoundingClientRect().top - wy * newZoom,
      });
      setZoom(newZoom);
    },
    [zoom, screenToWorld],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (e.button !== 0) return;
      setDragging(false);
      dragStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
      const onMove = (me: MouseEvent) => {
        const dx = me.clientX - dragStart.current.x;
        const dy = me.clientY - dragStart.current.y;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) setDragging(true);
        setPan({ x: dragStart.current.panX + dx, y: dragStart.current.panY + dy });
      };
      const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        setTimeout(() => setDragging(false), 50);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [pan],
  );

  const resetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  return (
    <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '4px' }}>
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.75rem',
          color: 'var(--color-primary)',
          marginBottom: 4,
          letterSpacing: '0.1em',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span>
          WISSEN: {(research.wissen ?? 0).toLocaleString()}
        </span>
        <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {LEGEND.map((l) => (
            <span key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <span style={{ display: 'inline-block', width: 8, height: 8, background: l.color, border: '1px solid #333' }} />
              <span style={{ color: '#888', fontSize: '0.65rem' }}>{l.label}</span>
            </span>
          ))}
          <button
            onClick={() => setShowHelp((h) => !h)}
            style={{
              background: 'transparent',
              border: '1px solid #555',
              color: '#888',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.65rem',
              padding: '1px 6px',
              cursor: 'pointer',
              marginLeft: 4,
            }}
          >
            [?]
          </button>
          <button
            onClick={resetView}
            style={{
              background: 'transparent',
              border: '1px solid #555',
              color: '#888',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.65rem',
              padding: '1px 6px',
              cursor: 'pointer',
            }}
          >
            [RESET]
          </button>
        </span>
      </div>
      {showHelp && (
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.7rem',
            color: '#aaa',
            background: '#111',
            border: '1px solid #333',
            padding: '6px 10px',
            marginBottom: 4,
            lineHeight: 1.5,
          }}
        >
          <b style={{ color: 'var(--color-primary)' }}>TECH-BAUM</b> — Klicke ein Modul zum Auswählen.
          Details rechts im Panel. Scrollrad zum Zoomen, Ziehen zum Verschieben.
          Module mit Voraussetzung sind durch Linien verbunden.
          Erforsche Module im Detail-Panel mit Wissen + Artefakten.
        </div>
      )}
      <canvas
        ref={canvasRef}
        onClick={handleClick}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        style={{ flex: 1, cursor: dragging ? 'grabbing' : 'grab' }}
      />
    </div>
  );
}
