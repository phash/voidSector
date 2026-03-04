import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { SectorArtwork } from '../components/SectorArtwork';

vi.mock('../assets/stations', () => ({
  getStationArtwork: () => undefined,
}));
vi.mock('../assets/aliens', () => ({
  getAlienArtwork: () => undefined,
}));

describe('SectorArtwork', () => {
  it('renders ASCII art for asteroid_field', () => {
    const { container } = render(<SectorArtwork sectorType="asteroid_field" />);
    expect(container.textContent).toContain('*');
  });

  it('renders ASCII art for nebula', () => {
    const { container } = render(<SectorArtwork sectorType="nebula" />);
    expect(container.textContent).toContain('~');
  });

  it('renders ASCII art for station', () => {
    const { container } = render(<SectorArtwork sectorType="station" />);
    expect(container.textContent).toContain('[===]');
  });

  it('renders nothing for unknown type', () => {
    const { container } = render(<SectorArtwork sectorType="unknown_thing" />);
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing for empty type', () => {
    const { container } = render(<SectorArtwork sectorType="empty" />);
    expect(container.innerHTML).toBe('');
  });
});
