import { useRef, useEffect, useCallback } from 'react';
import { useStore } from '../state/store';
import { MODULES, isModuleFreelyAvailable } from '@void-sector/shared';
import type { ModuleDefinition } from '@void-sector/shared';

const CATEGORIES = ['drive', 'cargo', 'scanner', 'armor', 'weapon', 'shield', 'defense', 'mining'] as const;
const CATEGORY_LABELS: Record<string, string> = {
  drive: 'ANTRIEB', cargo: 'FRACHT', scanner: 'SCANNER', armor: 'PANZER',
  weapon: 'WAFFEN', shield: 'SCHILD', defense: 'VERTEID.', mining: 'BERGBAU',
};

const COL_WIDTH = 90;
const ROW_HEIGHT = 52;
const NODE_W = 76;
const NODE_H = 22;
const HEADER_H = 28;
const PADDING_X = 8;
const PADDING_Y = 8;

const CANVAS_W = CATEGORIES.length * COL_WIDTH + PADDING_X * 2;
const CANVAS_H = 5 * ROW_HEIGHT + HEADER_H + PADDING_Y * 2;

type NodeStatus = 'free' | 'unlocked' | 'blueprint' | 'researching' | 'researching2' | 'locked';

function getStatus(mod: ModuleDefinition, research: { activeResearch: { moduleId: string } | null; activeResearch2: { moduleId: string } | null; unlockedModules: string[]; blueprints: string[] }): NodeStatus {
  if (research.activeResearch?.moduleId === mod.id) return 'researching';
  if (research.activeResearch2?.moduleId === mod.id) return 'researching2';
  if (isModuleFreelyAvailable(mod.id)) return 'free';
  if (research.unlockedModules.includes(mod.id)) return 'unlocked';
  if (research.blueprints.includes(mod.id)) return 'blueprint';
  return 'locked';
}

function statusColor(status: NodeStatus): string {
  switch (status) {
    case 'free': return '#00FF88';
    case 'unlocked': return '#00AA55';
    case 'blueprint': return '#00BFFF';
    case 'researching': return '#FFB000';
    case 'researching2': return '#FF8800';
    case 'locked': return '#444';
  }
}

export function TechTreeCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const research = useStore((s) => s.research);
  const selectedModuleId = useStore((s) => s.selectedTechModule);
  const setSelectedTechModule = useStore((s) => s.setSelectedTechModule);

  // Build node grid: category × tier (computed once per render)
  const nodeGrid = new Map<string, { mod: ModuleDefinition; col: number; row: number }>();
  for (const [id, mod] of Object.entries(MODULES)) {
    const col = CATEGORIES.indexOf(mod.category as typeof CATEGORIES[number]);
    if (col === -1) continue; // skip 'special' — no column
    const row = 5 - mod.tier; // tier 5 at top (row 0), tier 1 at bottom (row 4)
    nodeGrid.set(id, { mod, col, row });
  }

  const nodeX = (col: number) => PADDING_X + col * COL_WIDTH + (COL_WIDTH - NODE_W) / 2;
  const nodeY = (row: number) => HEADER_H + PADDING_Y + row * ROW_HEIGHT + (ROW_HEIGHT - NODE_H) / 2;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Column headers
    ctx.font = '7px monospace';
    ctx.textAlign = 'center';
    for (let c = 0; c < CATEGORIES.length; c++) {
      ctx.fillStyle = '#666';
      ctx.fillText(CATEGORY_LABELS[CATEGORIES[c]], PADDING_X + c * COL_WIDTH + COL_WIDTH / 2, 18);
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

      ctx.fillStyle = status === 'locked' ? '#444' : color;
      ctx.font = '7px monospace';
      ctx.textAlign = 'center';
      const label = mod.name.length > 12 ? mod.name.substring(0, 11) + '\u2026' : mod.name;
      ctx.fillText(label, x + NODE_W / 2, y + 14);
    }
  }, [research, selectedModuleId, nodeGrid]);

  useEffect(() => { draw(); }, [draw]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;

    for (const [id, { col, row }] of nodeGrid) {
      const x = nodeX(col);
      const y = nodeY(row);
      if (mx >= x && mx <= x + NODE_W && my >= y && my <= y + NODE_H) {
        setSelectedTechModule(id);
        return;
      }
    }
  }, [setSelectedTechModule, nodeGrid]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '4px' }}>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: '0.6rem',
        color: 'var(--color-primary)', marginBottom: 4,
        letterSpacing: '0.1em',
      }}>
        WISSEN: {research.wissen.toLocaleString()}
        <span style={{ color: 'var(--color-dim)', marginLeft: 8 }}>
          +{research.wissenRate}/h
        </span>
      </div>
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        onClick={handleClick}
        style={{ width: '100%', cursor: 'pointer', imageRendering: 'pixelated' }}
      />
    </div>
  );
}
