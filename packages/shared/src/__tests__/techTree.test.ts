import { describe, it, expect } from 'vitest';
import {
  TECH_TREE_NODES,
  getTechNode,
  getChildNodes,
  getExclusiveGroup,
  TechNodeType,
} from '../techTree';

describe('TECH_TREE_NODES', () => {
  it('has 4 root branches with parent null', () => {
    const roots = Object.values(TECH_TREE_NODES).filter((n) => n.parent === null);
    expect(roots).toHaveLength(4);
    expect(roots.map((r) => r.id).sort()).toEqual(['ausbau', 'explorer', 'intel', 'kampf']);
  });

  it('all nodes have valid parent references', () => {
    for (const node of Object.values(TECH_TREE_NODES)) {
      if (node.parent !== null) {
        expect(TECH_TREE_NODES[node.parent]).toBeDefined();
      }
    }
  });

  it('exclusive groups have 2+ members', () => {
    const groups = new Map<string, string[]>();
    for (const node of Object.values(TECH_TREE_NODES)) {
      if (node.exclusiveGroup) {
        const arr = groups.get(node.exclusiveGroup) ?? [];
        arr.push(node.id);
        groups.set(node.exclusiveGroup, arr);
      }
    }
    for (const [group, members] of groups) {
      expect(members.length, `group ${group}`).toBeGreaterThanOrEqual(2);
    }
  });

  it('has exactly 148 nodes total', () => {
    expect(Object.keys(TECH_TREE_NODES).length).toBe(148);
  });

  it('spec-leaves have depth 3 (one deeper than module-leaves)', () => {
    const specLeaves = Object.values(TECH_TREE_NODES).filter(
      (n) => n.type === 'leaf' && TECH_TREE_NODES[n.parent!]?.type === 'specialization',
    );
    expect(specLeaves.length).toBe(72);
    for (const sl of specLeaves) {
      expect(sl.depth, `${sl.id} depth`).toBe(3);
    }
  });
});

describe('getTechNode', () => {
  it('returns node by id', () => {
    const node = getTechNode('kampf');
    expect(node).toBeDefined();
    expect(node!.type).toBe('branch');
    expect(node!.branch).toBe('kampf');
  });

  it('returns undefined for invalid id', () => {
    expect(getTechNode('nonexistent')).toBeUndefined();
  });
});

describe('getChildNodes', () => {
  it('returns children of kampf branch', () => {
    const children = getChildNodes('kampf');
    expect(children.map((c) => c.id).sort()).toEqual([
      'kampf.laser',
      'kampf.missile',
      'kampf.railgun',
    ]);
  });
});

describe('getExclusiveGroup', () => {
  it('laser/missile/railgun share exclusive group', () => {
    const laserGroup = getExclusiveGroup('kampf.laser');
    const missileGroup = getExclusiveGroup('kampf.missile');
    expect(laserGroup).toBe(missileGroup);
    expect(laserGroup).toBeDefined();
  });
});
