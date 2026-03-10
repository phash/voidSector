import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QuestsScreen } from '../components/QuestsScreen';
import { mockStoreState } from '../test/mockStore';

vi.mock('../network/client', () => ({
  network: {
    requestActiveQuests: vi.fn(),
    requestReputation: vi.fn(),
    requestStationNpcs: vi.fn(),
    sendAcceptQuest: vi.fn(),
    sendAbandonQuest: vi.fn(),
    sendCompleteScanEvent: vi.fn(),
    requestStoryProgress: vi.fn(),
    requestActiveCommunityQuest: vi.fn(),
    requestHumanityReps: vi.fn(),
    requestTrackedQuests: vi.fn(),
    sendTrackQuest: vi.fn(),
  },
}));

import { network } from '../network/client';

describe('QuestsScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStoreState({});
  });

  it('shows empty state with no active quests', () => {
    mockStoreState({ activeQuests: [] });
    render(<QuestsScreen />);
    // JOURNAL tab button exists (may appear multiple times with header label)
    expect(screen.getAllByText(/JOURNAL/).length).toBeGreaterThan(0);
    expect(screen.getByText(/KEINE AKTIVEN AUFTRÄGE/)).toBeDefined();
  });

  it('shows active quest title in collapsed mode', () => {
    mockStoreState({
      activeQuests: [
        {
          id: 'q1',
          templateId: 't1',
          npcName: 'Zar',
          npcFactionId: 'traders',
          title: 'Erz-Lieferung',
          description: 'Bringe 3 Ore',
          stationX: 10,
          stationY: 20,
          objectives: [
            {
              type: 'fetch',
              description: '3 ore',
              resource: 'ore',
              amount: 3,
              progress: 0,
              fulfilled: false,
            },
          ],
          rewards: { credits: 30, xp: 10, reputation: 5 },
          status: 'active',
          acceptedAt: Date.now(),
          expiresAt: Date.now() + 86400000,
        },
      ],
    });
    render(<QuestsScreen />);
    // AUFTRÄGE tab is active by default — quest title visible (may appear in both active list and journal)
    expect(screen.getAllByText(/Erz-Lieferung/).length).toBeGreaterThan(0);
  });

  it('expands quest to show objectives and rewards', async () => {
    mockStoreState({
      activeQuests: [
        {
          id: 'q1',
          templateId: 't1',
          npcName: 'Zar',
          npcFactionId: 'traders',
          title: 'Erz-Lieferung',
          description: 'Bringe 3 Ore',
          stationX: 10,
          stationY: 20,
          objectives: [
            {
              type: 'fetch',
              description: '3 ore',
              resource: 'ore',
              amount: 3,
              progress: 0,
              fulfilled: false,
            },
          ],
          rewards: { credits: 30, xp: 10, reputation: 5 },
          status: 'active',
          acceptedAt: Date.now(),
          expiresAt: Date.now() + 86400000,
        },
      ],
    });
    render(<QuestsScreen />);
    // AUFTRÄGE tab is active by default — click quest header to expand
    await userEvent.click(screen.getAllByText(/Erz-Lieferung/)[0]);
    expect(screen.getByText(/3 ore/)).toBeDefined();
    expect(screen.getByText(/\+30 CR/)).toBeDefined();
  });

  it('shows reputation bars', async () => {
    mockStoreState({
      reputations: [
        { factionId: 'traders', reputation: 25, tier: 'friendly' },
        { factionId: 'scientists', reputation: 0, tier: 'neutral' },
        { factionId: 'pirates', reputation: -10, tier: 'unfriendly' },
        { factionId: 'ancients', reputation: 0, tier: 'neutral' },
      ],
    });
    render(<QuestsScreen />);
    await userEvent.click(screen.getByText('REPUTATION'));
    expect(screen.getByText(/TRADERS.*FRIENDLY/)).toBeDefined();
  });

  it('requests data on mount', () => {
    render(<QuestsScreen />);
    expect(network.requestActiveQuests).toHaveBeenCalled();
    expect(network.requestReputation).toHaveBeenCalled();
  });

  it('renders ALIEN REP tab with personal and global sections', async () => {
    mockStoreState({
      alienReputations: { archivists: 5, kthari: -3 },
      humanityReps: {
        archivists: { repValue: 120, tier: 'FREUNDLICH' },
        kthari: { repValue: -50, tier: 'FEINDSELIG' },
      },
    });
    render(<QuestsScreen />);
    // AlienRepTab is now inside the REPUTATION tab
    await userEvent.click(screen.getByText('REPUTATION'));
    expect(screen.getByText('MY ALIEN REPUTATIONS')).toBeDefined();
    expect(screen.getByText('GALACTIC HUMANITY REP')).toBeDefined();
  });

  it('shows abandon button for active quest when expanded (two-click confirm)', async () => {
    mockStoreState({
      activeQuests: [
        {
          id: 'q1',
          templateId: 't1',
          npcName: 'Zar',
          npcFactionId: 'traders',
          title: 'Test Quest',
          description: 'Test',
          stationX: 5,
          stationY: 5,
          objectives: [
            {
              type: 'fetch',
              description: 'Get ore',
              resource: 'ore',
              amount: 1,
              progress: 0,
              fulfilled: false,
            },
          ],
          rewards: { credits: 10, xp: 5, reputation: 2 },
          status: 'active',
          acceptedAt: Date.now(),
          expiresAt: Date.now() + 86400000,
        },
      ],
    });
    render(<QuestsScreen />);
    // AUFTRÄGE tab is active by default — quest must be expanded first to see the abandon button
    await userEvent.click(screen.getAllByText(/Test Quest/)[0]);
    // First click: arm the button (shows SURE? state)
    await userEvent.click(screen.getByText('[ABANDON]'));
    expect(network.sendAbandonQuest).not.toHaveBeenCalled();
    // Second click: confirm and execute
    await userEvent.click(screen.getByText('[ABANDON — SURE?]'));
    expect(network.sendAbandonQuest).toHaveBeenCalledWith('q1');
  });
});
