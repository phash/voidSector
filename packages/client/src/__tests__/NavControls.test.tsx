import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NavControls } from '../components/NavControls';
import { mockStoreState } from '../test/mockStore';

vi.mock('../network/client', () => ({
  network: {
    sendJump: vi.fn(),
    sendScan: vi.fn(),
    sendLocalScan: vi.fn(),
    sendAreaScan: vi.fn(),
    sendBuild: vi.fn(),
    sendCancelAutopilot: vi.fn(),
  },
}));

import { network } from '../network/client';

describe('NavControls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStoreState();
  });

  it('renders directional buttons', () => {
    render(<NavControls />);
    expect(screen.getByText('\u2191')).toBeInTheDocument();
    expect(screen.getByText('\u2193')).toBeInTheDocument();
    expect(screen.getByText('\u2190')).toBeInTheDocument();
    expect(screen.getByText('\u2192')).toBeInTheDocument();
  });

  it('calls sendJump on arrow click', async () => {
    render(<NavControls />);
    await userEvent.click(screen.getByText('\u2191'));
    expect(network.sendJump).toHaveBeenCalledWith(0, -1);
  });

  it('sends correct coordinates for each direction', async () => {
    render(<NavControls />);

    await userEvent.click(screen.getByText('\u2193'));
    expect(network.sendJump).toHaveBeenCalledWith(0, 1);

    await userEvent.click(screen.getByText('\u2190'));
    expect(network.sendJump).toHaveBeenCalledWith(-1, 0);

    await userEvent.click(screen.getByText('\u2192'));
    expect(network.sendJump).toHaveBeenCalledWith(1, 0);
  });

  it('disables buttons when jumpPending', () => {
    mockStoreState({ jumpPending: true });
    render(<NavControls />);
    const upBtn = screen.getByText('\u2191').closest('button');
    expect(upBtn).toBeDisabled();

    const downBtn = screen.getByText('\u2193').closest('button');
    expect(downBtn).toBeDisabled();

    const leftBtn = screen.getByText('\u2190').closest('button');
    expect(leftBtn).toBeDisabled();

    const rightBtn = screen.getByText('\u2192').closest('button');
    expect(rightBtn).toBeDisabled();
  });

  it('shows LOCAL SCAN and AREA SCAN buttons', () => {
    render(<NavControls />);
    expect(screen.getByText('[LOCAL SCAN]')).toBeInTheDocument();
    expect(screen.getByText('[AREA SCAN]')).toBeInTheDocument();
  });

  it('shows BUILD buttons', () => {
    render(<NavControls />);
    expect(screen.getByText('[BUILD RELAY]')).toBeInTheDocument();
    expect(screen.getByText('[BUILD STATION]')).toBeInTheDocument();
    expect(screen.getByText('[BUILD BASE]')).toBeInTheDocument();
  });

  it('calls sendLocalScan on LOCAL SCAN click', async () => {
    render(<NavControls />);
    await userEvent.click(screen.getByText('[LOCAL SCAN]'));
    expect(network.sendLocalScan).toHaveBeenCalled();
  });

  it('calls sendAreaScan on AREA SCAN click', async () => {
    render(<NavControls />);
    await userEvent.click(screen.getByText('[AREA SCAN]'));
    expect(network.sendAreaScan).toHaveBeenCalled();
  });

  it('calls sendBuild on BUILD button clicks', async () => {
    render(<NavControls />);
    await userEvent.click(screen.getByText('[BUILD RELAY]'));
    expect(network.sendBuild).toHaveBeenCalledWith('comm_relay');

    await userEvent.click(screen.getByText('[BUILD STATION]'));
    expect(network.sendBuild).toHaveBeenCalledWith('mining_station');

    await userEvent.click(screen.getByText('[BUILD BASE]'));
    expect(network.sendBuild).toHaveBeenCalledWith('base');
  });

  it('shows autopilot UI when autopilot is active', () => {
    mockStoreState({
      autopilot: { targetX: 5, targetY: -3, remaining: 8, active: true },
    });
    render(<NavControls />);
    expect(screen.getByText(/AUTOPILOT AKTIV/)).toBeInTheDocument();
    expect(screen.getByText(/5, -3/)).toBeInTheDocument();
    expect(screen.getByText(/ABBRECHEN/)).toBeInTheDocument();
  });

  it('shows remaining jump count during autopilot', () => {
    mockStoreState({
      autopilot: { targetX: 10, targetY: 20, remaining: 3, active: true },
    });
    render(<NavControls />);
    expect(screen.getByText(/Verbleibend: 3/)).toBeInTheDocument();
  });

  it('hides nav buttons during autopilot', () => {
    mockStoreState({
      autopilot: { targetX: 5, targetY: -3, remaining: 8, active: true },
    });
    render(<NavControls />);
    // Normal nav buttons should NOT be present
    expect(screen.queryByText('↑')).toBeNull();
    expect(screen.queryByText('↓')).toBeNull();
    expect(screen.queryByText('←')).toBeNull();
    expect(screen.queryByText('→')).toBeNull();
  });

  it('hides scan and build buttons during autopilot', () => {
    mockStoreState({
      autopilot: { targetX: 5, targetY: -3, remaining: 8, active: true },
    });
    render(<NavControls />);
    expect(screen.queryByText('[LOCAL SCAN]')).toBeNull();
    expect(screen.queryByText('[AREA SCAN]')).toBeNull();
    expect(screen.queryByText('[BUILD RELAY]')).toBeNull();
  });

  it('calls sendCancelAutopilot on ABBRECHEN click', async () => {
    mockStoreState({
      autopilot: { targetX: 5, targetY: -3, remaining: 8, active: true },
    });
    render(<NavControls />);
    await userEvent.click(screen.getByText('[ABBRECHEN]'));
    expect(network.sendCancelAutopilot).toHaveBeenCalled();
  });

  it('shows normal controls when autopilot is null', () => {
    mockStoreState({ autopilot: null });
    render(<NavControls />);
    expect(screen.getByText('↑')).toBeInTheDocument();
    expect(screen.queryByText(/AUTOPILOT AKTIV/)).toBeNull();
  });

  it('shows normal controls when autopilot is inactive', () => {
    mockStoreState({
      autopilot: { targetX: 5, targetY: -3, remaining: 0, active: false },
    });
    render(<NavControls />);
    expect(screen.getByText('↑')).toBeInTheDocument();
    expect(screen.queryByText(/AUTOPILOT AKTIV/)).toBeNull();
  });
});
