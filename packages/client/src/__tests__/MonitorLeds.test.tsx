import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LedDot } from '../components/MonitorLeds';
import { mockStoreState } from '../test/mockStore';

vi.mock('../network/client', () => ({
  network: {},
}));

/** Helper to find the LED dot element (the small circle div inside the flex wrapper). */
function getDot(container: HTMLElement): HTMLElement {
  // Structure: container > div.flex-wrapper > div.dot + span.label
  // The dot is the first div inside the flex wrapper div
  const wrapper = container.firstElementChild as HTMLElement;
  return wrapper.firstElementChild as HTMLElement;
}

describe('LedDot', () => {
  beforeEach(() => {
    mockStoreState();
  });

  it('renders label', () => {
    render(<LedDot led={{ label: 'SYS', color: 'green' }} />);
    expect(screen.getByText('SYS')).toBeDefined();
  });

  it('renders with correct color', () => {
    const { container } = render(<LedDot led={{ label: 'FUEL', color: 'red' }} />);
    const dot = getDot(container);
    const style = dot.getAttribute('style') || '';
    expect(style).toContain('background-color');
    expect(style).toContain('rgb(255, 51, 51)');
  });

  it('renders gray without glow', () => {
    const { container } = render(<LedDot led={{ label: 'RIG', color: 'gray' }} />);
    const dot = getDot(container);
    const style = dot.getAttribute('style') || '';
    expect(style).toContain('rgb(68, 68, 68)');
    expect(style).not.toContain('box-shadow');
  });

  it('renders green with glow', () => {
    const { container } = render(<LedDot led={{ label: 'SYS', color: 'green' }} />);
    const dot = getDot(container);
    const style = dot.getAttribute('style') || '';
    expect(style).toContain('box-shadow');
    expect(style).toContain('#00FF88');
  });

  it('applies blink animation when blink is true', () => {
    const { container } = render(<LedDot led={{ label: 'MSG', color: 'yellow', blink: true }} />);
    const dot = getDot(container);
    const style = dot.getAttribute('style') || '';
    expect(style).toContain('animation');
    expect(style).toContain('bezel-alert-pulse');
  });

  it('has no animation when blink is false', () => {
    const { container } = render(<LedDot led={{ label: 'SIG', color: 'green' }} />);
    const dot = getDot(container);
    const style = dot.getAttribute('style') || '';
    expect(style).not.toContain('animation');
  });
});
