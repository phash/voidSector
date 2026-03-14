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
          id: '1',
          senderId: 's1',
          senderName: 'PhashX',
          channel: 'quadrant' as const,
          content: 'Hello sector!',
          sentAt: Date.now(),
          delayed: false,
        },
      ],
      chatChannel: 'quadrant' as const,
      alerts: {},
    });
  });

  it('displays channel switcher buttons', () => {
    render(<CommsScreen />);
    expect(screen.getByText('QUAD')).toBeInTheDocument();
    expect(screen.getByText('FACT')).toBeInTheDocument();
    expect(screen.getByText('DIRE')).toBeInTheDocument();
    expect(screen.getByText('BROA')).toBeInTheDocument();
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
    expect(network.sendChat).toHaveBeenCalledWith('quadrant', 'Test message');
  });

  it('sends message on Enter key', async () => {
    render(<CommsScreen />);
    const input = screen.getByPlaceholderText('Type message...');
    await userEvent.type(input, 'Test{Enter}');
    expect(network.sendChat).toHaveBeenCalledWith('quadrant', 'Test');
  });

  it('shows NO MESSAGES when channel is empty', () => {
    mockStoreState({
      chatMessages: [],
      chatChannel: 'quadrant' as const,
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
      id: 'dup-1',
      senderId: 's1',
      senderName: 'PhashX',
      channel: 'quadrant' as const,
      content: 'Duplicate test',
      sentAt: Date.now(),
      delayed: false,
    };
    mockStoreState({
      chatMessages: [msg],
      chatChannel: 'quadrant' as const,
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
          id: '1',
          senderId: 's1',
          senderName: 'PhashX',
          channel: 'quadrant' as const,
          content: 'Quadrant message',
          sentAt: Date.now(),
          delayed: false,
        },
        {
          id: '2',
          senderId: 's2',
          senderName: 'AnotherUser',
          channel: 'direct' as const,
          content: 'Direct message',
          sentAt: Date.now(),
          delayed: false,
        },
      ],
      chatChannel: 'direct' as const,
      alerts: {},
    });
    render(<CommsScreen />);
    expect(screen.getByText(/Direct message/)).toBeInTheDocument();
    expect(screen.queryByText(/Quadrant message/)).not.toBeInTheDocument();
  });

  // --- New channel tests ---

  it('displays BROADCAST channel button', () => {
    mockStoreState({
      chatMessages: [],
      chatChannel: 'broadcast' as const,
      alerts: {},
    });
    render(<CommsScreen />);
    expect(screen.getByText('BROA')).toBeInTheDocument();
  });

  it('displays QUADRANT channel button', () => {
    mockStoreState({
      chatMessages: [],
      chatChannel: 'quadrant' as const,
      alerts: {},
    });
    render(<CommsScreen />);
    expect(screen.getByText('QUAD')).toBeInTheDocument();
  });

  it('filters broadcast channel messages', () => {
    mockStoreState({
      chatMessages: [
        {
          id: '1',
          senderId: 's1',
          senderName: 'Player1',
          channel: 'broadcast' as const,
          content: 'Broadcast hello',
          sentAt: Date.now(),
          delayed: false,
        },
        {
          id: '2',
          senderId: 's2',
          senderName: 'Player2',
          channel: 'quadrant' as const,
          content: 'Quadrant hello',
          sentAt: Date.now(),
          delayed: false,
        },
      ],
      chatChannel: 'broadcast' as const,
      alerts: {},
    });
    render(<CommsScreen />);
    expect(screen.getByText(/Broadcast hello/)).toBeInTheDocument();
    expect(screen.queryByText(/Quadrant hello/)).not.toBeInTheDocument();
  });

  it('filters quadrant channel messages', () => {
    mockStoreState({
      chatMessages: [
        {
          id: '1',
          senderId: 's1',
          senderName: 'Player1',
          channel: 'quadrant' as const,
          content: 'Quadrant hello',
          sentAt: Date.now(),
          delayed: false,
        },
        {
          id: '2',
          senderId: 's2',
          senderName: 'Player2',
          channel: 'broadcast' as const,
          content: 'Broadcast hello',
          sentAt: Date.now(),
          delayed: false,
        },
      ],
      chatChannel: 'quadrant' as const,
      alerts: {},
    });
    render(<CommsScreen />);
    expect(screen.getByText(/Quadrant hello/)).toBeInTheDocument();
    expect(screen.queryByText(/Broadcast hello/)).not.toBeInTheDocument();
  });

  // --- Address book tests ---

  describe('address book (direct channel)', () => {
    beforeEach(() => {
      mockStoreState({
        chatMessages: [],
        chatChannel: 'direct' as const,
        alerts: {},
        recentContacts: [
          { id: 'p1', name: 'Alice' },
          { id: 'p2', name: 'Bob' },
        ],
      });
    });

    it('shows TO: indicator on direct channel', () => {
      render(<CommsScreen />);
      expect(screen.getByText('TO:')).toBeInTheDocument();
    });

    it('shows CONTACTS button on direct channel', () => {
      render(<CommsScreen />);
      expect(screen.getByText('[CONTACTS]')).toBeInTheDocument();
    });

    it('does not show CONTACTS button on other channels', () => {
      mockStoreState({
        chatMessages: [],
        chatChannel: 'quadrant' as const,
        alerts: {},
      });
      render(<CommsScreen />);
      expect(screen.queryByText('[CONTACTS]')).not.toBeInTheDocument();
    });

    it('shows contact list when CONTACTS button is clicked', async () => {
      render(<CommsScreen />);
      await userEvent.click(screen.getByText('[CONTACTS]'));
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Bob')).toBeInTheDocument();
    });

    it('selects a contact from the list', async () => {
      render(<CommsScreen />);
      await userEvent.click(screen.getByText('[CONTACTS]'));
      await userEvent.click(screen.getByText('Alice'));
      // Contact list should close and name should show
      expect(screen.queryByTestId('contacts-list')).not.toBeInTheDocument();
    });

    it('shows NO RECENT CONTACTS when list is empty', async () => {
      mockStoreState({
        chatMessages: [],
        chatChannel: 'direct' as const,
        alerts: {},
        recentContacts: [],
      });
      render(<CommsScreen />);
      await userEvent.click(screen.getByText('[CONTACTS]'));
      expect(screen.getByText('NO RECENT CONTACTS')).toBeInTheDocument();
    });

    it('does not send direct message without recipient', async () => {
      render(<CommsScreen />);
      const input = screen.getByPlaceholderText('Type message...');
      await userEvent.type(input, 'Hello{Enter}');
      expect(network.sendChat).not.toHaveBeenCalled();
    });

    it('sends direct message with selected recipient', async () => {
      render(<CommsScreen />);
      // Select a contact
      await userEvent.click(screen.getByText('[CONTACTS]'));
      await userEvent.click(screen.getByText('Alice'));
      // Type and send
      const input = screen.getByPlaceholderText('Type message...');
      await userEvent.type(input, 'Hello Alice{Enter}');
      expect(network.sendChat).toHaveBeenCalledWith('direct', 'Hello Alice', 'p1');
    });
  });
});
