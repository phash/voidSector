import { describe, it, expect } from 'vitest';
import { buildXenoStatus } from '../alienReputationService.js';

describe('buildXenoStatus', () => {
  it('returns one entry per known alien faction (10)', () => {
    const status = buildXenoStatus(0, 0, {}, []);
    expect(status).toHaveLength(10);
    const ids = status.map((s) => s.factionId);
    expect(ids).toContain('scrappers');
    expect(ids).toContain('axioms');
  });

  it('marks every faction out of range near origin (0,0)', () => {
    const status = buildXenoStatus(0, 0, {}, []);
    expect(status.every((s) => s.reachable === false)).toBe(true);
  });

  it('marks scrappers reachable at quadrant distance 60 but not axioms', () => {
    const status = buildXenoStatus(60, 0, {}, []);
    const scrappers = status.find((s) => s.factionId === 'scrappers')!;
    const axioms = status.find((s) => s.factionId === 'axioms')!;
    expect(scrappers.reachable).toBe(true); // ALIEN_FIRST_CONTACT_DISTANCE.scrappers = 60
    expect(axioms.reachable).toBe(false); // axioms distance = 2500
  });

  it('maps reputation to tier label and reflects first-contact state', () => {
    const status = buildXenoStatus(60, 0, { scrappers: 75 }, ['scrappers']);
    const scrappers = status.find((s) => s.factionId === 'scrappers')!;
    expect(scrappers.reputation).toBe(75);
    expect(scrappers.tier).toBe('GEEHRT'); // 75 > 70 => honored
    expect(scrappers.firstContacted).toBe(true);
  });

  it('defaults a missing reputation to 0 / NEUTRAL and firstContacted false', () => {
    const status = buildXenoStatus(60, 0, { scrappers: 75 }, ['scrappers']);
    const archivists = status.find((s) => s.factionId === 'archivists')!;
    expect(archivists.reputation).toBe(0);
    expect(archivists.tier).toBe('NEUTRAL');
    expect(archivists.firstContacted).toBe(false);
  });
});
