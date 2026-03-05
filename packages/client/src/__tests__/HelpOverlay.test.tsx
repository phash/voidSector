import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HelpOverlay } from '../components/HelpOverlay';
import { mockStoreState } from '../test/mockStore';

describe('HelpOverlay', () => {
  const openCompendium = vi.fn();
  const dismissTip = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render when no active tip', () => {
    mockStoreState({ activeTip: null });
    const { container } = render(<HelpOverlay />);
    expect(container.innerHTML).toBe('');
  });

  it('renders tip title and body', () => {
    mockStoreState({
      activeTip: { id: 'test', title: 'TEST TITLE', body: 'Test body text' },
      dismissTip,
    });
    render(<HelpOverlay />);
    expect(screen.getByText(/TEST TITLE/)).toBeInTheDocument();
    expect(screen.getByText('Test body text')).toBeInTheDocument();
  });

  it('does not show compendium link when tip has no articleId', () => {
    mockStoreState({
      activeTip: { id: 'test', title: 'TITLE', body: 'Body' },
      dismissTip,
    });
    render(<HelpOverlay />);
    expect(screen.queryByTestId('compendium-link')).not.toBeInTheDocument();
  });

  it('shows compendium link when tip has articleId', () => {
    mockStoreState({
      activeTip: { id: 'test', title: 'TITLE', body: 'Body', articleId: 'mining' },
      dismissTip,
      openCompendium,
    });
    render(<HelpOverlay />);
    expect(screen.getByTestId('compendium-link')).toBeInTheDocument();
    expect(screen.getByText('MEHR IM KOMPENDIUM ▸')).toBeInTheDocument();
  });

  it('clicking compendium link opens compendium at article', async () => {
    mockStoreState({
      activeTip: { id: 'test', title: 'TITLE', body: 'Body', articleId: 'combat-v2' },
      dismissTip,
      openCompendium,
    });
    render(<HelpOverlay />);
    await userEvent.click(screen.getByTestId('compendium-link'));
    expect(openCompendium).toHaveBeenCalledWith('combat-v2');
  });
});
