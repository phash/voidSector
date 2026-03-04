import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

describe('Test setup', () => {
  it('renders a basic component', () => {
    render(<div data-testid="test">hello</div>);
    expect(screen.getByTestId('test')).toHaveTextContent('hello');
  });
});
