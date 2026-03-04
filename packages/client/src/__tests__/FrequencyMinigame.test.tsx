import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FrequencyMinigame } from '../components/FrequencyMinigame';
import { mockStoreState } from '../test/mockStore';

describe('FrequencyMinigame', () => {
  const onComplete = vi.fn();
  const onCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockStoreState({});
  });

  it('renders canvas element', () => {
    const { container } = render(
      <FrequencyMinigame onComplete={onComplete} onCancel={onCancel} />
    );
    const canvas = container.querySelector('canvas');
    expect(canvas).toBeTruthy();
    expect(canvas!.width).toBe(280);
    expect(canvas!.height).toBe(120);
  });

  it('shows GATE FREQUENCY LOCK header', () => {
    render(<FrequencyMinigame onComplete={onComplete} onCancel={onCancel} />);
    expect(screen.getByText('GATE FREQUENCY LOCK')).toBeDefined();
  });

  it('shows match percentage', () => {
    render(<FrequencyMinigame onComplete={onComplete} onCancel={onCancel} />);
    expect(screen.getByText(/MATCH:/)).toBeDefined();
  });

  it('shows control instructions', () => {
    render(<FrequencyMinigame onComplete={onComplete} onCancel={onCancel} />);
    expect(screen.getByText(/MOUSEWHEEL to tune/)).toBeDefined();
    expect(screen.getByText(/ESC to cancel/)).toBeDefined();
  });

  it('calls onCancel when Escape key is pressed', () => {
    render(<FrequencyMinigame onComplete={onComplete} onCancel={onCancel} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('does not call onComplete on Enter when match is low', () => {
    render(<FrequencyMinigame onComplete={onComplete} onCancel={onCancel} />);
    fireEvent.keyDown(window, { key: 'Enter' });
    // Match starts at a low value (player freq 2.0 vs target 3.5-6.5), so Enter should not trigger
    expect(onComplete).not.toHaveBeenCalled();
  });
});
