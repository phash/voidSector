import { getAllFactionConfigs } from '../db/queries.js';
import type { FactionConfigRow } from '../db/queries.js';

export class FactionConfigService {
  private configs = new Map<string, FactionConfigRow>();

  async init(): Promise<void> {
    const rows = await getAllFactionConfigs();
    this.configs.clear();
    for (const row of rows) {
      this.configs.set(row.faction_id, row);
    }
  }

  getConfig(factionId: string): FactionConfigRow | null {
    return this.configs.get(factionId) ?? null;
  }

  getActiveFactions(): FactionConfigRow[] {
    return Array.from(this.configs.values());
  }

  distanceTo(factionId: string, qx: number, qy: number): number {
    const config = this.getConfig(factionId);
    if (!config) return Infinity;
    return Math.sqrt((config.home_qx - qx) ** 2 + (config.home_qy - qy) ** 2);
  }
}
