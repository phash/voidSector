export function euclideanDistance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

export function canCommunicate(
  playerA: { x: number; y: number; commRange: number },
  playerB: { x: number; y: number; commRange: number },
  relays: Array<{ x: number; y: number; range: number }>
): boolean {
  const directDist = euclideanDistance(playerA.x, playerA.y, playerB.x, playerB.y);
  if (directDist <= playerA.commRange + playerB.commRange) {
    return true;
  }

  // BFS through relay graph
  const nodes = [
    { x: playerA.x, y: playerA.y, range: playerA.commRange },
    ...relays,
    { x: playerB.x, y: playerB.y, range: playerB.commRange },
  ];

  const n = nodes.length;
  const visited = new Set<number>([0]);
  const queue: number[] = [0];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === n - 1) return true;

    for (let i = 0; i < n; i++) {
      if (visited.has(i)) continue;
      const dist = euclideanDistance(nodes[current].x, nodes[current].y, nodes[i].x, nodes[i].y);
      const reach = (nodes[current].range ?? 0) + (nodes[i].range ?? 0);
      if (dist <= reach) {
        visited.add(i);
        queue.push(i);
      }
    }
  }

  return false;
}
