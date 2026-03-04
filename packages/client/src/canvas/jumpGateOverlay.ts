import type { JumpGateMapEntry } from '@void-sector/shared';

/**
 * Color palette for jumpgate chains.
 * Each connected group of gates gets a unique color from this palette.
 */
export const JUMPGATE_CHAIN_COLORS = [
  '#00BFFF',  // deep sky blue
  '#33FF33',  // green
  '#FF6644',  // red-orange
  '#FFDD22',  // yellow
  '#FF44FF',  // magenta
  '#44AAFF',  // light blue
];

// --- Union-Find for chain grouping ---

export class UnionFind {
  private parent: Map<string, string> = new Map();
  private rank: Map<string, number> = new Map();

  find(x: string): string {
    if (!this.parent.has(x)) {
      this.parent.set(x, x);
      this.rank.set(x, 0);
    }
    let root = x;
    while (this.parent.get(root) !== root) {
      root = this.parent.get(root)!;
    }
    // Path compression
    let current = x;
    while (current !== root) {
      const next = this.parent.get(current)!;
      this.parent.set(current, root);
      current = next;
    }
    return root;
  }

  union(a: string, b: string): void {
    const rootA = this.find(a);
    const rootB = this.find(b);
    if (rootA === rootB) return;
    const rankA = this.rank.get(rootA)!;
    const rankB = this.rank.get(rootB)!;
    if (rankA < rankB) {
      this.parent.set(rootA, rootB);
    } else if (rankA > rankB) {
      this.parent.set(rootB, rootA);
    } else {
      this.parent.set(rootB, rootA);
      this.rank.set(rootA, rankA + 1);
    }
  }
}

/**
 * Groups jumpgates into connected chains using union-find.
 * Returns a map from gateId to chain index (0-based).
 */
export function buildChainMap(gates: JumpGateMapEntry[]): Map<string, number> {
  const uf = new UnionFind();
  const sectorToGate = new Map<string, string>();

  for (const gate of gates) {
    const fromKey = `${gate.fromX}:${gate.fromY}`;
    const toKey = `${gate.toX}:${gate.toY}`;

    // Union gates that share endpoints
    if (sectorToGate.has(fromKey)) {
      uf.union(gate.gateId, sectorToGate.get(fromKey)!);
    } else {
      sectorToGate.set(fromKey, gate.gateId);
    }

    if (sectorToGate.has(toKey)) {
      uf.union(gate.gateId, sectorToGate.get(toKey)!);
    } else {
      sectorToGate.set(toKey, gate.gateId);
    }

    // Ensure this gate is in the UF
    uf.find(gate.gateId);
  }

  // Assign chain indices
  const rootToChain = new Map<string, number>();
  const chainMap = new Map<string, number>();
  let nextChain = 0;

  for (const gate of gates) {
    const root = uf.find(gate.gateId);
    if (!rootToChain.has(root)) {
      rootToChain.set(root, nextChain++);
    }
    chainMap.set(gate.gateId, rootToChain.get(root)!);
  }

  return chainMap;
}

/**
 * Returns the color for a given chain index, cycling through the palette.
 */
export function chainColor(chainIndex: number): string {
  return JUMPGATE_CHAIN_COLORS[chainIndex % JUMPGATE_CHAIN_COLORS.length];
}

/**
 * Draws jumpgate connection lines on the radar canvas.
 * Call after cells are drawn but before the nav target line.
 */
export function drawJumpGateLines(
  ctx: CanvasRenderingContext2D,
  gates: JumpGateMapEntry[],
  viewX: number,
  viewY: number,
  radiusX: number,
  radiusY: number,
  gridCenterX: number,
  gridCenterY: number,
  cellW: number,
  cellH: number,
): void {
  if (gates.length === 0) return;

  const chainMap = buildChainMap(gates);

  ctx.save();
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.6;

  for (const gate of gates) {
    const fromDx = gate.fromX - viewX;
    const fromDy = gate.fromY - viewY;
    const toDx = gate.toX - viewX;
    const toDy = gate.toY - viewY;

    // Only draw if at least one endpoint is visible
    const fromVisible = Math.abs(fromDx) <= radiusX && Math.abs(fromDy) <= radiusY;
    const toVisible = Math.abs(toDx) <= radiusX && Math.abs(toDy) <= radiusY;
    if (!fromVisible && !toVisible) continue;

    const fromPx = gridCenterX + fromDx * cellW;
    const fromPy = gridCenterY + fromDy * cellH;
    const toPx = gridCenterX + toDx * cellW;
    const toPy = gridCenterY + toDy * cellH;

    const ci = chainMap.get(gate.gateId) ?? 0;
    ctx.strokeStyle = chainColor(ci);

    if (gate.gateType === 'wormhole') {
      ctx.setLineDash([4, 4]);
    } else {
      ctx.setLineDash([]);
    }

    ctx.beginPath();
    ctx.moveTo(fromPx, fromPy);
    ctx.lineTo(toPx, toPy);
    ctx.stroke();
  }

  ctx.setLineDash([]);
  ctx.globalAlpha = 1.0;
  ctx.restore();
}

