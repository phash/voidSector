import { JUMPGATE_MAX_CHAIN_HOPS } from '@void-sector/shared';
import type { JumpGateDestination } from '@void-sector/shared';

interface GateInfo {
  id: string;
  sectorX: number;
  sectorY: number;
  tollCredits: number;
}

export function findReachableGates(
  startGateId: string,
  gates: Map<string, GateInfo>,
  links: Map<string, string[]>,
): JumpGateDestination[] {
  const results: JumpGateDestination[] = [];
  const visited = new Set<string>([startGateId]);

  // BFS: [gateId, accumulatedCost, hops]
  const queue: Array<[string, number, number]> = [];

  const startGate = gates.get(startGateId);
  if (!startGate) return results;

  // Seed with direct neighbors
  const neighbors = links.get(startGateId) ?? [];
  for (const neighborId of neighbors) {
    if (!visited.has(neighborId)) {
      queue.push([neighborId, startGate.tollCredits, 1]);
      visited.add(neighborId);
    }
  }

  while (queue.length > 0) {
    const [currentId, cost, hops] = queue.shift()!;
    const gate = gates.get(currentId);
    if (!gate) continue;

    results.push({
      gateId: currentId,
      sectorX: gate.sectorX,
      sectorY: gate.sectorY,
      totalCost: cost,
      hops,
    });

    if (hops >= JUMPGATE_MAX_CHAIN_HOPS) continue;

    const nextNeighbors = links.get(currentId) ?? [];
    for (const nextId of nextNeighbors) {
      if (!visited.has(nextId)) {
        visited.add(nextId);
        queue.push([nextId, cost + gate.tollCredits, hops + 1]);
      }
    }
  }

  return results;
}
