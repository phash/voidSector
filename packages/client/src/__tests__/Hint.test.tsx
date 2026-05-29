import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Hint } from '../components/Hint';

describe('Hint', () => {
  it('renders children unchanged when reason is null', () => {
    render(
      <Hint reason={null}>
        <button>GO</button>
      </Hint>,
    );
    expect(screen.getByText('GO')).toBeInTheDocument();
    expect(screen.queryByTestId('hint-wrap')).toBeNull();
  });

  it('shows the reason tooltip on hover and hides on leave', () => {
    render(
      <Hint reason="KEIN AP">
        <button disabled>JUMP</button>
      </Hint>,
    );
    const wrap = screen.getByTestId('hint-wrap');
    expect(screen.queryByTestId('hint-tooltip')).toBeNull();
    fireEvent.mouseEnter(wrap);
    expect(screen.getByTestId('hint-tooltip')).toHaveTextContent('KEIN AP');
    fireEvent.mouseLeave(wrap);
    expect(screen.queryByTestId('hint-tooltip')).toBeNull();
  });
});
