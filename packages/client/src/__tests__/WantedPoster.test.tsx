import { render, screen } from '@testing-library/react';
import { WantedPoster } from '../components/WantedPoster';
import { describe, it, expect } from 'vitest';

describe('WantedPoster', () => {
  const props = {
    targetName: "Zyr'ex Korath",
    targetLevel: 4,
    reward: 12500,
  };

  it('renders WANTED header', () => {
    render(<WantedPoster {...props} />);
    expect(screen.getByText('WANTED')).toBeTruthy();
  });

  it('renders target name', () => {
    render(<WantedPoster {...props} />);
    expect(screen.getByText(/ZYR'EX KORATH/i)).toBeTruthy();
  });

  it('renders formatted reward amount', () => {
    render(<WantedPoster {...props} />);
    // Formatted as "12.500 ¢" or similar
    expect(screen.getByText(/12[\.,]500/)).toBeTruthy();
  });

  it('renders level badge', () => {
    render(<WantedPoster {...props} />);
    expect(screen.getByText(/LVL\s*4/i)).toBeTruthy();
  });
});
