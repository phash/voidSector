import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CommsScreen } from '../components/CommsScreen';
import { useStore } from '../state/store';
import { mockStoreState } from '../test/mockStore';

vi.mock('../network/client', () => ({
  network: {
    sendChat: vi.fn(),
  },
}));

import { network } from '../network/client';

describe('CommsScreen', () => {
  beforeEach(() => {
    // jsdom does not implement scrollTo
    Element.prototype.scrollTo = vi.fn();
    vi.clearAllMocks();
    mockStoreState({
      chatMessages: [
        {
          id: '1', senderId: 's1', senderName: 'PhashX',
          channel: 'local' as const, content: 'Hello sector!',
          sentAt: Date.now(), delayed: false,
        },
      ],
      chatChannel: 'local' as const,
      alerts: {},
    });
  });

  it('displays channel indicator from store', () => {
    render(<CommsScreen />);
    expect(screen.getByText('LOCAL')).toBeInTheDocument();
    expect(screen.getByText(/CHANNEL:/)).toBeInTheDocument();
  });

  it('displays messages for active channel', () => {
    render(<CommsScreen />);
    expect(screen.getByText(/PhashX/)).toBeInTheDocument();
    expect(screen.getByText(/Hello sector!/)).toBeInTheDocument();
  });

  it('sends message on SEND click', async () => {
    render(<CommsScreen />);
    const input = screen.getByPlaceholderText('Type message...');
    await userEvent.type(input, 'Test message');
    await userEvent.click(screen.getByText('[SEND]'));
    expect(network.sendChat).toHaveBeenCalledWith('local', 'Test message');
  });

  it('sends message on Enter key', async () => {
    render(<CommsScreen />);
    const input = screen.getByPlaceholderText('Type message...');
    await userEvent.type(input, 'Test{Enter}');
    expect(network.sendChat).toHaveBeenCalledWith('local', 'Test');
  });

  it('shows NO MESSAGES when channel is empty', () => {
    mockStoreState({
      chatMessages: [],
      chatChannel: 'local' as const,
      alerts: {},
    });
    render(<CommsScreen />);
    expect(screen.getByText(/NO MESSAGES ON THIS CHANNEL/)).toBeInTheDocument();
  });

  it('clears input after sending', async () => {
    render(<CommsScreen />);
    const input = screen.getByPlaceholderText('Type message...');
    await userEvent.type(input, 'Test message');
    await userEvent.click(screen.getByText('[SEND]'));
    expect(input).toHaveValue('');
  });

  it('does not send empty messages', async () => {
    render(<CommsScreen />);
    await userEvent.click(screen.getByText('[SEND]'));
    expect(network.sendChat).not.toHaveBeenCalled();
  });

  it('does not display duplicate messages when same id is added twice', () => {
    const msg = {
      id: 'dup-1', senderId: 's1', senderName: 'PhashX',
      channel: 'local' as const, content: 'Duplicate test',
      sentAt: Date.now(), delayed: false,
    };
    mockStoreState({
      chatMessages: [msg],
      chatChannel: 'local' as const,
      alerts: {},
    });

    // Simulate server sending the same message again (e.g. on reconnect)
    useStore.getState().addChatMessage(msg);

    render(<CommsScreen />);
    const matches = screen.getAllByText(/Duplicate test/);
    expect(matches).toHaveLength(1);
  });

  it('filters messages by active channel from store', () => {
    mockStoreState({
      chatMessages: [
        {
          id: '1', senderId: 's1', senderName: 'PhashX',
          channel: 'local' as const, content: 'Local message',
          sentAt: Date.now(), delayed: false,
        },
        {
          id: '2', senderId: 's2', senderName: 'AnotherUser',
          channel: 'direct' as const, content: 'Direct message',
          sentAt: Date.now(), delayed: false,
        },
      ],
      chatChannel: 'direct' as const,
      alerts: {},
    });
    render(<CommsScreen />);
    expect(screen.getByText(/Direct message/)).toBeInTheDocument();
    expect(screen.queryByText(/Local message/)).not.toBeInTheDocument();
  });
});
