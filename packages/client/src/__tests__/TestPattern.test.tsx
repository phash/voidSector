import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TestPattern } from '../components/TestPattern';

describe('TestPattern', () => {
  it('renders a canvas element', () => {
    render(<TestPattern />);
    const canvas = screen.getByTestId('test-pattern');
    expect(canvas).toBeInTheDocument();
    expect(canvas.tagName).toBe('CANVAS');
  });

  it('canvas fills its container', () => {
    render(<TestPattern />);
    const canvas = screen.getByTestId('test-pattern') as HTMLCanvasElement;
    expect(canvas.style.width).toBe('100%');
    expect(canvas.style.height).toBe('100%');
    expect(canvas.style.display).toBe('block');
  });
});
