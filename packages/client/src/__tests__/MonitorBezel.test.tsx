import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MonitorBezel } from '../components/MonitorBezel';
import { mockStoreState } from '../test/mockStore';

// MonitorBezel uses store for brightness, zoomLevel, panOffset
// and imports LegendOverlay and BezelKnob sub-components

describe('MonitorBezel', () => {
  beforeEach(() => {
    mockStoreState();
  });

  it('renders children inside CRT content area', () => {
    render(
      <MonitorBezel monitorId="TEST">
        <div data-testid="child">Hello</div>
      </MonitorBezel>
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
    expect(screen.getByTestId('child')).toHaveTextContent('Hello');
  });

  it('displays monitor ID', () => {
    render(
      <MonitorBezel monitorId="NAV-COM">
        <div>content</div>
      </MonitorBezel>
    );
    expect(screen.getByText('NAV-COM')).toBeInTheDocument();
  });

  it('renders bezel knob labels', () => {
    render(
      <MonitorBezel monitorId="TEST">
        <div>content</div>
      </MonitorBezel>
    );
    expect(screen.getByText('PAN')).toBeInTheDocument();
    expect(screen.getByText('ZOOM')).toBeInTheDocument();
    expect(screen.getByText('BRIGHTNESS')).toBeInTheDocument();
  });

  it('renders help button', () => {
    render(
      <MonitorBezel monitorId="TEST">
        <div>content</div>
      </MonitorBezel>
    );
    expect(screen.getByText('[?]')).toBeInTheDocument();
  });

  it('shows legend overlay on help button click', async () => {
    render(
      <MonitorBezel monitorId="TEST">
        <div>content</div>
      </MonitorBezel>
    );
    await userEvent.click(screen.getByText('[?]'));
    expect(screen.getByText('RADAR LEGEND')).toBeInTheDocument();
  });

  it('renders LEDs from useMonitorLeds hook', () => {
    render(
      <MonitorBezel monitorId="SHIP-SYS">
        <div>content</div>
      </MonitorBezel>
    );
    expect(screen.getByText('PWR')).toBeInTheDocument();
    expect(screen.getByText('FUEL')).toBeInTheDocument();
  });
});
