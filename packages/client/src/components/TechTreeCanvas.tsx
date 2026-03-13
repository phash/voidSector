import { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { useStore } from '../state/store';
import { network } from '../network/client';
import {
  TECH_TREE_NODES,
  getTechNode,
  getChildNodes,
  BRANCH_COLORS,
  GLOBAL_COST_ESCALATION,
  calculateResearchCost,
} from '@void-sector/shared';
import type { TechBranch, TechTreeNode } from '@void-sector/shared';

// --- Layout constants ---

const BRANCH_ANGLES: Record<TechBranch, number> = {
  kampf: 270,     // top
  ausbau: 180,    // left
  intel: 0,       // right
  explorer: 90,   // bottom
};

const RING_SPACING = 120;
const MODULE_FAN_ANGLE = 30;
const LEAF_FAN_ANGLE = 10;
const ZOOM_MIN = 0.3;
const ZOOM_MAX = 3.0;

const NODE_SIZES = {
  core: 90,
  branch: { w: 110, h: 50 },
  module: { w: 100, h: 42 },
  specialization: { w: 100, h: 42 },
  leaf: 32,
};

type NodeStatus = 'researched' | 'available' | 'locked' | 'exclusive_blocked';

const STATUS_STYLES: Record<NodeStatus, { opacity: number; glow: boolean | 'pulse'; color?: string; strikethrough?: boolean }> = {
  researched: { opacity: 1.0, glow: true },
  available: { opacity: 0.7, glow: 'pulse' },
  locked: { color: '#333', opacity: 0.3, glow: false },
  exclusive_blocked: { color: '#661111', opacity: 0.5, strikethrough: true, glow: false },
};

// --- Polar math ---

function polarToCartesian(cx: number, cy: number, angleDeg: number, radius: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + Math.cos(rad) * radius, y: cy + Math.sin(rad) * radius };
}

// --- Node position computation ---

interface PositionedNode {
  x: number;
  y: number;
  node: TechTreeNode;
}

function computeNodePositions(centerX: number, centerY: number): Map<string, PositionedNode> {
  const positions = new Map<string, PositionedNode>();

  // For each branch, place: branch node at ring 1, modules fanned at ring 2,
  // specs below modules at ring 3, and leaves around modules/specs
  const branches: TechBranch[] = ['kampf', 'ausbau', 'intel', 'explorer'];

  for (const branch of branches) {
    const baseAngle = BRANCH_ANGLES[branch];
    const branchNode = TECH_TREE_NODES[branch];
    if (!branchNode) continue;

    // Branch node at ring 1
    const branchPos = polarToCartesian(centerX, centerY, baseAngle, RING_SPACING);
    positions.set(branch, { x: branchPos.x, y: branchPos.y, node: branchNode });

    // Modules (children of branch)
    const modules = getChildNodes(branch).filter(n => n.type === 'module');
    const moduleCount = modules.length;

    for (let mi = 0; mi < moduleCount; mi++) {
      const mod = modules[mi];
      // Fan modules around the branch angle
      const fanOffset = (mi - (moduleCount - 1) / 2) * MODULE_FAN_ANGLE;
      const modAngle = baseAngle + fanOffset;
      const modPos = polarToCartesian(centerX, centerY, modAngle, RING_SPACING * 2);
      positions.set(mod.id, { x: modPos.x, y: modPos.y, node: mod });

      // Leaves of this module (depth 2)
      const modLeaves = getChildNodes(mod.id).filter(n => n.type === 'leaf');
      for (let li = 0; li < modLeaves.length; li++) {
        const lf = modLeaves[li];
        const leafFanOffset = (li - (modLeaves.length - 1) / 2) * LEAF_FAN_ANGLE;
        const leafAngle = modAngle + leafFanOffset;
        const leafPos = polarToCartesian(centerX, centerY, leafAngle, RING_SPACING * 2.6);
        positions.set(lf.id, { x: leafPos.x, y: leafPos.y, node: lf });
      }

      // Specializations of this module (depth 2)
      const specs = getChildNodes(mod.id).filter(n => n.type === 'specialization');
      for (let si = 0; si < specs.length; si++) {
        const sp = specs[si];
        const specFanOffset = (si - (specs.length - 1) / 2) * MODULE_FAN_ANGLE * 0.6;
        const specAngle = modAngle + specFanOffset;
        const specPos = polarToCartesian(centerX, centerY, specAngle, RING_SPACING * 3.4);
        positions.set(sp.id, { x: specPos.x, y: specPos.y, node: sp });

        // Leaves of this specialization (depth 3)
        const specLeaves = getChildNodes(sp.id).filter(n => n.type === 'leaf');
        for (let sli = 0; sli < specLeaves.length; sli++) {
          const slf = specLeaves[sli];
          const sLeafFanOffset = (sli - (specLeaves.length - 1) / 2) * LEAF_FAN_ANGLE;
          const sLeafAngle = specAngle + sLeafFanOffset;
          const sLeafPos = polarToCartesian(centerX, centerY, sLeafAngle, RING_SPACING * 4.0);
          positions.set(slf.id, { x: sLeafPos.x, y: sLeafPos.y, node: slf });
        }
      }
    }
  }

  return positions;
}

