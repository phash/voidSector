import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NavTargetPanel } from '../components/NavTargetPanel';
import { mockStoreState } from '../test/mockStore';

vi.mock('../network/client', () => ({
  network: {
    sendStartAutopilot: vi.fn(),
    sendCancelAutopilot: vi.fn(),
    sendGetAutopilotStatus: vi.fn(),
  },
}));

import { network } from '../network/client';

describe('NavTargetPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStoreState({
      position: { x: 0, y: 0 },
      bookmarks: [],
      autopilot: null,
      autopilotStatus: null,
      navTarget: null,
      fuel: { current: 100, max: 100 },
      ap: { current: 100, max: 100, lastTick: Date.now(), regenPerSecond: 0.5 },
      discoveries: {
        '0:0': {
          x: 0,
          y: 0,
          type: 'empty',
          seed: 42,
          discoveredBy: null,
          discoveredAt: null,
          metadata: {},
          environment: 'empty' as const,
          contents: [],
        },
      },
      selectedSector: null,
    });
  });

  it('renders NAV TARGET header', () => {
    render(<NavTargetPanel />);
    expect(screen.getByText('NAV TARGET')).toBeDefined();
  });

  it('renders X and Y coordinate inputs', () => {
    render(<NavTargetPanel />);
    expect(screen.getByLabelText('Target X')).toBeDefined();
    expect(screen.getByLabelText('Target Y')).toBeDefined();
  });

  it('renders ENGAGE button', () => {
    render(<NavTargetPanel />);
    expect(screen.getByText('[ENGAGE]')).toBeDefined();
  });

  it('disables ENGAGE when no target is set', () => {
    render(<NavTargetPanel />);
    const btn = screen.getByText('[ENGAGE]');
    expect(btn.closest('button')?.disabled).toBe(true);
  });

  it('disables ENGAGE when target is current position', () => {
    render(<NavTargetPanel />);
    const inputX = screen.getByLabelText('Target X');
    const inputY = screen.getByLabelText('Target Y');
    fireEvent.change(inputX, { target: { value: '0' } });
    fireEvent.change(inputY, { target: { value: '0' } });
    const btn = screen.getByText('[ENGAGE]');
    expect(btn.closest('button')?.disabled).toBe(true);
  });

  it('enables ENGAGE when target is valid and discovered', () => {
    mockStoreState({
      position: { x: 0, y: 0 },
      discoveries: {
        '0:0': {
          x: 0,
          y: 0,
          type: 'empty',
          seed: 42,
          discoveredBy: null,
          discoveredAt: null,
          metadata: {},
          environment: 'empty' as const,
          contents: [],
        },
        '5:5': {
          x: 5,
          y: 5,
          type: 'empty',
          seed: 100,
          discoveredBy: null,
          discoveredAt: null,
          metadata: {},
          environment: 'empty' as const,
          contents: [],
        },
      },
      fuel: { current: 100, max: 100 },
      ap: { current: 100, max: 100, lastTick: Date.now(), regenPerSecond: 0.5 },
      autopilot: null,
      autopilotStatus: null,
      navTarget: null,
      bookmarks: [],
      selectedSector: null,
    });
    render(<NavTargetPanel />);
    const inputX = screen.getByLabelText('Target X');
    const inputY = screen.getByLabelText('Target Y');
    fireEvent.change(inputX, { target: { value: '5' } });
    fireEvent.change(inputY, { target: { value: '5' } });
    const btn = screen.getByText('[ENGAGE]');
    expect(btn.closest('button')?.disabled).toBe(false);
  });

  it('calls sendStartAutopilot on ENGAGE click', () => {
    mockStoreState({
      position: { x: 0, y: 0 },
      discoveries: {
        '0:0': {
          x: 0,
          y: 0,
          type: 'empty',
          seed: 42,
          discoveredBy: null,
          discoveredAt: null,
          metadata: {},
          environment: 'empty' as const,
          contents: [],
        },
        '3:4': {
          x: 3,
          y: 4,
          type: 'station',
          seed: 99,
          discoveredBy: null,
          discoveredAt: null,
          metadata: {},
          environment: 'empty' as const,
          contents: [],
        },
      },
      fuel: { current: 100, max: 100 },
      ap: { current: 100, max: 100, lastTick: Date.now(), regenPerSecond: 0.5 },
      autopilot: null,
      autopilotStatus: null,
      navTarget: null,
      bookmarks: [],
      selectedSector: null,
    });
    render(<NavTargetPanel />);
    fireEvent.change(screen.getByLabelText('Target X'), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText('Target Y'), { target: { value: '4' } });
    fireEvent.click(screen.getByText('[ENGAGE]'));
    expect(network.sendStartAutopilot).toHaveBeenCalledWith(3, 4, false);
  });

  it('sends hyperjump flag when checkbox is checked', () => {
    mockStoreState({
      position: { x: 0, y: 0 },
      discoveries: {
        '0:0': {
          x: 0,
          y: 0,
          type: 'empty',
          seed: 42,
          discoveredBy: null,
          discoveredAt: null,
          metadata: {},
          environment: 'empty' as const,
          contents: [],
        },
        '2:2': {
          x: 2,
          y: 2,
          type: 'empty',
          seed: 77,
          discoveredBy: null,
          discoveredAt: null,
          metadata: {},
          environment: 'empty' as const,
          contents: [],
        },
      },
      fuel: { current: 10000, max: 10000 },
      ap: { current: 100, max: 100, lastTick: Date.now(), regenPerSecond: 0.5 },
      autopilot: null,
      autopilotStatus: null,
      navTarget: null,
      bookmarks: [],
      selectedSector: null,
    });
    render(<NavTargetPanel />);
    fireEvent.change(screen.getByLabelText('Target X'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Target Y'), { target: { value: '2' } });
    fireEvent.click(screen.getByText('HYPERJUMP'));
    fireEvent.click(screen.getByText('[ENGAGE]'));
    expect(network.sendStartAutopilot).toHaveBeenCalledWith(2, 2, true);
  });

  it('shows active autopilot with progress bar and cancel', () => {
    mockStoreState({
      position: { x: 2, y: 2 },
      autopilot: { targetX: 10, targetY: 10, remaining: 8, active: true },
      autopilotStatus: {
        targetX: 10,
        targetY: 10,
        currentStep: 8,
        totalSteps: 16,
        status: 'active' as const,
        useHyperjump: false,
      },
      navTarget: { x: 10, y: 10 },
      bookmarks: [],
      discoveries: {},
      fuel: { current: 100, max: 100 },
      ap: { current: 100, max: 100, lastTick: Date.now(), regenPerSecond: 0.5 },
      selectedSector: null,
    });
    render(<NavTargetPanel />);
    expect(screen.getByText('AUTOPILOT AKTIV')).toBeDefined();
    expect(screen.getByText(/Schritt 8 \/ 16/)).toBeDefined();
    expect(screen.getByTestId('autopilot-progress-bar')).toBeDefined();
    expect(screen.getByText('[ABBRECHEN]')).toBeDefined();
  });

  it('calls sendCancelAutopilot on cancel click', () => {
    mockStoreState({
      position: { x: 2, y: 2 },
      autopilot: { targetX: 10, targetY: 10, remaining: 8, active: true },
      autopilotStatus: {
        targetX: 10,
        targetY: 10,
        currentStep: 8,
        totalSteps: 16,
        status: 'active' as const,
        useHyperjump: false,
      },
      navTarget: { x: 10, y: 10 },
      bookmarks: [],
      discoveries: {},
      fuel: { current: 100, max: 100 },
      ap: { current: 100, max: 100, lastTick: Date.now(), regenPerSecond: 0.5 },
      selectedSector: null,
    });
    render(<NavTargetPanel />);
    fireEvent.click(screen.getByText('[ABBRECHEN]'));
    expect(network.sendCancelAutopilot).toHaveBeenCalled();
  });

  it('shows cost preview when target is set', () => {
    mockStoreState({
      position: { x: 0, y: 0 },
      discoveries: {
        '0:0': {
          x: 0,
          y: 0,
          type: 'empty',
          seed: 42,
          discoveredBy: null,
          discoveredAt: null,
          metadata: {},
          environment: 'empty' as const,
          contents: [],
        },
        '5:0': {
          x: 5,
          y: 0,
          type: 'empty',
          seed: 10,
          discoveredBy: null,
          discoveredAt: null,
          metadata: {},
          environment: 'empty' as const,
          contents: [],
        },
      },
      fuel: { current: 100, max: 100 },
      ap: { current: 100, max: 100, lastTick: Date.now(), regenPerSecond: 0.5 },
      autopilot: null,
      autopilotStatus: null,
      navTarget: null,
      bookmarks: [],
      selectedSector: null,
    });
    render(<NavTargetPanel />);
    fireEvent.change(screen.getByLabelText('Target X'), { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText('Target Y'), { target: { value: '0' } });
    expect(screen.getByText(/Distanz: 5 Sektoren/)).toBeDefined();
    expect(screen.getByText(/AP: ~5/)).toBeDefined();
  });

  it('shows bookmark dropdown when bookmarks exist', () => {
    mockStoreState({
      position: { x: 0, y: 0 },
      bookmarks: [
        { slot: 1, sectorX: 10, sectorY: 20, label: 'Mining Base' },
        { slot: 2, sectorX: -5, sectorY: 3, label: '' },
      ],
      autopilot: null,
      autopilotStatus: null,
      navTarget: null,
      fuel: { current: 100, max: 100 },
      ap: { current: 100, max: 100, lastTick: Date.now(), regenPerSecond: 0.5 },
      discoveries: {},
      selectedSector: null,
    });
    render(<NavTargetPanel />);
    expect(screen.getByLabelText('Select bookmark')).toBeDefined();
    expect(screen.getByText(/Mining Base/)).toBeDefined();
  });

  it('populates coordinates when bookmark is selected', () => {
    mockStoreState({
      position: { x: 0, y: 0 },
      bookmarks: [{ slot: 1, sectorX: 10, sectorY: 20, label: 'Mining Base' }],
      autopilot: null,
      autopilotStatus: null,
      navTarget: null,
      fuel: { current: 100, max: 100 },
      ap: { current: 100, max: 100, lastTick: Date.now(), regenPerSecond: 0.5 },
      discoveries: {},
      selectedSector: null,
    });
    render(<NavTargetPanel />);
    fireEvent.change(screen.getByLabelText('Select bookmark'), { target: { value: '10,20' } });
    expect((screen.getByLabelText('Target X') as HTMLInputElement).value).toBe('10');
    expect((screen.getByLabelText('Target Y') as HTMLInputElement).value).toBe('20');
  });

  it('shows paused status when autopilot is paused', () => {
    mockStoreState({
      position: { x: 3, y: 3 },
      autopilot: null,
      autopilotStatus: {
        targetX: 10,
        targetY: 10,
        currentStep: 5,
        totalSteps: 12,
        status: 'paused' as const,
        useHyperjump: false,
        pauseReason: 'fuel_exhausted',
      },
      navTarget: { x: 10, y: 10 },
      bookmarks: [],
      discoveries: {},
      fuel: { current: 0, max: 100 },
      ap: { current: 100, max: 100, lastTick: Date.now(), regenPerSecond: 0.5 },
      selectedSector: null,
    });
    render(<NavTargetPanel />);
    expect(screen.getByText('AUTOPILOT PAUSIERT')).toBeDefined();
    expect(screen.getByText(/fuel_exhausted/)).toBeDefined();
  });

  it('warns when target sector not discovered', () => {
    mockStoreState({
      position: { x: 0, y: 0 },
      discoveries: {
        '0:0': {
          x: 0,
          y: 0,
          type: 'empty',
          seed: 42,
          discoveredBy: null,
          discoveredAt: null,
          metadata: {},
          environment: 'empty' as const,
          contents: [],
        },
      },
      fuel: { current: 100, max: 100 },
      ap: { current: 100, max: 100, lastTick: Date.now(), regenPerSecond: 0.5 },
      autopilot: null,
      autopilotStatus: null,
      navTarget: null,
      bookmarks: [],
      selectedSector: null,
    });
    render(<NavTargetPanel />);
    fireEvent.change(screen.getByLabelText('Target X'), { target: { value: '99' } });
    fireEvent.change(screen.getByLabelText('Target Y'), { target: { value: '99' } });
    expect(screen.getByText('Ziel nicht entdeckt!')).toBeDefined();
  });

  it('hides coordinate inputs during active autopilot', () => {
    mockStoreState({
      position: { x: 2, y: 2 },
      autopilot: { targetX: 10, targetY: 10, remaining: 8, active: true },
      autopilotStatus: {
        targetX: 10,
        targetY: 10,
        currentStep: 8,
        totalSteps: 16,
        status: 'active' as const,
        useHyperjump: false,
      },
      navTarget: { x: 10, y: 10 },
      bookmarks: [],
      discoveries: {},
      fuel: { current: 100, max: 100 },
      ap: { current: 100, max: 100, lastTick: Date.now(), regenPerSecond: 0.5 },
      selectedSector: null,
    });
    render(<NavTargetPanel />);
    expect(screen.queryByLabelText('Target X')).toBeNull();
    expect(screen.queryByLabelText('Target Y')).toBeNull();
    expect(screen.queryByText('[ENGAGE]')).toBeNull();
  });
});
