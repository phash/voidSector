import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { AcepPanel } from '../components/AcepPanel.js';

const mockAcep = {
  ausbau: 15,
  intel: 8,
  kampf: 32,
  explorer: 3,
  traits: ['veteran', 'reckless'],
};

describe('AcepPanel', () => {
  it('renders all 4 XP bars', () => {
    render(<AcepPanel acep={mockAcep} />);
    expect(screen.getByText(/AUSBAU/i)).toBeInTheDocument();
    expect(screen.getByText(/INTEL/i)).toBeInTheDocument();
    expect(screen.getByText(/KAMPF/i)).toBeInTheDocument();
    expect(screen.getByText(/EXPLORER/i)).toBeInTheDocument();
  });

  it('shows traits', () => {
    render(<AcepPanel acep={mockAcep} />);
    expect(screen.getByText(/veteran/i)).toBeInTheDocument();
    expect(screen.getByText(/reckless/i)).toBeInTheDocument();
  });

  it('shows correct level for KAMPF at 32 XP (Level 4)', () => {
    render(<AcepPanel acep={mockAcep} />);
    expect(screen.getByText(/LVL 4/i)).toBeInTheDocument();
  });

  it('does not render traits section when traits array is empty', () => {
    render(<AcepPanel acep={{ ...mockAcep, traits: [] }} />);
    expect(screen.queryByText(/TRAITS/i)).not.toBeInTheDocument();
  });
});
