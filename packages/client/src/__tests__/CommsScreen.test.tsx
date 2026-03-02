import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CommsScreen } from '../components/CommsScreen';
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
      unreadComms: false,
    });
  });

  it('renders channel tabs', () => {
    render(<CommsScreen />);
    expect(screen.getByText('[DIRECT]')).toBeInTheDocument();
    expect(screen.getByText('[FACTION]')).toBeInTheDocument();
    expect(screen.getByText('[LOCAL]')).toBeInTheDocument();
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
      unreadComms: false,
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
});