/**
 * Filters gates for the quadrant map:
 * - All cross-quadrant gates (from and to are in different quadrants)
 * - Top 3 longest intra-quadrant gates
 */
export function filterQuadrantGates(
  gates: JumpGateMapEntry[],
  quadrantSize: number,
): JumpGateMapEntry[] {
  const toQuadrant = (x: number, y: number) => ({
    qx: Math.floor(x / quadrantSize),
    qy: Math.floor(y / quadrantSize),
  });

  const crossQuadrant: JumpGateMapEntry[] = [];
  const intraQuadrant: Array<{ gate: JumpGateMapEntry; distance: number }> = [];

  for (const gate of gates) {
    const fromQ = toQuadrant(gate.fromX, gate.fromY);
    const toQ = toQuadrant(gate.toX, gate.toY);

    if (fromQ.qx !== toQ.qx || fromQ.qy !== toQ.qy) {
      crossQuadrant.push(gate);
    } else {
      const dx = gate.toX - gate.fromX;
      const dy = gate.toY - gate.fromY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      intraQuadrant.push({ gate, distance: dist });
    }
  }

  // Sort intra-quadrant by distance descending, take top 3
  intraQuadrant.sort((a, b) => b.distance - a.distance);
  const topIntra = intraQuadrant.slice(0, 3).map(e => e.gate);

  return [...crossQuadrant, ...topIntra];
}

/**
 * Draws jumpgate connection lines on the quadrant map canvas.
 * Converts sector coordinates to quadrant coordinates for positioning.
 */
export function drawQuadrantJumpGateLines(
  ctx: CanvasRenderingContext2D,
  gates: JumpGateMapEntry[],
  quadrantSize: number,
  viewQx: number,
  viewQy: number,
  radiusX: number,
  radiusY: number,
  gridCenterX: number,
  gridCenterY: number,
  cellW: number,
  cellH: number,
): void {
  const filtered = filterQuadrantGates(gates, quadrantSize);
  if (filtered.length === 0) return;

  const chainMap = buildChainMap(filtered);

  const toQuadrant = (x: number, y: number) => ({
    qx: Math.floor(x / quadrantSize),
    qy: Math.floor(y / quadrantSize),
  });

  ctx.save();
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.5;

  for (const gate of filtered) {
    const fromQ = toQuadrant(gate.fromX, gate.fromY);
    const toQ = toQuadrant(gate.toX, gate.toY);

    const fromDx = fromQ.qx - viewQx;
    const fromDy = fromQ.qy - viewQy;
    const toDx = toQ.qx - viewQx;
    const toDy = toQ.qy - viewQy;

    // Only draw if at least one endpoint is visible
    const fromVisible = Math.abs(fromDx) <= radiusX && Math.abs(fromDy) <= radiusY;
    const toVisible = Math.abs(toDx) <= radiusX && Math.abs(toDy) <= radiusY;
    if (!fromVisible && !toVisible) continue;

    const fromPx = gridCenterX + fromDx * cellW;
    const fromPy = gridCenterY + fromDy * cellH;
    const toPx = gridCenterX + toDx * cellW;
    const toPy = gridCenterY + toDy * cellH;

    const ci = chainMap.get(gate.gateId) ?? 0;
    ctx.strokeStyle = chainColor(ci);

    if (gate.gateType === 'wormhole') {
      ctx.setLineDash([4, 4]);
    } else {
      ctx.setLineDash([]);
    }

    ctx.beginPath();
    ctx.moveTo(fromPx, fromPy);
    ctx.lineTo(toPx, toPy);
    ctx.stroke();
  }

  ctx.setLineDash([]);
  ctx.globalAlpha = 1.0;
  ctx.restore();
}
