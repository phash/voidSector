import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DetailPanel } from '../components/DetailPanel';
import { mockStoreState } from '../test/mockStore';

describe('DetailPanel', () => {
  beforeEach(() => {
    mockStoreState({ selectedSector: null });
  });

  it('shows placeholder when no sector selected', () => {
    render(<DetailPanel />);
    expect(screen.getByText('SELECT A SECTOR')).toBeTruthy();
  });

  it('shows sector coordinates when sector selected', () => {
    mockStoreState({
      selectedSector: { x: 5, y: 3 },
      discoveries: {
        '0:0': { x: 0, y: 0, type: 'empty', seed: 42, discoveredBy: null, discoveredAt: null, metadata: {} },
        '5:3': { x: 5, y: 3, type: 'nebula', seed: 99, discoveredBy: null, discoveredAt: null, metadata: {} },
      },
    });
    render(<DetailPanel />);
    expect(screen.getByText(/SECTOR \(5, 3\)/)).toBeTruthy();
    expect(screen.getByText('NEBULA')).toBeTruthy();
  });

  it('shows UNEXPLORED for unscanned sector', () => {
    mockStoreState({
      selectedSector: { x: 10, y: 10 },
      discoveries: {},
    });
    render(<DetailPanel />);
    expect(screen.getByText('UNEXPLORED')).toBeTruthy();
  });

  it('shows YOU ARE HERE when at player position', () => {
    mockStoreState({
      selectedSector: { x: 0, y: 0 },
      position: { x: 0, y: 0 },
      discoveries: {
        '0:0': { x: 0, y: 0, type: 'empty', seed: 42, discoveredBy: null, discoveredAt: null, metadata: {} },
      },
    });
    render(<DetailPanel />);
    expect(screen.getByText('YOU ARE HERE')).toBeTruthy();
  });

  it('shows resources when sector has them', () => {
    mockStoreState({
      selectedSector: { x: 1, y: 1 },
      discoveries: {
        '1:1': {
          x: 1, y: 1, type: 'asteroid_field', seed: 55,
          discoveredBy: null, discoveredAt: null, metadata: {},
          resources: { ore: 50, gas: 10, crystal: 5 },
        },
      },
    });
    render(<DetailPanel />);
    expect(screen.getByText(/ORE/)).toBeTruthy();
    expect(screen.getByText(/50/)).toBeTruthy();
  });

  it('shows other players in sector', () => {
    mockStoreState({
      selectedSector: { x: 0, y: 0 },
      position: { x: 0, y: 0 },
      players: {
        's1': { sessionId: 's1', username: 'SpacePilot', x: 0, y: 0, connected: true },
      },
      discoveries: {
        '0:0': { x: 0, y: 0, type: 'empty', seed: 42, discoveredBy: null, discoveredAt: null, metadata: {} },
      },
    });
    render(<DetailPanel />);
    expect(screen.getByText('SpacePilot')).toBeTruthy();
  });
});
