import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { XenoScreen } from '../components/XenoScreen';
import { mockStoreState } from '../test/mockStore';
import { network } from '../network/client';

vi.mock('../network/client', () => ({
  network: {
    requestXenoStatus: vi.fn(),
    sendAlienInteract: vi.fn(),
  },
}));

const reachableScrappers = {
  factionId: 'scrappers',
  reachable: true,
  firstContacted: false,
  reputation: 0,
  tier: 'NEUTRAL',
};
const lockedAxioms = {
  factionId: 'axioms',
  reachable: false,
  firstContacted: false,
  reputation: 0,
  tier: 'NEUTRAL',
};

describe('XenoScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requests xeno status on mount', () => {
    mockStoreState({ xenoStatus: [], alienInteractResult: null } as any);
    render(<XenoScreen />);
    expect(network.requestXenoStatus).toHaveBeenCalled();
  });

  it('renders reachable and locked factions from the store', () => {
    mockStoreState({ xenoStatus: [reachableScrappers, lockedAxioms], alienInteractResult: null } as any);
    render(<XenoScreen />);
    expect(screen.getByTestId('xeno-faction-scrappers')).toBeInTheDocument();
    expect(screen.getByText('außer Reichweite')).toBeInTheDocument();
  });

  it('disables a locked faction button', () => {
    mockStoreState({ xenoStatus: [lockedAxioms], alienInteractResult: null } as any);
    render(<XenoScreen />);
    expect(screen.getByTestId('xeno-faction-axioms')).toBeDisabled();
  });

  it('ERSTKONTAKT sends firstContact for a not-yet-contacted faction', async () => {
    mockStoreState({ xenoStatus: [reachableScrappers], alienInteractResult: null } as any);
    render(<XenoScreen />);
    await userEvent.click(screen.getByTestId('xeno-faction-scrappers'));
    await userEvent.click(screen.getByTestId('xeno-firstcontact-btn'));
    expect(network.sendAlienInteract).toHaveBeenCalledWith('scrappers', 'firstContact', undefined);
  });

  it('renders a successful result message', async () => {
    mockStoreState({
      xenoStatus: [{ ...reachableScrappers, firstContacted: true }],
      alienInteractResult: {
        success: true,
        factionId: 'scrappers',
        action: 'greet',
        message: 'SCRAPPER-FUNK: Hallo!',
        repTier: 'NEUTRAL',
      },
    } as any);
    render(<XenoScreen />);
    await userEvent.click(screen.getByTestId('xeno-faction-scrappers'));
    expect(screen.getByTestId('xeno-result')).toHaveTextContent('SCRAPPER-FUNK: Hallo!');
  });

  it('renders an error via InlineError', async () => {
    mockStoreState({
      xenoStatus: [reachableScrappers],
      alienInteractResult: null,
      actionError: { code: 'XENO_ERROR', message: 'Scrappers ignorieren dich.' },
    } as any);
    render(<XenoScreen />);
    await userEvent.click(screen.getByTestId('xeno-faction-scrappers'));
    expect(screen.getByText(/Scrappers ignorieren dich/)).toBeInTheDocument();
  });
});
