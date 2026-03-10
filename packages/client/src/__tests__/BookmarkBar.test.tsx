import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BookmarkBar } from '../components/BookmarkBar';
import { mockStoreState } from '../test/mockStore';

vi.mock('../network/client', () => ({
  network: {
    requestBookmarks: vi.fn(),
    sendSetBookmark: vi.fn(),
    sendClearBookmark: vi.fn(),
    sendTrackQuest: vi.fn(),
  },
}));

describe('BookmarkBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStoreState({ bookmarks: [], position: { x: 0, y: 0 } });
  });

  it('shows HOME and SHIP buttons', () => {
    render(<BookmarkBar />);
    expect(screen.getByText('HOME')).toBeDefined();
    expect(screen.getByText('SHIP')).toBeDefined();
  });

  it('shows empty slots', () => {
    render(<BookmarkBar />);
    expect(screen.getByText('1: ---')).toBeDefined();
    expect(screen.getByText('5: ---')).toBeDefined();
  });

  it('shows bookmark labels', () => {
    mockStoreState({
      bookmarks: [{ slot: 1, sectorX: 5, sectorY: -3, label: 'Asteroids' }],
      position: { x: 0, y: 0 },
    });
    render(<BookmarkBar />);
    expect(screen.getByText(/Asteroids/)).toBeDefined();
  });

  it('shows coordinates when bookmark has no label', () => {
    mockStoreState({
      bookmarks: [{ slot: 2, sectorX: 10, sectorY: 20, label: '' }],
      position: { x: 0, y: 0 },
    });
    render(<BookmarkBar />);
    expect(screen.getByText('2: (10,20)')).toBeDefined();
  });

  it('disables empty slot buttons', () => {
    render(<BookmarkBar />);
    const emptySlot = screen.getByText('1: ---');
    expect(emptySlot.closest('button')?.disabled).toBe(true);
  });

  it('enables filled slot buttons', () => {
    mockStoreState({
      bookmarks: [{ slot: 1, sectorX: 5, sectorY: -3, label: 'Base' }],
      position: { x: 0, y: 0 },
    });
    render(<BookmarkBar />);
    const filledSlot = screen.getByText(/Base/);
    expect(filledSlot.closest('button')?.disabled).toBeFalsy();
  });
});
