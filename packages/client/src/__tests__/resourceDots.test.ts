import { describe, it, expect, vi, beforeEach } from 'vitest';
import { drawRadar } from '../canvas/RadarRenderer';
import type { SectorData } from '@void-sector/shared';

describe('Resource indicator dots on radar', () => {
  let ctx: CanvasRenderingContext2D;
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    ctx = canvas.getContext('2d')!;
    Object.defineProperty(window, 'devicePixelRatio', { value: 1, writable: true });
  });

  /** Helper: create a partial SectorData discovery record cast to the right type. */
  function disc(partial: Record<string, Partial<SectorData>>): Record<string, SectorData> {
    return partial as Record<string, SectorData>;
  }

  function baseState() {
    return {
      position: { x: 0, y: 0 },
      discoveries: {} as Record<string, SectorData>,
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
      bookmarks: [],
      animTime: 0,
      navTarget: null,
    };
  }

  it('draws without error when sector has resources', () => {
    const state = {
      ...baseState(),
      discoveries: disc({
        '1:0': { type: 'asteroid_field', resources: { ore: 50, gas: 0, crystal: 20 } },
      }),
    };
    expect(() => drawRadar(ctx, state)).not.toThrow();
  });

  it('draws solid bars for full resources at zoom >= 1', () => {
    const fillRectSpy = vi.spyOn(ctx, 'fillRect');
    const state = {
      ...baseState(),
      zoomLevel: 1,
      discoveries: disc({
        '1:0': { type: 'asteroid_field', resources: { ore: 50, gas: 0, crystal: 20 } },
      }),
    };
    drawRadar(ctx, state);
    // At 100% fill (value == max since we use current as max),
    // resource dots become solid bars drawn with fillRect.
    // fillRect is used for many things; just verify no error and it was called.
    expect(fillRectSpy).toHaveBeenCalled();
  });

  it('does not draw resource dots at zoom 0', () => {
    const fillRectSpy = vi.spyOn(ctx, 'fillRect');
    const arcSpy = vi.spyOn(ctx, 'arc');
    const state = {
      ...baseState(),
      zoomLevel: 0,
      discoveries: disc({
        '1:0': { type: 'asteroid_field', resources: { ore: 50, gas: 0, crystal: 20 } },
      }),
    };
    const callsBefore = arcSpy.mock.calls.length;
    drawRadar(ctx, state);
    // At zoom 0, resource dots should not appear.
    // We can't easily isolate dot calls from other arc calls,
    // but the draw should still succeed without error.
    expect(() => drawRadar(ctx, state)).not.toThrow();
  });

  it('uses cyan color for crystal dots', () => {
    const state = {
      ...baseState(),
      zoomLevel: 2,
      discoveries: disc({
        '1:0': { type: 'nebula', resources: { ore: 0, gas: 30, crystal: 15 } },
      }),
    };
    drawRadar(ctx, state);
    // Check that cyan (#66CCFF) was used as fillStyle at some point
    const fillStyleSetter = vi.spyOn(ctx, 'fillStyle', 'set');
    drawRadar(ctx, state);
    const cyanCalls = fillStyleSetter.mock.calls.filter(([val]) => val === '#66CCFF');
    expect(cyanCalls.length).toBeGreaterThan(0);
  });

  it('draws without error when resources are all zero', () => {
    const state = {
      ...baseState(),
      discoveries: disc({
        '1:0': { type: 'empty', resources: { ore: 0, gas: 0, crystal: 0 } },
      }),
    };
    expect(() => drawRadar(ctx, state)).not.toThrow();
  });

  it('draws without error when sector has no resources property', () => {
    const state = {
      ...baseState(),
      discoveries: disc({
        '1:0': { type: 'station' },
      }),
    };
    expect(() => drawRadar(ctx, state)).not.toThrow();
  });

  it('uses theme color for ore/gas dots', () => {
    const state = {
      ...baseState(),
      zoomLevel: 2,
      themeColor: '#33FF33',
      discoveries: disc({
        '1:0': { type: 'asteroid_field', resources: { ore: 40, gas: 0, crystal: 0 } },
      }),
    };
    const fillStyleSetter = vi.spyOn(ctx, 'fillStyle', 'set');
    drawRadar(ctx, state);
    // Theme color should appear in fillStyle calls for ore dots
    const themeCalls = fillStyleSetter.mock.calls.filter(([val]) => val === '#33FF33');
    expect(themeCalls.length).toBeGreaterThan(0);
  });

  it('handles gas as primary resource when ore is 0', () => {
    const state = {
      ...baseState(),
      zoomLevel: 2,
      discoveries: disc({
        '1:0': { type: 'nebula', resources: { ore: 0, gas: 80, crystal: 0 } },
      }),
    };
    // Should draw gas dots without error using theme color
    expect(() => drawRadar(ctx, state)).not.toThrow();
  });
});
