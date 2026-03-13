import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsPanel } from '../components/SettingsPanel';
import { mockStoreState } from '../test/mockStore';
import { COLOR_PROFILES } from '../styles/themes';

// Mock localStorage and location.reload for the test environment
const storage: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((key: string) => storage[key] ?? null),
  setItem: vi.fn((key: string, val: string) => {
    storage[key] = val;
  }),
  removeItem: vi.fn((key: string) => {
    delete storage[key];
  }),
  clear: vi.fn(() => {
    Object.keys(storage).forEach((k) => delete storage[k]);
  }),
  get length() {
    return Object.keys(storage).length;
  },
  key: vi.fn((i: number) => Object.keys(storage)[i] ?? null),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock, writable: true });

const reloadMock = vi.fn();
Object.defineProperty(window, 'location', {
  value: { ...window.location, reload: reloadMock },
  writable: true,
});

describe('SettingsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(storage).forEach((k) => delete storage[k]);
    mockStoreState({
      username: 'TestPilot',
      colorProfile: 'Amber Classic',
      brightness: 1.0,
      setColorProfile: vi.fn(),
      setBrightness: vi.fn(),
    });
  });

  it('renders player name', () => {
    render(<SettingsPanel />);
    expect(screen.getByText('TestPilot')).toBeInTheDocument();
  });

  it('renders color profile dropdown with all profiles as options', () => {
    render(<SettingsPanel />);
    const select = screen.getByTestId('color-profile-select') as HTMLSelectElement;
    expect(select).toBeInTheDocument();
    const options = Array.from(select.querySelectorAll('option'));
    const profileNames = Object.keys(COLOR_PROFILES);
    expect(options).toHaveLength(profileNames.length);
    profileNames.forEach((name) => {
      expect(options.find((o) => o.textContent === name)).toBeTruthy();
    });
  });

  it('renders brightness slider', () => {
    render(<SettingsPanel />);
    const slider = screen.getByTestId('brightness-slider') as HTMLInputElement;
    expect(slider).toBeInTheDocument();
    expect(slider.type).toBe('range');
    expect(slider.min).toBe('0.3');
    expect(slider.max).toBe('1.5');
    expect(slider.step).toBe('0.1');
  });

  it('renders kompendium button', () => {
    render(<SettingsPanel />);
    expect(screen.getByTestId('kompendium-btn')).toBeInTheDocument();
    expect(screen.getByText('settings.compendium')).toBeInTheDocument();
  });

  it('clicking kompendium button calls openCompendium', async () => {
    const openCompendium = vi.fn();
    mockStoreState({
      username: 'TestPilot',
      colorProfile: 'Amber Classic',
      brightness: 1.0,
      setColorProfile: vi.fn(),
      setBrightness: vi.fn(),
      openCompendium,
    });
    render(<SettingsPanel />);
    await userEvent.click(screen.getByTestId('kompendium-btn'));
    expect(openCompendium).toHaveBeenCalled();
  });

  it('renders logout button', () => {
    render(<SettingsPanel />);
    expect(screen.getByText('settings.logout')).toBeInTheDocument();
  });

  it('clicking logout clears vs_token from localStorage', async () => {
    storage['vs_token'] = 'some-token';
    render(<SettingsPanel />);
    await userEvent.click(screen.getByText('settings.logout'));
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('vs_token');
    expect(reloadMock).toHaveBeenCalled();
  });
});
