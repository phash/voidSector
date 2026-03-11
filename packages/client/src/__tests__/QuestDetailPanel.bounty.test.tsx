import { render, screen } from '@testing-library/react';
import { QuestDetailPanel } from '../components/QuestDetailPanel';
import { useStore } from '../state/store';
import { describe, it, expect, beforeEach } from 'vitest';

const BOUNTY_QUEST = {
  id: 'q1',
  templateId: 'pirates_bounty_chase',
  npcName: 'Kapitän Vorn',
  npcFactionId: 'pirates',
  title: "Kopfgeld: Zyr'ex Korath",
  description: 'Test',
  stationX: 10,
  stationY: 10,
  rewards: { credits: 12500, xp: 40, reputation: 12 },
  status: 'active',
  acceptedAt: Date.now(),
  expiresAt: Date.now() + 86400000,
  objectives: [
    {
      type: 'bounty_trail',
      description: 'Verfolge',
      fulfilled: false,
      trail: [{ x: 15, y: 15, hint: 'Hint 1' }],
      currentStep: 0,
      targetName: "Zyr'ex Korath",
      targetLevel: 4,
      currentHint: 'Hat S 15:15 verlassen.',
    },
    { type: 'bounty_combat', description: 'Kampf', fulfilled: false, sectorX: 20, sectorY: 20 },
    { type: 'bounty_deliver', description: 'Abliefern', fulfilled: false, stationX: 10, stationY: 10 },
  ],
};

beforeEach(() => {
  useStore.setState({
    selectedQuest: 'q1',
    activeQuests: [BOUNTY_QUEST] as any,
  });
});

describe('QuestDetailPanel — bounty_chase layout', () => {
  it('renders WANTED poster for bounty_chase quest', () => {
    render(<QuestDetailPanel />);
    expect(screen.getByText('WANTED')).toBeTruthy();
  });

  it('shows current hint', () => {
    render(<QuestDetailPanel />);
    expect(screen.getByText(/Hat S 15:15 verlassen/)).toBeTruthy();
  });

  it('shows target name in uppercase', () => {
    render(<QuestDetailPanel />);
    expect(screen.getAllByText(/ZYR'EX KORATH/i).length).toBeGreaterThan(0);
  });
});
