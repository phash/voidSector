import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

const mockQuest = {
  id: 'q1',
  templateId: 'traders_fetch_ore',
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
};

describe('QuestsScreen — JOURNAL tab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStoreState({});
  });

  it('renders JOURNAL tab button', () => {
    mockStoreState({ activeQuests: [] });
    render(<QuestsScreen />);
    // JOURNAL header text is now shown inside the AUFTRÄGE tab (default)
    const journalElements = screen.getAllByText(/JOURNAL/);
    expect(journalElements.length).toBeGreaterThan(0);
  });

  it('requests tracked quests on journal tab open', async () => {
    mockStoreState({ activeQuests: [mockQuest] });
    render(<QuestsScreen />);
    // JournalTab is embedded in AUFTRÄGE/all — requestTrackedQuests called on mount
    expect(network.requestTrackedQuests).toHaveBeenCalled();
  });

  it('shows active quests in journal tab', async () => {
    mockStoreState({ activeQuests: [mockQuest] });
    render(<QuestsScreen />);
    // AUFTRÄGE tab is active by default — quest title visible
    expect(screen.getByText('Erz-Lieferung')).toBeDefined();
  });

  it('shows track toggle button for each quest', async () => {
    mockStoreState({ activeQuests: [mockQuest] });
    render(<QuestsScreen />);
    // JournalTab embedded in AUFTRÄGE/all — [T] button visible
    expect(screen.getByText('[T]')).toBeDefined();
  });

  it('shows [T✓] for already tracked quests', async () => {
    mockStoreState({
      activeQuests: [mockQuest],
      trackedQuests: [{ questId: 'q1', title: 'Erz-Lieferung', type: 'traders' }],
    });
    render(<QuestsScreen />);
    expect(screen.getByText('[T✓]')).toBeDefined();
  });

  it('calls sendTrackQuest when track button clicked', async () => {
    mockStoreState({
      activeQuests: [mockQuest],
      trackedQuests: [],
    });
    render(<QuestsScreen />);
    await userEvent.click(screen.getByText('[T]'));
    expect(network.sendTrackQuest).toHaveBeenCalledWith('q1', true);
  });

  it('disables track button when 5 quests already tracked', async () => {
    const trackedQuests = [
      { questId: 'qa', title: 'Q1', type: 'fetch' },
      { questId: 'qb', title: 'Q2', type: 'fetch' },
      { questId: 'qc', title: 'Q3', type: 'fetch' },
      { questId: 'qd', title: 'Q4', type: 'fetch' },
      { questId: 'qe', title: 'Q5', type: 'fetch' },
    ];
    mockStoreState({
      activeQuests: [mockQuest],
      trackedQuests,
    });
    render(<QuestsScreen />);
    // Track button should be disabled
    const trackBtn = screen.getByText('[T]').closest('button');
    expect(trackBtn).toBeDefined();
    expect(trackBtn?.disabled).toBe(true);
  });

  it('shows TRACKED counter', async () => {
    mockStoreState({
      activeQuests: [mockQuest],
      trackedQuests: [{ questId: 'q1', title: 'Erz-Lieferung', type: 'traders' }],
    });
    render(<QuestsScreen />);
    expect(screen.getByText('status.tracked: 1/5')).toBeDefined();
  });

  it('shows type label for quest', async () => {
    mockStoreState({ activeQuests: [mockQuest] });
    render(<QuestsScreen />);
    // traders prefix maps to TRADERS
    expect(screen.getAllByText('[TRADERS]').length).toBeGreaterThan(0);
  });

  it('shows nearby filter toggle', async () => {
    mockStoreState({ activeQuests: [mockQuest] });
    render(<QuestsScreen />);
    expect(screen.getByText('[ ] status.nearby')).toBeDefined();
  });

  it('toggles nearby filter on click', async () => {
    mockStoreState({ activeQuests: [mockQuest] });
    render(<QuestsScreen />);
    await userEvent.click(screen.getByText('[ ] status.nearby'));
    expect(screen.getByText('[✓] status.nearby')).toBeDefined();
  });

  it('shows no quests message when filter removes all', async () => {
    mockStoreState({
      activeQuests: [mockQuest],
      position: { x: 100, y: 100 }, // far from quest station at (10,20)
    });
    render(<QuestsScreen />);
    // Enable nearby filter with small radius
    await userEvent.click(screen.getByText('[ ] status.nearby'));
    // With radius 10 and player at (100,100), quest at (10,20) should be filtered out
    // distance = |10-100| + |20-100| = 90+80 = 170 > 10
    expect(screen.getByText('empty.noQuestsFiltered')).toBeDefined();
  });
});