// --- Node status computation ---

function getNodeStatus(
  node: TechTreeNode,
  researchedNodes: Record<string, number>,
): NodeStatus {
  const level = researchedNodes[node.id] ?? 0;
  if (level > 0 && level >= node.maxLevel) return 'researched';
  if (level > 0) return 'researched'; // partially researched still shows as researched

  // Check if exclusive group blocks this node
  if (node.exclusiveGroup) {
    // Specializations share exclusive groups — if another spec in same group is researched, this is blocked
    if (node.type === 'specialization') {
      const siblings = Object.values(TECH_TREE_NODES).filter(
        n => n.exclusiveGroup === node.exclusiveGroup && n.id !== node.id && n.type === 'specialization'
      );
      const siblingResearched = siblings.some(s => (researchedNodes[s.id] ?? 0) > 0);
      if (siblingResearched) return 'exclusive_blocked';
    }
  }

  // Check if parent is researched (required for availability)
  if (node.parent) {
    const parentLevel = researchedNodes[node.parent] ?? 0;
    if (parentLevel <= 0) return 'locked';
  }

  // Branch nodes are always available (no parent required)
  if (node.type === 'branch') return 'available';

  return 'available';
}

// --- Drawing functions ---

function drawCenterNode(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  animTime: number,
) {
  const radius = NODE_SIZES.core / 2;
  const pulse = 0.85 + 0.15 * Math.sin(animTime * 0.002);

  // Glow
  ctx.save();
  ctx.shadowColor = '#00FF88';
  ctx.shadowBlur = 20 * pulse;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(0, 40, 20, ${0.8 * pulse})`;
  ctx.fill();
  ctx.strokeStyle = '#00FF88';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  // Inner rings
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 0.6, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(0, 255, 136, 0.3)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Text
  ctx.fillStyle = '#00FF88';
  ctx.font = 'bold 12px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('TECH', cx, cy - 7);
  ctx.fillText('CORE', cx, cy + 7);
}

function drawHexagon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  w: number,
  h: number,
) {
  const hw = w / 2;
  const hh = h / 2;
  const indent = w * 0.2;
  ctx.beginPath();
  ctx.moveTo(cx - hw + indent, cy - hh);
  ctx.lineTo(cx + hw - indent, cy - hh);
  ctx.lineTo(cx + hw, cy);
  ctx.lineTo(cx + hw - indent, cy + hh);
  ctx.lineTo(cx - hw + indent, cy + hh);
  ctx.lineTo(cx - hw, cy);
  ctx.closePath();
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function drawNode(
  ctx: CanvasRenderingContext2D,
  pn: PositionedNode,
  status: NodeStatus,
  isSelected: boolean,
  animTime: number,
  branchColor: string,
  level: number,
) {
  const { x, y, node } = pn;
  const style = STATUS_STYLES[status];

  // Compute opacity with pulse for available nodes
  let opacity = style.opacity;
  if (style.glow === 'pulse') {
    opacity = 0.5 + 0.3 * Math.sin(animTime * 0.003);
  }

  const nodeColor = status === 'locked'
    ? (style.color ?? '#333')
    : status === 'exclusive_blocked'
      ? (style.color ?? '#661111')
      : branchColor;

  ctx.save();
  ctx.globalAlpha = opacity;

  // Apply glow for researched nodes
  if (style.glow === true) {
    // Shield ("glow") nodes get a stronger frame glow
    const isGlowNode = node.id.includes('schild');
    ctx.shadowColor = branchColor;
    ctx.shadowBlur = isGlowNode ? 24 : 12;
  }

  // Draw shape based on node type
  if (node.type === 'branch') {
    const { w, h } = NODE_SIZES.branch;
    drawHexagon(ctx, x, y, w, h);
    ctx.fillStyle = status === 'researched' ? `${branchColor}22` : '#111';
    ctx.fill();
    ctx.strokeStyle = isSelected ? '#FFF' : nodeColor;
    ctx.lineWidth = isSelected ? 3 : 2;
    ctx.stroke();
  } else if (node.type === 'module' || node.type === 'specialization') {
    const size = node.type === 'module' ? NODE_SIZES.module : NODE_SIZES.specialization;
    const hw = size.w / 2;
    const hh = size.h / 2;
    drawRoundedRect(ctx, x - hw, y - hh, size.w, size.h, 6);
    ctx.fillStyle = status === 'researched' ? `${branchColor}22` : '#111';
    ctx.fill();
    ctx.strokeStyle = isSelected ? '#FFF' : nodeColor;
    ctx.lineWidth = isSelected ? 3 : 1.5;
    ctx.stroke();

    // Type badge for specialization
    if (node.type === 'specialization') {
      ctx.font = '8px "Courier New", monospace';
      ctx.fillStyle = `${nodeColor}88`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText('SPEC', x, y - hh + 2);
    }
  } else if (node.type === 'leaf') {
    const r = NODE_SIZES.leaf / 2;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = status === 'researched' ? `${branchColor}33` : '#111';
    ctx.fill();
    ctx.strokeStyle = isSelected ? '#FFF' : nodeColor;
    ctx.lineWidth = isSelected ? 2.5 : 1;
    ctx.stroke();

    // Level indicator for multi-level leaves
    if (node.maxLevel > 1 && level > 0) {
      ctx.font = '9px "Courier New", monospace';
      ctx.fillStyle = nodeColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(`${level}/${node.maxLevel}`, x, y + r + 12);
    }
  }

  // Module/spec icons: draw icon on left, shift text right
  const iconCat = (node.type === 'module' || node.type === 'specialization')
    ? getIconCategory(node.id)
    : null;

  if (iconCat) {
    // Icon sits in the left 22 px of the node; turn off shadow so it doesn't bleed into the icon
    ctx.shadowBlur = 0;
    drawModuleIcon(ctx, iconCat, x - 32, y, nodeColor);
    // Restore glow for text
    if (style.glow === true) {
      ctx.shadowColor = branchColor;
      ctx.shadowBlur = node.id.includes('schild') ? 24 : 12;
    }
  }

  // Node label
  ctx.font = node.type === 'leaf'
    ? '9px "Courier New", monospace'
    : node.type === 'branch'
      ? 'bold 11px "Courier New", monospace'
      : '10px "Courier New", monospace';
  ctx.fillStyle = status === 'locked' ? '#555' : status === 'exclusive_blocked' ? '#884444' : nodeColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const maxChars = iconCat ? 9 : 14;
  const label = node.name.length > maxChars ? node.name.substring(0, maxChars - 1) + '\u2026' : node.name;
  // Shift text right when icon is present
  const labelX = iconCat ? x + 10 : x;

  if (node.type === 'leaf') {
    ctx.fillText(label, x, y);
  } else if (node.type === 'specialization') {
    ctx.fillText(label, labelX, y + 4);
  } else {
    ctx.fillText(label, labelX, y);
  }

  // Strikethrough for exclusive_blocked
  if (style.strikethrough) {
    const textW = ctx.measureText(label).width;
    ctx.beginPath();
    ctx.moveTo(labelX - textW / 2 - 2, y + (node.type === 'specialization' ? 4 : 0));
    ctx.lineTo(labelX + textW / 2 + 2, y + (node.type === 'specialization' ? 4 : 0));
    ctx.strokeStyle = '#884444';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Level pips for branch nodes
  if (node.type === 'branch' && node.maxLevel > 1) {
    const pipY = y + NODE_SIZES.branch.h / 2 - 8;
    for (let i = 0; i < node.maxLevel; i++) {
      const pipX = x + (i - (node.maxLevel - 1) / 2) * 10;
      ctx.beginPath();
      ctx.arc(pipX, pipY, 3, 0, Math.PI * 2);
      if (i < level) {
        ctx.fillStyle = branchColor;
        ctx.fill();
      } else {
        ctx.strokeStyle = `${nodeColor}66`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
  }

  ctx.restore();
}

// --- Module icon category resolver ---

function getIconCategory(nodeId: string): string | null {
  if (nodeId.includes('mining'))                       return 'mining';
  if (nodeId.includes('scanner') || nodeId.includes('sensor')) return 'scanner';
  if (nodeId.includes('antrieb') || nodeId.includes('treibstoff') || nodeId.includes('nav')) return 'drive';
  if (nodeId.includes('schild'))                       return 'glow';
  if (nodeId.includes('defense') || nodeId.includes('cargo') || nodeId.includes('labor')) return 'defense';
  if (nodeId.includes('laser') || nodeId.includes('missile') || nodeId.includes('railgun')) return 'weapon';
  return null;
}

// Draws a small ~12-px icon at (cx, cy).
function drawModuleIcon(
  ctx: CanvasRenderingContext2D,
  category: string,
  cx: number,
  cy: number,
  color: string,
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1.2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  switch (category) {

    case 'mining': {
      // Laser beam (upper-left → lower-right) hitting an asteroid dot, sparks at impact
      const lx1 = cx - 9, ly1 = cy - 6, lx2 = cx + 2, ly2 = cy + 3;
      ctx.beginPath();
      ctx.moveTo(lx1, ly1);
      ctx.lineTo(lx2, ly2);
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // Impact dot (molten rock)
      ctx.beginPath();
      ctx.arc(lx2 + 1, ly2 + 1, 2.5, 0, Math.PI * 2);
      ctx.fill();
      // Melt sparks
      ctx.lineWidth = 0.9;
      ctx.beginPath(); ctx.moveTo(lx2 + 2, ly2 + 2); ctx.lineTo(cx + 8, cy + 1); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(lx2 + 2, ly2 + 2); ctx.lineTo(cx + 6, cy + 7); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(lx2 + 2, ly2 + 2); ctx.lineTo(cx + 9, cy + 5); ctx.stroke();
      break;
    }

    case 'scanner': {
      // Satellite dish: parabolic bowl opening upward, mast, signal rays from focal point
      // Bowl arc (opens upward)
      ctx.beginPath();
      ctx.arc(cx, cy + 4, 8, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
      // Mast (vertical line from bowl center down)
      ctx.beginPath();
      ctx.moveTo(cx, cy + 4);
      ctx.lineTo(cx, cy + 9);
      ctx.stroke();
      // Focal point above bowl
      const fx = cx, fy = cy - 4;
      ctx.beginPath();
      ctx.arc(fx, fy, 1.5, 0, Math.PI * 2);
      ctx.fill();
      // Signal rays (two arcs widening outward from focal point)
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.arc(fx, fy, 5, -Math.PI * 0.55, -Math.PI * 0.1);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(fx, fy, 8, -Math.PI * 0.55, -Math.PI * 0.1);
      ctx.stroke();
      break;
    }

    case 'drive': {
      // Rocket thruster pointing RIGHT: trapezoidal body, exhaust cone left, thrust arrow right
      // Body (trapezoid, narrow right)
      ctx.beginPath();
      ctx.moveTo(cx - 2, cy - 5);
      ctx.lineTo(cx + 6, cy - 3);
      ctx.lineTo(cx + 6, cy + 3);
      ctx.lineTo(cx - 2, cy + 5);
      ctx.closePath();
      ctx.stroke();
      // Exhaust cone (V-shape on the left)
      ctx.beginPath();
      ctx.moveTo(cx - 2, cy - 4);
      ctx.lineTo(cx - 9, cy);
      ctx.lineTo(cx - 2, cy + 4);
      ctx.stroke();
      // Thrust direction arrow (right side)
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(cx + 6, cy);
      ctx.lineTo(cx + 10, cy);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + 8, cy - 2);
      ctx.lineTo(cx + 10, cy);
      ctx.lineTo(cx + 8, cy + 2);
      ctx.stroke();
      break;
    }

    case 'glow': {
      // Shield hexagon outline — the node border glow is handled in drawNode
      ctx.beginPath();
      ctx.moveTo(cx,       cy - 8);
      ctx.lineTo(cx + 7,   cy - 4);
      ctx.lineTo(cx + 7,   cy + 4);
      ctx.lineTo(cx,       cy + 9);
      ctx.lineTo(cx - 7,   cy + 4);
      ctx.lineTo(cx - 7,   cy - 4);
      ctx.closePath();
      ctx.lineWidth = 1.3;
      ctx.stroke();
      // Inner vertical divider (classic shield detail)
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(cx, cy - 5);
      ctx.lineTo(cx, cy + 5);
      ctx.stroke();
      break;
    }

    case 'defense': {
      // Spaceship armor: two offset angular plates
      // Back plate (larger, slightly offset)
      ctx.beginPath();
      ctx.moveTo(cx - 5, cy - 7);
      ctx.lineTo(cx + 4, cy - 5);
      ctx.lineTo(cx + 5, cy + 2);
      ctx.lineTo(cx - 4, cy + 5);
      ctx.closePath();
      ctx.lineWidth = 1.1;
      ctx.stroke();
      // Front plate (smaller, offset right-down)
      ctx.beginPath();
      ctx.moveTo(cx - 1, cy - 4);
      ctx.lineTo(cx + 7, cy - 2);
      ctx.lineTo(cx + 7, cy + 5);
      ctx.lineTo(cx,     cy + 7);
      ctx.closePath();
      ctx.stroke();
      break;
    }

    case 'weapon': {
      // Targeting crosshair
      const r = 6;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.lineWidth = 1.1;
      ctx.stroke();
      ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(cx - 10, cy); ctx.lineTo(cx - r - 1, cy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx + r + 1, cy); ctx.lineTo(cx + 10, cy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, cy - 10); ctx.lineTo(cx, cy - r - 1); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, cy + r + 1); ctx.lineTo(cx, cy + 10); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy, 2, 0, Math.PI * 2); ctx.fill();
      break;
    }

    default:
      break;
  }

  ctx.restore();
}

function drawConnection(
  ctx: CanvasRenderingContext2D,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  parentStatus: NodeStatus,
  childStatus: NodeStatus,
  branchColor: string,
) {
  ctx.save();

  const isActive = parentStatus === 'researched' || parentStatus === 'available';
  const isDim = childStatus === 'locked' || childStatus === 'exclusive_blocked';

  if (isActive && !isDim) {
    ctx.strokeStyle = `${branchColor}88`;
    ctx.shadowColor = branchColor;
    ctx.shadowBlur = 4;
    ctx.lineWidth = 1.5;
  } else {
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
  }

  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.lineTo(toX, toY);
  ctx.stroke();

  ctx.restore();
}

function drawScanlines(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
  for (let y = 0; y < h; y += 3) {
    ctx.fillRect(0, y, w, 1);
  }
  ctx.restore();
}

function drawVignette(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const cx = w / 2;
  const cy = h / 2;
  const r = Math.max(w, h) * 0.7;
  const grad = ctx.createRadialGradient(cx, cy, r * 0.4, cx, cy, r);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0.5)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
}

// --- Hit testing ---

function hitTestNode(
  mx: number,
  my: number,
  pn: PositionedNode,
): boolean {
  const { x, y, node } = pn;

  if (node.type === 'branch') {
    const hw = NODE_SIZES.branch.w / 2;
    const hh = NODE_SIZES.branch.h / 2;
    return mx >= x - hw && mx <= x + hw && my >= y - hh && my <= y + hh;
  } else if (node.type === 'module' || node.type === 'specialization') {
    const size = node.type === 'module' ? NODE_SIZES.module : NODE_SIZES.specialization;
    const hw = size.w / 2;
    const hh = size.h / 2;
    return mx >= x - hw && mx <= x + hw && my >= y - hh && my <= y + hh;
  } else if (node.type === 'leaf') {
    const r = NODE_SIZES.leaf / 2 + 4; // slight tolerance
    const dx = mx - x;
    const dy = my - y;
    return dx * dx + dy * dy <= r * r;
  }

  return false;
}

// --- Format helpers ---

function formatStatKey(key: string): string {
  return key.replace(/_/g, ' ').toUpperCase();
}

function formatCooldown(ms: number): string {
  const totalSec = Math.ceil(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// --- Main component ---

export function TechTreeCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number>(0);

  const techTree = useStore((s) => s.techTree);
  const research = useStore((s) => s.research);
  const selectedNodeId = useStore((s) => s.selectedTechModule);
  const setSelectedNode = useStore((s) => s.setSelectedTechModule);

  const [zoom, setZoom] = useState(0.75);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const [panInitialized, setPanInitialized] = useState(false);

  const researchedNodes = techTree?.researchedNodes ?? {};
  const totalResearched = techTree?.totalResearched ?? 0;
  const resetCooldownRemaining = techTree?.resetCooldownRemaining ?? 0;
  const wissen = research.wissen ?? 0;

  // Request tech tree data on mount
  useEffect(() => {
    network.getTechTree();
  }, []);

  // Compute node positions (centered at 0,0 — we'll translate in the draw call)
  const nodePositions = useMemo(() => computeNodePositions(0, 0), []);

  // Center the view on first render
  useEffect(() => {
    const container = containerRef.current;
    if (!container || panInitialized) return;
    const displayW = container.clientWidth;
    const displayH = container.clientHeight - 80; // header space
    setPan({ x: displayW / 2, y: displayH / 2 });
    setPanInitialized(true);
  }, [panInitialized]);

  // --- Drawing ---
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const displayW = container.clientWidth;
    const displayH = container.clientHeight - 80;
    canvas.width = displayW * dpr;
    canvas.height = displayH * dpr;
    canvas.style.width = `${displayW}px`;
    canvas.style.height = `${displayH}px`;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, displayW, displayH);

    // Background
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, displayW, displayH);

    const animTime = performance.now();

    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    // Draw connections first (behind nodes)
    for (const [nodeId, pn] of nodePositions) {
      const node = pn.node;
      if (!node.parent) continue;
      const parentPn = nodePositions.get(node.parent);
      if (!parentPn) continue;

      const parentStatus = getNodeStatus(
        parentPn.node,
        researchedNodes,
      );
      const childStatus = getNodeStatus(node, researchedNodes);
      const branchColor = BRANCH_COLORS[node.branch];

      drawConnection(
        ctx,
        parentPn.x, parentPn.y,
        pn.x, pn.y,
        parentStatus,
        childStatus,
        branchColor,
      );
    }

    // Draw connections from center to branch nodes
    const branches: TechBranch[] = ['kampf', 'ausbau', 'intel', 'explorer'];
    for (const branch of branches) {
      const branchPn = nodePositions.get(branch);
      if (!branchPn) continue;
      const status = getNodeStatus(branchPn.node, researchedNodes);
      drawConnection(ctx, 0, 0, branchPn.x, branchPn.y, 'researched', status, BRANCH_COLORS[branch]);
    }

    // Draw center node
    drawCenterNode(ctx, 0, 0, animTime);

    // Draw all nodes
    for (const [nodeId, pn] of nodePositions) {
      const status = getNodeStatus(pn.node, researchedNodes);
      const isSelected = nodeId === selectedNodeId;
      const level = researchedNodes[nodeId] ?? 0;
      const branchColor = BRANCH_COLORS[pn.node.branch];
      drawNode(ctx, pn, status, isSelected, animTime, branchColor, level);
    }

    ctx.restore();

    // CRT effects (over the whole canvas, not transformed)
    drawScanlines(ctx, displayW, displayH);
    drawVignette(ctx, displayW, displayH);

    // Continue animation
    animFrameRef.current = requestAnimationFrame(draw);
  }, [pan, zoom, nodePositions, researchedNodes, selectedNodeId]);

  // Start/stop animation loop
  useEffect(() => {
    animFrameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [draw]);

  // Resize observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const obs = new ResizeObserver(() => {
      // Re-render on resize — animation loop handles it
    });
    obs.observe(container);
    return () => obs.disconnect();
  }, []);

  // --- Interaction handlers ---

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

      // Check if clicked on a node
      for (const [nodeId, pn] of nodePositions) {
        if (hitTestNode(wx, wy, pn)) {
          setSelectedNode(nodeId);
          return;
        }
      }

      // Click on empty space deselects
      setSelectedNode(null);
    },
    [setSelectedNode, nodePositions, screenToWorld, dragging],
  );

  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      const { wx, wy } = screenToWorld(e.clientX, e.clientY);
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      const newZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom * factor));
      const rect = canvasRef.current!.getBoundingClientRect();
      setPan({
        x: e.clientX - rect.left - wx * newZoom,
        y: e.clientY - rect.top - wy * newZoom,
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
    const container = containerRef.current;
    if (!container) return;
    const displayW = container.clientWidth;
    const displayH = container.clientHeight - 80;
    setZoom(0.75);
    setPan({ x: displayW / 2, y: displayH / 2 });
  }, []);

  // --- Info panel data ---

  const selectedNode = selectedNodeId ? getTechNode(selectedNodeId) : null;
  const selectedStatus = selectedNode ? getNodeStatus(selectedNode, researchedNodes) : null;
  const selectedLevel = selectedNodeId ? (researchedNodes[selectedNodeId] ?? 0) : 0;
  const canResearch = selectedNode
    && selectedStatus === 'available'
    && selectedLevel < selectedNode.maxLevel;
  const canResearchMore = selectedNode
    && selectedStatus === 'researched'
    && selectedLevel < selectedNode.maxLevel;
  const costNext = selectedNode
    ? calculateResearchCost(selectedNode.id, selectedLevel, totalResearched)
    : 0;
  const canAfford = costNext <= wissen;

  const handleResearch = useCallback(() => {
    if (!selectedNodeId) return;
    network.researchTechNode(selectedNodeId);
  }, [selectedNodeId]);

  const handleReset = useCallback(() => {
    network.resetTechTree();
  }, []);

  const escalationPct = Math.round(totalResearched * GLOBAL_COST_ESCALATION * 100);

  // Cooldown timer update
  const [, setTick] = useState(0);
  useEffect(() => {
    if (resetCooldownRemaining <= 0) return;
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, [resetCooldownRemaining]);

  return (
    <div
      ref={containerRef}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        position: 'relative',
        fontFamily: '"Courier New", monospace',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '6px 8px',
          borderBottom: '1px solid #333',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span
            style={{
              fontSize: '0.75rem',
              color: 'var(--color-primary)',
              letterSpacing: '0.1em',
            }}
          >
            TECH TREE /// FORSCHUNGSBAUM
          </span>
          <span style={{ fontSize: '0.65rem', color: '#888' }}>
            WISSEN: <span style={{ color: '#bb44ff' }}>{wissen.toLocaleString()}</span>
            {' / [ '}<span style={{ color: '#7744aa' }}>{(research.wissenSpent ?? 0).toLocaleString()}</span>{' ]'}
            {' /// '}
            ERFORSCHT: {totalResearched}
            {' /// '}
            AUFSCHLAG: <span style={{ color: escalationPct > 0 ? '#ff8844' : '#888' }}>+{escalationPct}%</span>
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {/* Branch color legend */}
          {(['kampf', 'ausbau', 'intel', 'explorer'] as TechBranch[]).map(b => (
            <span
              key={b}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 3,
                fontSize: '0.6rem',
                color: '#888',
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  width: 8,
                  height: 8,
                  background: BRANCH_COLORS[b],
                  border: '1px solid #333',
                }}
              />
              {b.toUpperCase()}
            </span>
          ))}
          <button
            onClick={resetView}
            style={{
              background: 'transparent',
              border: '1px solid #555',
              color: '#888',
              fontFamily: '"Courier New", monospace',
              fontSize: '0.6rem',
              padding: '1px 6px',
              cursor: 'pointer',
              marginLeft: 4,
            }}
          >
            [ANSICHT]
          </button>
        </div>
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        onClick={handleClick}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        style={{ flex: 1, cursor: dragging ? 'grabbing' : 'grab' }}
      />

      {/* Info panel (React overlay) */}
      {selectedNode && (
        <div
          style={{
            position: 'absolute',
            right: 8,
            top: 80,
            width: 220,
            background: 'rgba(10, 10, 10, 0.92)',
            border: `1px solid ${BRANCH_COLORS[selectedNode.branch]}44`,
            padding: '10px',
            fontSize: '0.7rem',
            color: '#ccc',
            maxHeight: 'calc(100% - 130px)',
            overflowY: 'auto',
          }}
        >
          {/* Node name */}
          <div
            style={{
              fontSize: '0.85rem',
              color: BRANCH_COLORS[selectedNode.branch],
              fontWeight: 'bold',
              marginBottom: 4,
              letterSpacing: '0.05em',
            }}
          >
            {selectedNode.name}
          </div>

          {/* Type badge */}
          <div style={{ marginBottom: 6 }}>
            <span
              style={{
                display: 'inline-block',
                padding: '1px 6px',
                border: `1px solid ${BRANCH_COLORS[selectedNode.branch]}66`,
                color: BRANCH_COLORS[selectedNode.branch],
                fontSize: '0.6rem',
                letterSpacing: '0.05em',
              }}
            >
              {selectedNode.type.toUpperCase()}
            </span>
            <span
              style={{
                display: 'inline-block',
                marginLeft: 6,
                padding: '1px 6px',
                border: `1px solid #55555566`,
                color: selectedStatus === 'researched'
                  ? '#00FF88'
                  : selectedStatus === 'available'
                    ? '#ffcc00'
                    : selectedStatus === 'exclusive_blocked'
                      ? '#884444'
                      : '#555',
                fontSize: '0.6rem',
              }}
            >
              {selectedStatus === 'researched'
                ? `ERFORSCHT ${selectedLevel}/${selectedNode.maxLevel}`
                : selectedStatus === 'available'
                  ? 'VERFÜGBAR'
                  : selectedStatus === 'exclusive_blocked'
                    ? 'BLOCKIERT'
                    : 'GESPERRT'}
            </span>
          </div>

          {/* Description */}
          <div style={{ marginBottom: 8, color: '#aaa', lineHeight: 1.4 }}>
            {selectedNode.description}
          </div>

          {/* Cost */}
          {(canResearch || canResearchMore) && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ color: '#888', marginBottom: 2 }}>KOSTEN:</div>
              <div style={{ color: canAfford ? '#bb44ff' : '#ff4444' }}>
                {costNext.toLocaleString()} WISSEN
                {escalationPct > 0 && (
                  <span style={{ color: '#ff8844', fontSize: '0.6rem' }}>
                    {' '}(+{escalationPct}% Aufschlag)
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Effects */}
          {selectedNode.effects.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ color: '#888', marginBottom: 2 }}>EFFEKTE:</div>
              {selectedNode.effects.map((eff, i) => (
                <div key={i} style={{ marginLeft: 4 }}>
                  {eff.type === 'stat_bonus' ? (
                    <>
                      <span style={{ color: eff.value > 0 ? '#44ff88' : '#ff4444' }}>
                        {eff.value > 0 ? '+' : ''}{Math.round(eff.value * 100)}% {formatStatKey(eff.target)}
                      </span>
                      {eff.penalty && (
                        <div style={{ color: '#ff4444', marginLeft: 8 }}>
                          {eff.penalty.value > 0 ? '+' : ''}{Math.round(eff.penalty.value * 100)}% {formatStatKey(eff.penalty.target)}
                        </div>
                      )}
                    </>
                  ) : (
                    <span style={{ color: '#44ff88' }}>
                      Unlock Tier {eff.value} {eff.target.toUpperCase()}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Research button */}
          {(canResearch || canResearchMore) && (
            <button
              onClick={handleResearch}
              disabled={!canAfford}
              style={{
                width: '100%',
                padding: '6px 0',
                background: canAfford ? `${BRANCH_COLORS[selectedNode.branch]}22` : '#111',
                border: `1px solid ${canAfford ? BRANCH_COLORS[selectedNode.branch] : '#333'}`,
                color: canAfford ? BRANCH_COLORS[selectedNode.branch] : '#555',
                fontFamily: '"Courier New", monospace',
                fontSize: '0.75rem',
                cursor: canAfford ? 'pointer' : 'not-allowed',
                letterSpacing: '0.1em',
              }}
            >
              [ERFORSCHEN]
            </button>
          )}

          {/* Exclusive group info */}
          {selectedStatus === 'exclusive_blocked' && (
            <div style={{ marginTop: 6, color: '#884444', fontSize: '0.6rem' }}>
              Eine andere Spezialisierung dieser Gruppe wurde bereits erforscht.
            </div>
          )}

          {selectedStatus === 'locked' && selectedNode.parent && (
            <div style={{ marginTop: 6, color: '#666', fontSize: '0.6rem' }}>
              Voraussetzung: {getTechNode(selectedNode.parent)?.name ?? selectedNode.parent}
            </div>
          )}
        </div>
      )}

      {/* Reset button (bottom-right) */}
      <div
        style={{
          position: 'absolute',
          bottom: 8,
          right: 8,
          display: 'flex',
          gap: 8,
          alignItems: 'center',
        }}
      >
        {resetCooldownRemaining > 0 ? (
          <span
            style={{
              fontSize: '0.6rem',
              color: '#666',
              fontFamily: '"Courier New", monospace',
            }}
          >
            RESET: {formatCooldown(resetCooldownRemaining)}
          </span>
        ) : (
          <button
            onClick={handleReset}
            disabled={totalResearched === 0}
            style={{
              background: totalResearched > 0 ? 'rgba(100, 20, 20, 0.3)' : '#111',
              border: `1px solid ${totalResearched > 0 ? '#ff4444' : '#333'}`,
              color: totalResearched > 0 ? '#ff4444' : '#555',
              fontFamily: '"Courier New", monospace',
              fontSize: '0.6rem',
              padding: '3px 10px',
              cursor: totalResearched > 0 ? 'pointer' : 'not-allowed',
              letterSpacing: '0.05em',
            }}
          >
            [RESET TECH TREE]
          </button>
        )}
      </div>
    </div>
  );
}
