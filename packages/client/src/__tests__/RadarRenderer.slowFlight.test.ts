import { describe, it, expect, vi, beforeEach } from 'vitest';
import { drawRadar } from '../canvas/RadarRenderer';

describe('drawRadar — slowFlightPath', () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      canvas: { width: 800, height: 600 },
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      fillText: vi.fn(),
      strokeText: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      fill: vi.fn(),
      arc: vi.fn(),
      closePath: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      setLineDash: vi.fn(),
      measureText: vi.fn(() => ({ width: 10 })),
      createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
      globalAlpha: 1,
      strokeStyle: '',
      fillStyle: '',
      lineWidth: 1,
      font: '',
      textAlign: 'left',
      textBaseline: 'top',
    };
  });

  const baseState = {
    position: { x: 5, y: 5 },
    discoveries: {},
    players: {},
    currentSector: null,
    themeColor: '#FFB000',
    dimColor: '#444',
    zoomLevel: 1,
    panOffset: { x: 0, y: 0 },
  };

  it('calls setLineDash and draws a line when slowFlightPath is set', () => {
    drawRadar(ctx, {
      ...baseState,
      slowFlightPath: [{ x: 5, y: 5 }, { x: 8, y: 5 }],
    });

    expect(ctx.setLineDash).toHaveBeenCalledWith(expect.arrayContaining([expect.any(Number)]));
    expect(ctx.moveTo).toHaveBeenCalled();
    expect(ctx.lineTo).toHaveBeenCalled();
    expect(ctx.stroke).toHaveBeenCalled();
  });

  it('does NOT draw path line when slowFlightPath is absent', () => {
    const setLineDashCalls: any[] = [];
    ctx.setLineDash = vi.fn((d) => setLineDashCalls.push(d));

    drawRadar(ctx, { ...baseState });

    // setLineDash should not be called with a dashed pattern for path
    const dashedCalls = setLineDashCalls.filter((d) => d.length > 0 && d[0] > 0);
    expect(dashedCalls).toHaveLength(0);
  });
});
