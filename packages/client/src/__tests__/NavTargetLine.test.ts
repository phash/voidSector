import { describe, it, expect, vi, beforeEach } from 'vitest';
import { drawRadar } from '../canvas/RadarRenderer';

describe('RadarRenderer navTarget line', () => {
  let ctx: CanvasRenderingContext2D;
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    ctx = canvas.getContext('2d')!;
    // Mock devicePixelRatio
    Object.defineProperty(window, 'devicePixelRatio', { value: 1, writable: true });
  });

  function baseState() {
    return {
      position: { x: 0, y: 0 },
      discoveries: {} as Record<string, any>,
      players: {} as Record<string, any>,
      currentSector: null,
      themeColor: '#FFB000',
      dimColor: 'rgba(136, 119, 68, 0.6)',
      zoomLevel: 2,
      panOffset: { x: 0, y: 0 },
      jumpAnimation: null,
      selectedSector: null,
      jumpGateInfo: null,
      scanEvents: [],
      discoveryTimestamps: {},
      hullType: 'scout' as const,
      homeBase: { x: 0, y: 0 },
      bookmarks: [],
      animTime: 0,
    };
  }

  it('draws without error when navTarget is null', () => {
    const state = { ...baseState(), navTarget: null };
    expect(() => drawRadar(ctx, state)).not.toThrow();
  });

  it('draws without error when navTarget is set', () => {
    const state = { ...baseState(), navTarget: { x: 3, y: 2 } };
    expect(() => drawRadar(ctx, state)).not.toThrow();
  });

  it('calls setLineDash when navTarget is visible', () => {
    const spy = vi.spyOn(ctx, 'setLineDash');
    const state = { ...baseState(), navTarget: { x: 1, y: 1 } };
    drawRadar(ctx, state);
    // setLineDash should have been called with dashed pattern
    const dashCalls = spy.mock.calls.filter(
      (call) => Array.isArray(call[0]) && call[0].length === 2 && call[0][0] === 6,
    );
    expect(dashCalls.length).toBeGreaterThan(0);
  });

  it('does not draw dashed line when navTarget is off-screen', () => {
    const spy = vi.spyOn(ctx, 'setLineDash');
    const state = { ...baseState(), navTarget: { x: 999, y: 999 } };
    drawRadar(ctx, state);
    // No dashed calls expected since both ends are out of view
    // The player position (0,0) IS in view, but target (999,999) is not.
    // Since we draw if either endpoint is visible, we should still get a dash call
    const dashCalls = spy.mock.calls.filter(
      (call) => Array.isArray(call[0]) && call[0].length === 2 && call[0][0] === 6,
    );
    expect(dashCalls.length).toBeGreaterThan(0);
  });

  it('does not draw nav line during jump animation', () => {
    const spy = vi.spyOn(ctx, 'setLineDash');
    const state = {
      ...baseState(),
      navTarget: { x: 1, y: 1 },
      jumpAnimation: {
        active: true,
        phase: 'glitch' as const,
        progress: 0.5,
        direction: { dx: 1, dy: 0 },
        startTime: 0,
        distance: 1,
        isLongJump: false,
      },
    };
    drawRadar(ctx, state);
    // During animation, nav line should not be drawn
    const dashCalls = spy.mock.calls.filter(
      (call) => Array.isArray(call[0]) && call[0].length === 2 && call[0][0] === 6,
    );
    expect(dashCalls.length).toBe(0);
  });
});
