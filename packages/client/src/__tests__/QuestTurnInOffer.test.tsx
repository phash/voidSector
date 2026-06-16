import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QuestTurnInOffer } from '../components/overlays/QuestTurnInOffer';
import { useStore } from '../state/store';

// Mock network
const mockSendTurnInQuest = vi.fn();
vi.mock('../network/client', () => ({
  network: {
    sendTurnInQuest: (...args: any[]) => mockSendTurnInQuest(...args),
  },
}));

describe('QuestTurnInOffer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useStore.setState({ questTurnInOffer: null });
  });

  it('renders the title and both buttons when an offer is present', () => {
    useStore.setState({ questTurnInOffer: { questId: 'q1', title: 'Erforsche 7:1' } });
    render(<QuestTurnInOffer />);
    expect(screen.getByText(/Erforsche 7:1/)).toBeTruthy();
    expect(screen.getByText(/QUEST ABSCHLIESSEN/i)).toBeTruthy();
    expect(screen.getByText(/SPÄTER/i)).toBeTruthy();
  });

  it('renders nothing when there is no offer', () => {
    useStore.setState({ questTurnInOffer: null });
    const { container } = render(<QuestTurnInOffer />);
    expect(container.firstChild).toBeNull();
  });

  it('confirms turn-in: calls sendTurnInQuest and clears the offer', () => {
    useStore.setState({ questTurnInOffer: { questId: 'q1', title: 'Erforsche 7:1' } });
    render(<QuestTurnInOffer />);
    fireEvent.click(screen.getByText(/QUEST ABSCHLIESSEN/i));
    expect(mockSendTurnInQuest).toHaveBeenCalledWith('q1');
    expect(useStore.getState().questTurnInOffer).toBeNull();
  });

  it('dismisses with SPÄTER: clears the offer without calling sendTurnInQuest', () => {
    useStore.setState({ questTurnInOffer: { questId: 'q1', title: 'Erforsche 7:1' } });
    render(<QuestTurnInOffer />);
    fireEvent.click(screen.getByText(/SPÄTER/i));
    expect(mockSendTurnInQuest).not.toHaveBeenCalled();
    expect(useStore.getState().questTurnInOffer).toBeNull();
  });
});
