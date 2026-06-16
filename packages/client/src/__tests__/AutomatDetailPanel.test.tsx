import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AutomatDetailPanel } from '../components/AutomatDetailPanel';
import { useStore } from '../state/store';

describe('AutomatDetailPanel', () => {
  beforeEach(() => {
    useStore.setState({
      shipProgramRun: { status: 'running', pc: 2 },
      shipProgramLog: ['15 abgebaut', '300 Credits erhalten'],
      ship: { modules: [{ moduleId: 'computer_mk2', slotIndex: 9, source: 'standard' }] } as any,
    });
  });
  it('shows the MK level, run status, and log lines', () => {
    render(<AutomatDetailPanel />);
    expect(screen.getByText(/MK\.2|MK\.II/)).toBeDefined();
    expect(screen.getByText(/LÄUFT/)).toBeDefined();
    expect(screen.getByText(/300 Credits erhalten/)).toBeDefined();
  });
});
