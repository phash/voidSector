#!/usr/bin/env tsx
/**
 * balance:export — Export all balance-relevant config to JSON.
 *
 * Usage:
 *   npm run balance:export                    # writes balance-snapshot-YYYY-MM-DD.json
 *   npm run balance:export -- -o custom.json  # custom output file
 *
 * Requires: server running, ADMIN_TOKEN env var or default vs-admin-2026
 */

const BASE_URL = process.env.SERVER_URL || 'http://localhost:2567';
const TOKEN = process.env.ADMIN_TOKEN || 'vs-admin-2026';

async function api(path: string) {
  const res = await fetch(`${BASE_URL}/admin/api${path}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  if (!res.ok) throw new Error(`API ${path} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function main() {
  const args = process.argv.slice(2);
  const outIdx = args.indexOf('-o');
  const today = new Date().toISOString().slice(0, 10);
  const outFile = outIdx >= 0 ? args[outIdx + 1] : `balance-snapshot-${today}.json`;

  console.log('Exporting balance config...');

  // 1. Game config (all entries)
  const { entries } = await api('/config');
  const gameConfig: Record<string, any> = {};
  for (const e of entries) {
    // Get default to determine isCustom
    const detail = await api(`/config/by-key?key=${encodeURIComponent(e.key)}`);
    gameConfig[e.key] = {
      value: detail.value,
      category: e.category,
      description: e.description,
      isCustom: detail.isCustom,
    };
  }

  // 2. Faction config
  const factionData = await api('/faction-config');
  const factionConfig: Record<string, any> = {};
  for (const f of factionData.factions) {
    factionConfig[f.faction_id] = {
      home_qx: f.home_qx,
      home_qy: f.home_qy,
      expansion_rate: f.expansion_rate,
      aggression: f.aggression,
      expansion_style: f.expansion_style,
    };
  }

  const snapshot = {
    meta: {
      exportedAt: new Date().toISOString(),
      serverUrl: BASE_URL,
      migrationVersion: '073',
    },
    gameConfig,
    factionConfig,
  };

  const { writeFileSync } = await import('fs');
  writeFileSync(outFile, JSON.stringify(snapshot, null, 2) + '\n');
  console.log(`Exported ${Object.keys(gameConfig).length} game config entries`);
  console.log(`Exported ${Object.keys(factionConfig).length} faction configs`);
  console.log(`Written to: ${outFile}`);
}

main().catch((err) => {
  console.error('Export failed:', err.message);
  process.exit(1);
});
