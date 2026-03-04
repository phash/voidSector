import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CommsScreen } from '../components/CommsScreen';
import { mockStoreState } from '../test/mockStore';
import type { AdminCommMessage, AdminQuestOffer } from '@void-sector/shared';

vi.mock('../network/client', () => ({
  network: {
    sendChat: vi.fn(),
    sendAcceptAdminQuest: vi.fn(),
    sendDeclineAdminQuest: vi.fn(),
    sendAdminCommReply: vi.fn(),
  },
}));

import { network } from '../network/client';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const makeAdminComm = (overrides: Partial<AdminCommMessage> = {}): AdminCommMessage => ({
  id: 'ac-1',
  adminName: 'GM_Zeus',
  scope: 'universal',
  content: 'Server maintenance in 10 minutes.',
  allowReply: false,
  sentAt: Date.now(),
  ...overrides,
});

const makeAdminQuestOffer = (overrides: Partial<AdminQuestOffer> = {}): AdminQuestOffer => ({
  adminQuestId: 'aq-1',
  scope: 'universal',
  title: 'Recover the Artifact',
  description: 'Find the lost artifact in sector 5,5.',
  npcName: 'Commander Vex',
  npcFactionId: 'pirates',
  introText: 'Pilot, I need your help.',
  objectives: [{ type: 'scan', description: 'Scan sector 5,5', fulfilled: false }],
  rewards: { credits: 5000, xp: 200 },
  ...overrides,
});

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

  // ── ADMIN tab ───────────────────────────────────────────────────────────────

  it('renders ADMIN tab button', () => {
    render(<CommsScreen />);
    expect(screen.getByText('[ADMIN]')).toBeInTheDocument();
  });

  it('auto-activates ADMIN tab when admin comms arrive', async () => {
    mockStoreState({
      chatMessages: [],
      chatChannel: 'local' as const,
      alerts: {},
      adminComms: [makeAdminComm()],
      adminQuestOffers: [],
    });
    render(<CommsScreen />);
    await waitFor(() =>
      expect(screen.getByText(/Server maintenance/)).toBeInTheDocument()
    );
  });

  it('shows admin message content on ADMIN tab', async () => {
    mockStoreState({
      chatMessages: [],
      chatChannel: 'local' as const,
      alerts: {},
      adminComms: [makeAdminComm({ content: 'Event starts now!' })],
      adminQuestOffers: [],
    });
    render(<CommsScreen />);
    await userEvent.click(screen.getByText(/\[ADMIN/));
    expect(screen.getByText('Event starts now!')).toBeInTheDocument();
  });

  it('shows admin name and scope on message card', async () => {
    mockStoreState({
      chatMessages: [],
      chatChannel: 'local' as const,
      alerts: {},
      adminComms: [makeAdminComm({ adminName: 'GM_Zeus', scope: 'universal' })],
      adminQuestOffers: [],
    });
    render(<CommsScreen />);
    await userEvent.click(screen.getByText(/\[ADMIN/));
    expect(screen.getByText(/Admin:GM_Zeus/)).toBeInTheDocument();
    expect(screen.getByText('[UNIVERSAL]')).toBeInTheDocument();
  });

  it('shows [ANTWORTEN] button for allowReply messages', async () => {
    mockStoreState({
      chatMessages: [],
      chatChannel: 'local' as const,
      alerts: {},
      adminComms: [makeAdminComm({ allowReply: true })],
      adminQuestOffers: [],
    });
    render(<CommsScreen />);
    await userEvent.click(screen.getByText(/\[ADMIN/));
    expect(screen.getByText('[ANTWORTEN]')).toBeInTheDocument();
  });

  it('does not show [ANTWORTEN] when allowReply is false', async () => {
    mockStoreState({
      chatMessages: [],
      chatChannel: 'local' as const,
      alerts: {},
      adminComms: [makeAdminComm({ allowReply: false })],
      adminQuestOffers: [],
    });
    render(<CommsScreen />);
    await userEvent.click(screen.getByText(/\[ADMIN/));
    expect(screen.queryByText('[ANTWORTEN]')).not.toBeInTheDocument();
  });

  it('sends reply via sendAdminCommReply on Enter', async () => {
    mockStoreState({
      chatMessages: [],
      chatChannel: 'local' as const,
      alerts: {},
      adminComms: [makeAdminComm({ id: 'ac-99', allowReply: true })],
      adminQuestOffers: [],
    });
    render(<CommsScreen />);
    await userEvent.click(screen.getByText(/\[ADMIN/));
    await userEvent.click(screen.getByText('[ANTWORTEN]'));
    const replyInput = screen.getByPlaceholderText('Antwort...');
    await userEvent.type(replyInput, 'Got it!{Enter}');
    expect(network.sendAdminCommReply).toHaveBeenCalledWith('ac-99', 'Got it!');
  });

  it('shows ADMIN tab with count badge when content present', () => {
    mockStoreState({
      chatMessages: [],
      chatChannel: 'local' as const,
      alerts: {},
      adminComms: [makeAdminComm()],
      adminQuestOffers: [makeAdminQuestOffer()],
    });
    render(<CommsScreen />);
    expect(screen.getByText('[ADMIN (2)]')).toBeInTheDocument();
  });

  it('shows quest offer with title and NPC name', async () => {
    mockStoreState({
      chatMessages: [],
      chatChannel: 'local' as const,
      alerts: {},
      adminComms: [],
      adminQuestOffers: [makeAdminQuestOffer()],
    });
    render(<CommsScreen />);
    await userEvent.click(screen.getByText(/\[ADMIN/));
    expect(screen.getByText('Recover the Artifact')).toBeInTheDocument();
    expect(screen.getByText(/Commander Vex/)).toBeInTheDocument();
  });

  it('calls sendAcceptAdminQuest when [ANNEHMEN] clicked', async () => {
    mockStoreState({
      chatMessages: [],
      chatChannel: 'local' as const,
      alerts: {},
      adminComms: [],
      adminQuestOffers: [makeAdminQuestOffer({ adminQuestId: 'aq-42' })],
    });
    render(<CommsScreen />);
    await userEvent.click(screen.getByText(/\[ADMIN/));
    await userEvent.click(screen.getByText('[ANNEHMEN]'));
    expect(network.sendAcceptAdminQuest).toHaveBeenCalledWith('aq-42');
  });

  it('calls sendDeclineAdminQuest when [ABLEHNEN] clicked', async () => {
    mockStoreState({
      chatMessages: [],
      chatChannel: 'local' as const,
      alerts: {},
      adminComms: [],
      adminQuestOffers: [makeAdminQuestOffer({ adminQuestId: 'aq-99' })],
    });
    render(<CommsScreen />);
    await userEvent.click(screen.getByText(/\[ADMIN/));
    await userEvent.click(screen.getByText('[ABLEHNEN]'));
    expect(network.sendDeclineAdminQuest).toHaveBeenCalledWith('aq-99');
  });

  it('shows NO ADMIN MESSAGES when admin tab is empty', async () => {
    mockStoreState({
      chatMessages: [],
      chatChannel: 'local' as const,
      alerts: {},
      adminComms: [],
      adminQuestOffers: [],
    });
    render(<CommsScreen />);
    await userEvent.click(screen.getByText('[ADMIN]'));
    expect(screen.getByText('NO ADMIN MESSAGES')).toBeInTheDocument();
  });

  it('shows intro text of quest offer in italic', async () => {
    mockStoreState({
      chatMessages: [],
      chatChannel: 'local' as const,
      alerts: {},
      adminComms: [],
      adminQuestOffers: [makeAdminQuestOffer({ introText: 'Pilot, I need your help.' })],
    });
    render(<CommsScreen />);
    await userEvent.click(screen.getByText(/\[ADMIN/));
    expect(screen.getByText(/Pilot, I need your help\./)).toBeInTheDocument();
  });
});
