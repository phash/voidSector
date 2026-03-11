import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AvailableQuest, StationNpc } from '@void-sector/shared';

let mockActiveQuests: any[] = [];
let mockUseStoreSelector: any = null;

vi.mock('../network/client', () => ({
  network: {
    requestActiveQuests: vi.fn(),
    requestReputation: vi.fn(),
    requestStationNpcs: vi.fn(),
    requestTrackedQuests: vi.fn(),
    requestStoryProgress: vi.fn(),
    requestActiveCommunityQuest: vi.fn(),
    requestHumanityReps: vi.fn(),
    sendTrackQuest: vi.fn(),
    sendAcceptQuest: vi.fn(),
    sendAbandonQuest: vi.fn(),
    sendCompleteScanEvent: vi.fn(),
  },
}));

vi.mock('../state/store', () => ({
  useStore: vi.fn((selector: any) => {
    if (!mockUseStoreSelector) {
      mockUseStoreSelector = selector;
    }
    return selector({
      activeQuests: mockActiveQuests,
      trackedQuests: [],
      position: { x: 5, y: 5 },
      currentSector: { type: 'station', x: 5, y: 5 },
      reputations: [],
      playerUpgrades: [],
      scanEvents: [],
      discoveries: [],
      distressCalls: [],
      rescuedSurvivors: [],
      navReturnProgram: null,
      setActiveProgram: vi.fn(),
      clearNavReturn: vi.fn(),
      alienReputations: {},
      humanityReps: {},
      activeCommunityQuest: null,
      storyProgress: null,
    });
  }),
}));

vi.mock('../hooks/useConfirm', () => ({
  useConfirm: () => ({
    confirm: vi.fn(),
    isArmed: vi.fn(() => false),
  }),
}));

import { QuestsScreen } from '../components/QuestsScreen';

describe('QuestsScreen quest filter after accept', () => {
  beforeEach(() => {
    mockActiveQuests = [];
    vi.clearAllMocks();
  });

  it('removes accepted quest templateId from availableQuests when activeQuests changes', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<QuestsScreen />);

    // Initial render with no active quests
    expect(mockActiveQuests).toHaveLength(0);

    // Click on VERFÜGBAR tab
    const verfuegbarBtn = screen.getByRole('button', { name: 'VERFÜGBAR' });
    await user.click(verfuegbarBtn);

    // Simulate stationNpcsResult event with available quests
    const availableQuestData: AvailableQuest[] = [
      {
        templateId: 'tpl-1',
        title: 'Quest Alpha',
        description: 'Find something',
        objectives: [],
        rewards: { credits: 100, xp: 50, reputation: 10 },
      },
      {
        templateId: 'tpl-2',
        title: 'Quest Beta',
        description: 'Find something else',
        objectives: [],
        rewards: { credits: 200, xp: 100, reputation: 20 },
      },
    ];

    act(() => {
      const event = new CustomEvent('stationNpcsResult', {
        detail: {
          npcs: [] as StationNpc[],
          quests: availableQuestData,
        },
      });
      window.dispatchEvent(event);
    });

    // Check both quests are displayed initially
    await waitFor(() => {
      expect(screen.getByText('Quest Alpha')).toBeTruthy();
      expect(screen.getByText('Quest Beta')).toBeTruthy();
    });

    // Simulate quest acceptance by updating activeQuests
    mockActiveQuests = [
      {
        id: 'q1',
        templateId: 'tpl-1',
        title: 'Quest Alpha',
        status: 'active',
        objectives: [],
        rewards: { credits: 100, xp: 50, reputation: 10 },
        description: 'Find something',
        stationX: 5,
        stationY: 5,
        npcFactionId: null,
      },
    ];

    // Rerender to trigger useEffect that watches activeQuests
    rerender(<QuestsScreen />);

    // Quest Alpha should be filtered out, Beta should remain
    await waitFor(() => {
      expect(screen.queryByText('Quest Alpha')).toBeNull();
      expect(screen.getByText('Quest Beta')).toBeTruthy();
    });
  });

  it('does not filter quests when activeQuests is empty', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<QuestsScreen />);

    const verfuegbarBtn = screen.getByRole('button', { name: 'VERFÜGBAR' });
    await user.click(verfuegbarBtn);

    const availableQuestData: AvailableQuest[] = [
      {
        templateId: 'tpl-1',
        title: 'Quest Alpha',
        description: 'Find something',
        objectives: [],
        rewards: { credits: 100, xp: 50, reputation: 10 },
      },
    ];

    act(() => {
      const event = new CustomEvent('stationNpcsResult', {
        detail: {
          npcs: [] as StationNpc[],
          quests: availableQuestData,
        },
      });
      window.dispatchEvent(event);
    });

    await waitFor(() => {
      expect(screen.getByText('Quest Alpha')).toBeTruthy();
    });

    // Keep activeQuests empty and rerender
    mockActiveQuests = [];
    rerender(<QuestsScreen />);

    // Quest should still be visible
    expect(screen.getByText('Quest Alpha')).toBeTruthy();
  });
});

function act(callback: () => void) {
  callback();
}
