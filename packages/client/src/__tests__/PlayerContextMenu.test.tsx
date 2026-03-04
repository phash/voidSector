import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PlayerContextMenu } from '../components/PlayerContextMenu';
import { useStore } from '../state/store';
import { mockStoreState } from '../test/mockStore';

vi.mock('../network/client', () => ({ network: {} }));

describe('PlayerContextMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStoreState({
      contextMenu: null,
      closeContextMenu: () => useStore.setState({ contextMenu: null }),
    });
  });

  it('renders nothing when contextMenu is null', () => {
    const { container } = render(<PlayerContextMenu />);
    expect(container.innerHTML).toBe('');
  });

  it('renders menu with player name and options', () => {
    mockStoreState({
      contextMenu: { playerId: 'p1', playerName: 'TestPlayer', x: 100, y: 200 },
      closeContextMenu: () => useStore.setState({ contextMenu: null }),
    });
    render(<PlayerContextMenu />);
    expect(screen.getByText('TestPlayer')).toBeInTheDocument();
    expect(screen.getByText('NACHRICHT SENDEN')).toBeInTheDocument();
    expect(screen.getByText(/VISITENKARTE/)).toBeInTheDocument();
  });

  it('closes on backdrop click', () => {
    mockStoreState({
      contextMenu: { playerId: 'p1', playerName: 'TestPlayer', x: 100, y: 200 },
      closeContextMenu: () => useStore.setState({ contextMenu: null }),
    });
    render(<PlayerContextMenu />);
    fireEvent.click(screen.getByTestId('context-menu-backdrop'));
    expect(useStore.getState().contextMenu).toBeNull();
  });

  it('switches to direct channel and sets recipient on NACHRICHT SENDEN click', () => {
    mockStoreState({
      contextMenu: { playerId: 'p1', playerName: 'TestPlayer', x: 100, y: 200 },
      chatChannel: 'quadrant' as const,
      directChatRecipient: null,
      closeContextMenu: () => useStore.setState({ contextMenu: null }),
    });
    render(<PlayerContextMenu />);
    fireEvent.click(screen.getByTestId('ctx-direct-msg'));

    const state = useStore.getState();
    expect(state.chatChannel).toBe('direct');
    expect(state.directChatRecipient).toEqual({ id: 'p1', name: 'TestPlayer' });
    expect(state.contextMenu).toBeNull();
  });

  it('positions menu at provided coordinates', () => {
    mockStoreState({
      contextMenu: { playerId: 'p1', playerName: 'TestPlayer', x: 150, y: 300 },
      closeContextMenu: () => useStore.setState({ contextMenu: null }),
    });
    render(<PlayerContextMenu />);
    const menu = screen.getByTestId('context-menu');
    expect(menu.style.left).toBe('150px');
    expect(menu.style.top).toBe('300px');
  });
});
