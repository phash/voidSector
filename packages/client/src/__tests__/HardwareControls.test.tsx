import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HardwareControls } from '../components/HardwareControls';

describe('HardwareControls', () => {
  describe('empty state', () => {
    it('renders empty container when no props given', () => {
      render(<HardwareControls />);
      const container = screen.getByTestId('hardware-controls');
      expect(container).toBeInTheDocument();
      expect(container.children).toHaveLength(0);
    });
  });

  describe('D-Pad', () => {
    it('renders D-Pad when dpad prop is true', () => {
      render(<HardwareControls dpad />);
      expect(screen.getByTestId('hw-dpad')).toBeInTheDocument();
      expect(screen.getByTestId('hw-dpad-up')).toBeInTheDocument();
      expect(screen.getByTestId('hw-dpad-down')).toBeInTheDocument();
      expect(screen.getByTestId('hw-dpad-left')).toBeInTheDocument();
      expect(screen.getByTestId('hw-dpad-right')).toBeInTheDocument();
    });

    it('does not render D-Pad when dpad prop is false', () => {
      render(<HardwareControls dpad={false} />);
      expect(screen.queryByTestId('hw-dpad')).not.toBeInTheDocument();
    });

    it('fires onDpad with "up" when up button clicked', () => {
      const onDpad = vi.fn();
      render(<HardwareControls dpad onDpad={onDpad} />);
      fireEvent.click(screen.getByTestId('hw-dpad-up'));
      expect(onDpad).toHaveBeenCalledWith('up');
    });

    it('fires onDpad with "down" when down button clicked', () => {
      const onDpad = vi.fn();
      render(<HardwareControls dpad onDpad={onDpad} />);
      fireEvent.click(screen.getByTestId('hw-dpad-down'));
      expect(onDpad).toHaveBeenCalledWith('down');
    });

    it('fires onDpad with "left" when left button clicked', () => {
      const onDpad = vi.fn();
      render(<HardwareControls dpad onDpad={onDpad} />);
      fireEvent.click(screen.getByTestId('hw-dpad-left'));
      expect(onDpad).toHaveBeenCalledWith('left');
    });

    it('fires onDpad with "right" when right button clicked', () => {
      const onDpad = vi.fn();
      render(<HardwareControls dpad onDpad={onDpad} />);
      fireEvent.click(screen.getByTestId('hw-dpad-right'));
      expect(onDpad).toHaveBeenCalledWith('right');
    });
  });

  describe('Zoom slider', () => {
    it('renders zoom slider with correct value', () => {
      render(<HardwareControls zoom zoomValue={3} />);
      expect(screen.getByTestId('hw-zoom')).toBeInTheDocument();
      expect(screen.getByText('ZOOM')).toBeInTheDocument();
      const slider = screen.getByRole('slider');
      expect(slider).toHaveValue('3');
    });

    it('uses default zoomValue of 2', () => {
      render(<HardwareControls zoom />);
      const slider = screen.getByRole('slider');
      expect(slider).toHaveValue('2');
    });

    it('fires onZoom on change', () => {
      const onZoom = vi.fn();
      render(<HardwareControls zoom zoomValue={2} onZoom={onZoom} />);
      const slider = screen.getByRole('slider');
      fireEvent.change(slider, { target: { value: '3' } });
      expect(onZoom).toHaveBeenCalledWith(3);
    });

    it('respects custom zoomMin and zoomMax', () => {
      render(<HardwareControls zoom zoomMin={1} zoomMax={10} zoomValue={5} />);
      const slider = screen.getByRole('slider');
      expect(slider).toHaveAttribute('min', '1');
      expect(slider).toHaveAttribute('max', '10');
    });
  });

  describe('Power button', () => {
    it('renders power button with "on" state', () => {
      render(<HardwareControls power powerOn />);
      const btn = screen.getByTestId('hw-power');
      expect(btn).toBeInTheDocument();
      expect(btn).toHaveClass('hw-power-btn', 'on');
      expect(btn.querySelector('.hw-power-led')).toHaveClass('green');
    });

    it('renders power button with "off" state', () => {
      render(<HardwareControls power powerOn={false} />);
      const btn = screen.getByTestId('hw-power');
      expect(btn).toHaveClass('hw-power-btn');
      expect(btn).not.toHaveClass('on');
      expect(btn.querySelector('.hw-power-led')).toHaveClass('orange');
    });

    it('fires onPower when clicked', () => {
      const onPower = vi.fn();
      render(<HardwareControls power onPower={onPower} />);
      fireEvent.click(screen.getByTestId('hw-power'));
      expect(onPower).toHaveBeenCalledOnce();
    });
  });

  describe('Channel buttons', () => {
    it('renders channel buttons', () => {
      render(<HardwareControls channels={['nav', 'comm', 'scan']} />);
      expect(screen.getByTestId('hw-channels')).toBeInTheDocument();
      expect(screen.getByTestId('hw-channel-nav')).toHaveTextContent('NAV');
      expect(screen.getByTestId('hw-channel-comm')).toHaveTextContent('COMM');
      expect(screen.getByTestId('hw-channel-scan')).toHaveTextContent('SCAN');
    });

    it('truncates channel labels to 4 characters', () => {
      render(<HardwareControls channels={['navigation']} />);
      expect(screen.getByTestId('hw-channel-navigation')).toHaveTextContent('NAVI');
    });

    it('marks active channel with .active class', () => {
      render(<HardwareControls channels={['nav', 'comm']} activeChannel="comm" />);
      expect(screen.getByTestId('hw-channel-nav')).not.toHaveClass('active');
      expect(screen.getByTestId('hw-channel-comm')).toHaveClass('active');
    });

    it('fires onChannel when a channel button is clicked', () => {
      const onChannel = vi.fn();
      render(<HardwareControls channels={['nav', 'comm']} onChannel={onChannel} />);
      fireEvent.click(screen.getByTestId('hw-channel-comm'));
      expect(onChannel).toHaveBeenCalledWith('comm');
    });

    it('does not render channel strip when channels is empty', () => {
      render(<HardwareControls channels={[]} />);
      expect(screen.queryByTestId('hw-channels')).not.toBeInTheDocument();
    });
  });
});
