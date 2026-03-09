import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StoryEventOverlay } from '../components/overlays/StoryEventOverlay';
import { mockStoreState } from '../test/mockStore';

vi.mock('../network/client', () => ({
  network: { sendStoryChoice: vi.fn() },
}));

import { network } from '../network/client';

describe('StoryEventOverlay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when no storyEvent', () => {
    mockStoreState({ storyEvent: null });
    const { container } = render(<StoryEventOverlay />);
    expect(container.firstChild).toBeNull();
  });

  it('renders chapter title and flavor text', () => {
    mockStoreState({
      storyEvent: {
        chapterId: 0,
        title: 'DAS AUFBRUCH-SIGNAL',
        flavorText: 'Ein schwaches Signal aus unbekannter Richtung.',
        branches: undefined,
      },
    });
    render(<StoryEventOverlay />);
    expect(screen.getByText('DAS AUFBRUCH-SIGNAL')).toBeDefined();
    expect(screen.getByText(/schwaches Signal/)).toBeDefined();
  });

  it('renders branch buttons when branches exist', () => {
    mockStoreState({
      storyEvent: {
        chapterId: 2,
        title: 'ERSTKONTAKT',
        flavorText: 'Die Archivare.',
        branches: [
          { id: 'A', label: 'Daten teilen' },
          { id: 'B', label: 'Verweigern' },
        ],
      },
    });
    render(<StoryEventOverlay />);
    expect(screen.getByText(/Daten teilen/)).toBeDefined();
    expect(screen.getByText(/Verweigern/)).toBeDefined();
  });

  it('calls sendStoryChoice on branch selection', () => {
    const mockSetStoryEvent = vi.fn();
    mockStoreState({
      storyEvent: {
        chapterId: 2,
        title: 'ERSTKONTAKT',
        flavorText: 'Test',
        branches: [{ id: 'A', label: 'Daten teilen' }],
      },
      setStoryEvent: mockSetStoryEvent,
    });
    render(<StoryEventOverlay />);
    fireEvent.click(screen.getByText(/Daten teilen/));
    expect((network as any).sendStoryChoice).toHaveBeenCalledWith(2, 'A');
    expect(mockSetStoryEvent).toHaveBeenCalledWith(null);
  });
});
