import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CargoDetailPanel } from '../components/CargoDetailPanel';
import { MiningDetailPanel } from '../components/MiningDetailPanel';
import { TradeDetailPanel } from '../components/TradeDetailPanel';
import { QuestDetailPanel } from '../components/QuestDetailPanel';
import { mockStoreState } from '../test/mockStore';

vi.mock('../network/client', () => ({
  network: {},
}));

describe('CargoDetailPanel', () => {
  it('shows prompt when nothing selected', () => {
    mockStoreState({ selectedCargoItem: null });
    render(<CargoDetailPanel />);
    expect(screen.getByText('SELECT AN ITEM')).toBeInTheDocument();
  });

  it('shows item details when selectedCargoItem is set', () => {
    mockStoreState({
      selectedCargoItem: 'ore',
      cargo: {
        ore: 42,
        gas: 0,
        crystal: 0,
        slates: 0,
        artefact: 0,
        artefact_drive: 0,
        artefact_cargo: 0,
        artefact_scanner: 0,
        artefact_armor: 0,
        artefact_weapon: 0,
        artefact_shield: 0,
        artefact_defense: 0,
        artefact_special: 0,
        artefact_mining: 0,
      },
    });
    render(<CargoDetailPanel />);
    expect(screen.getByText('ORE')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('[JETTISON]')).toBeInTheDocument();
  });

  it('shows zero quantity for empty cargo item', () => {
    mockStoreState({
      selectedCargoItem: 'gas',
      cargo: {
        ore: 0,
        gas: 0,
        crystal: 0,
        slates: 0,
        artefact: 0,
        artefact_drive: 0,
        artefact_cargo: 0,
        artefact_scanner: 0,
        artefact_armor: 0,
        artefact_weapon: 0,
        artefact_shield: 0,
        artefact_defense: 0,
        artefact_special: 0,
        artefact_mining: 0,
      },
    });
    render(<CargoDetailPanel />);
    expect(screen.getByText('GAS')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
  });
});

describe('MiningDetailPanel', () => {
  it('shows KEINE RESSOURCEN when sector has no resources', () => {
    mockStoreState({
      currentSector: {
        x: 0,
        y: 0,
        type: 'empty',
        seed: 42,
        discoveredBy: null,
        discoveredAt: null,
        metadata: {},
        environment: 'empty' as const,
        contents: [],
      },
    });
    render(<MiningDetailPanel />);
    expect(screen.getByText('NO RESOURCES')).toBeInTheDocument();
  });

  it('shows resource info when sectorData has resources', () => {
    mockStoreState({
      currentSector: {
        x: 5,
        y: 3,
        type: 'asteroid_field',
        seed: 99,
        discoveredBy: null,
        discoveredAt: null,
        metadata: {},
        environment: 'empty' as const,
        contents: [],
        resources: { ore: 150, gas: 0, crystal: 30 },
      },
    });
    render(<MiningDetailPanel />);
    expect(screen.getByText('SECTOR RESOURCES')).toBeInTheDocument();
    expect(screen.getByText('150')).toBeInTheDocument();
    expect(screen.getByText('30')).toBeInTheDocument();
  });

  it('shows active mining status', () => {
    mockStoreState({
      currentSector: {
        x: 5,
        y: 3,
        type: 'asteroid_field',
        seed: 99,
        discoveredBy: null,
        discoveredAt: null,
        metadata: {},
        environment: 'empty' as const,
        contents: [],
        resources: { ore: 100, gas: 0, crystal: 0 },
      },
      mining: {
        active: true,
        resource: 'ore',
        rate: 2,
        sectorX: 5,
        sectorY: 3,
        startedAt: Date.now(),
        sectorYield: 100,
      },
    });
    render(<MiningDetailPanel />);
    expect(screen.getByText(/MINING ACTIVE/)).toBeInTheDocument();
    expect(screen.getAllByText(/ORE/).length).toBeGreaterThanOrEqual(1);
  });
});

describe('TradeDetailPanel', () => {
  it('shows KEIN HANDEL when not at station', () => {
    mockStoreState({
      currentSector: {
        x: 0,
        y: 0,
        type: 'empty',
        seed: 42,
        discoveredBy: null,
        discoveredAt: null,
        metadata: {},
        environment: 'empty' as const,
        contents: [],
      },
      npcStationData: null,
    });
    render(<TradeDetailPanel />);
    expect(screen.getByText('KEIN HANDEL VERFÜGBAR')).toBeInTheDocument();
  });

  it('shows station trade info when at station', () => {
    mockStoreState({
      currentSector: {
        x: 10,
        y: 10,
        type: 'station',
        seed: 42,
        discoveredBy: null,
        discoveredAt: null,
        metadata: {},
        environment: 'empty' as const,
        contents: [],
      },
      npcStationData: {
        level: 2,
        name: 'OMEGA STATION',
        xp: 100,
        nextLevelXp: 500,
        inventory: [{ itemType: 'ore', stock: 50, maxStock: 200, buyPrice: 5, sellPrice: 3 }],
      },
      cargo: {
        ore: 10,
        gas: 0,
        crystal: 0,
        slates: 0,
        artefact: 0,
        artefact_drive: 0,
        artefact_cargo: 0,
        artefact_scanner: 0,
        artefact_armor: 0,
        artefact_weapon: 0,
        artefact_shield: 0,
        artefact_defense: 0,
        artefact_special: 0,
        artefact_mining: 0,
      },
    });
    render(<TradeDetailPanel />);
    expect(screen.getByText('OMEGA STATION')).toBeInTheDocument();
    expect(screen.getByText('LEVEL 2')).toBeInTheDocument();
    expect(screen.getByText('ORE')).toBeInTheDocument();
    expect(screen.getByText(/KAUF: 5 CR/)).toBeInTheDocument();
    expect(screen.getByText(/50\/200/)).toBeInTheDocument();
  });
});

describe('QuestDetailPanel', () => {
  it('shows prompt when nothing selected', () => {
    mockStoreState({ selectedQuest: null });
    render(<QuestDetailPanel />);
    expect(screen.getByText('SELECT A QUEST')).toBeInTheDocument();
  });

  it('shows QUEST NOT FOUND when quest id does not match', () => {
    mockStoreState({
      selectedQuest: 'nonexistent',
      activeQuests: [],
    });
    render(<QuestDetailPanel />);
    expect(screen.getByText('QUEST NOT FOUND')).toBeInTheDocument();
  });

  it('shows quest details when selectedQuest matches', () => {
    mockStoreState({
      selectedQuest: 'q1',
      activeQuests: [
        {
          id: 'q1',
          templateId: 't1',
          npcName: 'Zara',
          npcFactionId: 'traders' as any,
          title: 'ERZE LIEFERN',
          description: 'Liefere 50 Erz zur Station.',
          stationX: 10,
          stationY: 10,
          objectives: [
            {
              type: 'delivery' as any,
              description: 'Erz liefern',
              amount: 50,
              progress: 20,
              fulfilled: false,
            },
          ],
          rewards: { credits: 100, xp: 50, reputation: 10 },
          status: 'active' as any,
          acceptedAt: Date.now(),
          expiresAt: Date.now() + 86400000,
        },
      ],
    });
    render(<QuestDetailPanel />);
    expect(screen.getByText('ERZE LIEFERN')).toBeInTheDocument();
    expect(screen.getByText(/Liefere 50 Erz/)).toBeInTheDocument();
    expect(screen.getByText(/Erz liefern/)).toBeInTheDocument();
    expect(screen.getByText('(20/50)')).toBeInTheDocument();
    expect(screen.getByText('100 CR')).toBeInTheDocument();
    expect(screen.getByText('50 XP')).toBeInTheDocument();
    expect(screen.getByText('+10 REP')).toBeInTheDocument();
    expect(screen.getByText('[ABANDON]')).toBeInTheDocument();
  });
});
