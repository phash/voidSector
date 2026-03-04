import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProgramSelector } from '../components/ProgramSelector';
import { mockStoreState } from '../test/mockStore';
import { COCKPIT_PROGRAMS } from '@void-sector/shared';

vi.mock('../network/client', () => ({
  network: {},
}));

const ALL_PROGRAMS = COCKPIT_PROGRAMS;

describe('ProgramSelector', () => {
  const setActiveProgram = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockStoreState({
      activeProgram: 'NAV-COM',
      setActiveProgram,
      alerts: {},
    });
  });

  it('renders all 10 program buttons (excluding COMMS and SHIP-SYS)', () => {
    render(<ProgramSelector />);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(ALL_PROGRAMS.length);
    expect(ALL_PROGRAMS.length).toBe(10);
  });

  it('renders a button for each program', () => {
    render(<ProgramSelector />);
    for (const id of ALL_PROGRAMS) {
      expect(screen.getByTestId(`program-btn-${id}`)).toBeInTheDocument();
    }
  });

  it('clicking a button calls setActiveProgram with the program id', async () => {
    render(<ProgramSelector />);
    await userEvent.click(screen.getByTestId('program-btn-MINING'));
    expect(setActiveProgram).toHaveBeenCalledWith('MINING');
  });

  it('active button has .active class', () => {
    mockStoreState({
      activeProgram: 'CARGO',
      setActiveProgram,
      alerts: {},
    });
    render(<ProgramSelector />);
    const cargoBtn = screen.getByTestId('program-btn-CARGO');
    expect(cargoBtn.className).toContain('active');

    const navBtn = screen.getByTestId('program-btn-NAV-COM');
    expect(navBtn.className).not.toContain('active');
  });

  it('alert LED blinks when alerts are set', () => {
    mockStoreState({
      activeProgram: 'NAV-COM',
      setActiveProgram,
      alerts: { TRADE: true },
    });
    render(<ProgramSelector />);

    const tradeBtn = screen.getByTestId('program-btn-TRADE');
    expect(tradeBtn.className).toContain('alert');

    const tradeLed = tradeBtn.querySelector('.program-led');
    expect(tradeLed?.className).toContain('blink');

    const navBtn = screen.getByTestId('program-btn-NAV-COM');
    const navLed = navBtn.querySelector('.program-led');
    expect(navLed?.className).not.toContain('blink');
  });

  it('active button LED has .on class', () => {
    render(<ProgramSelector />);
    const navBtn = screen.getByTestId('program-btn-NAV-COM');
    const navLed = navBtn.querySelector('.program-led');
    expect(navLed?.className).toContain('on');

    const miningBtn = screen.getByTestId('program-btn-MINING');
    const miningLed = miningBtn.querySelector('.program-led');
    expect(miningLed?.className).not.toContain('on');
  });

  it('renders the program-selector container with data-testid', () => {
    render(<ProgramSelector />);
    expect(screen.getByTestId('program-selector')).toBeInTheDocument();
  });
});
