import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TutorialPanel } from '../components/TutorialPanel';
import { useStore } from '../state/store';

function setTutorial(tutorial: unknown, showTip = vi.fn()) {
  useStore.setState({ tutorial, showTip } as any);
  return showTip;
}

describe('TutorialPanel', () => {
  it('renders nothing without active tutorial', () => {
    setTutorial(null);
    render(<TutorialPanel />);
    expect(screen.queryByTestId('tutorial-panel')).toBeNull();
  });

  it('shows current step title, hint and progress counter', () => {
    setTutorial({ step: 0, total: 4, oreMined: 0, oreTarget: 5, done: false });
    render(<TutorialPanel />);
    expect(screen.getByTestId('tutorial-panel')).toBeTruthy();
    expect(screen.getByText(/TUTORIAL \[1\/4\]/)).toBeTruthy();
    expect(screen.getByText('BEWEGEN')).toBeTruthy();
  });

  it('shows ore progress during the mining step', () => {
    setTutorial({ step: 2, total: 4, oreMined: 3, oreTarget: 5, done: false });
    render(<TutorialPanel />);
    expect(screen.getByText(/3\/5/)).toBeTruthy();
  });

  it('opens help tip via [?] button', () => {
    const showTip = setTutorial({ step: 0, total: 4, oreMined: 0, oreTarget: 5, done: false });
    render(<TutorialPanel />);
    fireEvent.click(screen.getByTestId('tutorial-help'));
    expect(showTip).toHaveBeenCalledWith('first_tutorial');
  });

  it('renders nothing when tutorial is done', () => {
    setTutorial({ step: 3, total: 4, oreMined: 5, oreTarget: 5, done: true });
    render(<TutorialPanel />);
    expect(screen.queryByTestId('tutorial-panel')).toBeNull();
  });
});
