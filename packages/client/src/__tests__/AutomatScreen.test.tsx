import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AutomatScreen } from '../components/AutomatScreen';
import { useStore } from '../state/store';

vi.mock('../network/client', () => ({ network: {
  sendSaveProgram: vi.fn(), sendListPrograms: vi.fn(), sendDeleteProgram: vi.fn(),
  sendSetActiveProgram: vi.fn(), sendStartProgram: vi.fn(), sendStopProgram: vi.fn(),
} }));

describe('AutomatScreen', () => {
  beforeEach(() => {
    useStore.setState({ shipPrograms: [], activeShipProgramId: null, shipProgramRun: null, shipProgramLog: [], ship: { modules: [] } as any });
  });
  it('shows the empty-state when no computer is installed', () => {
    render(<AutomatScreen />);
    expect(screen.getByText(/Kein Bordcomputer/i)).toBeDefined();
  });
  it('shows templates + [?] when a computer is installed', () => {
    useStore.setState({ ship: { modules: [{ moduleId: 'computer_mk3', slotIndex: 9, source: 'standard' }] } as any });
    render(<AutomatScreen />);
    expect(screen.getByText(/Lieferlauf/)).toBeDefined();
    expect(screen.getByText('[?]')).toBeDefined();
  });
});
