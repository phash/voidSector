import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { JumpGatePanel } from '../components/JumpGatePanel';
import { mockStoreState } from '../test/mockStore';
import type { JumpGateInfo } from '@void-sector/shared';

vi.mock('../network/client', () => ({
  network: {
    sendUseJumpGate: vi.fn(),
    sendFrequencyMatch: vi.fn(),
  },
}));

describe('JumpGatePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStoreState({});
  });

  it('shows gate type in header', () => {
    const gate: JumpGateInfo = {
      id: 'gate-1',
      gateType: 'bidirectional',
      requiresCode: false,
      requiresMinigame: false,
      hasCode: false,
    };
    render(<JumpGatePanel gate={gate} />);
    expect(screen.getByText(/JUMPGATE — BIDIRECTIONAL/)).toBeDefined();
  });

  it('shows USE GATE button for simple gate', () => {
    const gate: JumpGateInfo = {
      id: 'gate-2',
      gateType: 'bidirectional',
      requiresCode: false,
      requiresMinigame: false,
      hasCode: false,
    };
    render(<JumpGatePanel gate={gate} />);
    expect(screen.getByText(/USE GATE/)).toBeDefined();
  });

  it('shows FREQUENZ-MATCHING STARTEN for minigame gate', () => {
    const gate: JumpGateInfo = {
      id: 'gate-3',
      gateType: 'wormhole',
      requiresCode: false,
      requiresMinigame: true,
      hasCode: false,
    };
    render(<JumpGatePanel gate={gate} />);
    expect(screen.getByText(/FREQUENZ-MATCHING STARTEN/)).toBeDefined();
    expect(screen.getByText(/ZIEL: UNBEKANNT/)).toBeDefined();
  });

  it('shows code input when code is required and not present', () => {
    const gate: JumpGateInfo = {
      id: 'gate-4',
      gateType: 'bidirectional',
      requiresCode: true,
      requiresMinigame: false,
      hasCode: false,
    };
    render(<JumpGatePanel gate={gate} />);
    expect(screen.getByText(/ACCESS CODE REQUIRED/)).toBeDefined();
    expect(screen.getByPlaceholderText('CODE')).toBeDefined();
  });

  it('shows CODE: VORHANDEN when code is already present', () => {
    const gate: JumpGateInfo = {
      id: 'gate-5',
      gateType: 'bidirectional',
      requiresCode: true,
      requiresMinigame: false,
      hasCode: true,
    };
    render(<JumpGatePanel gate={gate} />);
    expect(screen.getByText(/CODE: VORHANDEN/)).toBeDefined();
  });

  it('shows wormhole destination text', () => {
    const gate: JumpGateInfo = {
      id: 'gate-6',
      gateType: 'wormhole',
      requiresCode: false,
      requiresMinigame: false,
      hasCode: false,
    };
    render(<JumpGatePanel gate={gate} />);
    expect(screen.getByText(/EINBAHNSTRASSE/)).toBeDefined();
  });
});
