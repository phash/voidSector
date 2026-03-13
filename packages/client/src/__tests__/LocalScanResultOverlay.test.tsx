import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LocalScanResultOverlay } from '../components/overlays/LocalScanResultOverlay';
import { useStore } from '../state/store';

// Mock network
const mockSendCreateSlateFromScan = vi.fn();
vi.mock('../network/client', () => ({
  network: {
    sendCreateSlateFromScan: (...args: any[]) => mockSendCreateSlateFromScan(...args),
  },
}));

describe('LocalScanResultOverlay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useStore.setState({
      localScanResult: {
        resources: { ore: 42, gas: 18, crystal: 7 },
        hiddenSignatures: false,
        wrecks: [],
        sectorX: 16,
        sectorY: 14,
        quadrantX: 0,
        quadrantY: 0,
        sectorType: 'station',
        structures: ['npc_station'],
        universeTick: 48720,
      },
      cargo: { ore: 0, gas: 0, crystal: 0, slates: 0, artefact: 0 },
      ship: { stats: { cargoCap: 20 } } as any,
    });
  });

  it('shows sector context (quadrant, sector, type)', () => {
    render(<LocalScanResultOverlay />);
    expect(screen.getByText(/Q 0:0/)).toBeTruthy();
    expect(screen.getByText(/16, 14/)).toBeTruthy();
    expect(screen.getAllByText(/STATION/i).length).toBeGreaterThan(0);
  });

  it('shows universe tick in header', () => {
    render(<LocalScanResultOverlay />);
    expect(screen.getByText(/TICK 48720/)).toBeTruthy();
  });

  it('shows SAVE TO SLATE button', () => {
    render(<LocalScanResultOverlay />);
    expect(screen.getByText('scan.saveToSlate')).toBeTruthy();
  });

  it('disables button and shows SLATE GESPEICHERT after click', () => {
    render(<LocalScanResultOverlay />);
    const btn = screen.getByText('scan.saveToSlate');
    fireEvent.click(btn);
    expect(mockSendCreateSlateFromScan).toHaveBeenCalledOnce();
    expect(screen.getByText('scan.slateSaved')).toBeTruthy();
  });

  it('shows MEMORY VOLL when memory is full', () => {
    useStore.setState({
      cargo: { ore: 0, gas: 0, crystal: 0, slates: 2, artefact: 0 },
      ship: { stats: { cargoCap: 20, memory: 2 } } as any,
    });
    render(<LocalScanResultOverlay />);
    expect(screen.getByText('scan.slateMemoryFull')).toBeTruthy();
  });
});
