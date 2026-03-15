#!/usr/bin/env tsx
/**
 * balance:import — Import balance config from JSON snapshot.
 *
 * Usage:
 *   npm run balance:import -- balance-snapshot-2026-03-15.json
 *   npm run balance:import -- balance-snapshot-2026-03-15.json --dry-run
 *
 * Requires: server running, ADMIN_TOKEN env var or default vs-admin-2026
 * Creates a backup before importing.
 */

const BASE_URL = process.env.SERVER_URL || 'http://localhost:2567';
const TOKEN = process.env.ADMIN_TOKEN || 'vs-admin-2026';

async function api(path: string, method = 'GET', body?: any) {
  const res = await fetch(`${BASE_URL}/admin/api${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) throw new Error(`API ${method} ${path} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const inputFile = args.find((a) => !a.startsWith('--'));

  if (!inputFile) {
    console.error('Usage: npm run balance:import -- <file.json> [--dry-run]');
    process.exit(1);
  }

  const { readFileSync, writeFileSync } = await import('fs');
  const snapshot = JSON.parse(readFileSync(inputFile, 'utf-8'));

  console.log(`Importing from: ${inputFile}`);
  console.log(`Source: ${snapshot.meta?.exportedAt ?? 'unknown'}`);
  if (dryRun) console.log('DRY RUN — no changes will be made\n');

  // 1. Backup current state
  if (!dryRun) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const backupFile = `balance-backup-${timestamp}.json`;
    console.log(`Creating backup: ${backupFile}`);

    const { entries } = await api('/config');
    const currentConfig: Record<string, any> = {};
    for (const e of entries) {
      currentConfig[e.key] = { value: e.value, category: e.category, description: e.description };
    }
    const factionData = await api('/faction-config');
    writeFileSync(backupFile, JSON.stringify({
      meta: { exportedAt: new Date().toISOString(), reason: `backup before import of ${inputFile}` },
      gameConfig: currentConfig,
      factionConfig: Object.fromEntries(
        (factionData.factions ?? []).map((f: any) => [f.faction_id, {
          home_qx: f.home_qx, home_qy: f.home_qy,
          expansion_rate: f.expansion_rate, aggression: f.aggression,
          expansion_style: f.expansion_style,
        }]),
      ),
    }, null, 2) + '\n');
  }

  // 2. Import game config (only custom values)
  let configUpdated = 0;
  let configSkipped = 0;
  if (snapshot.gameConfig) {
    for (const [key, entry] of Object.entries(snapshot.gameConfig) as [string, any][]) {
      if (!entry.isCustom) {
        configSkipped++;
        continue;
      }
      if (dryRun) {
        console.log(`  [DRY] SET ${key} = ${JSON.stringify(entry.value)}`);
      } else {
        await api('/config/by-key', 'PUT', {
          key,
          value: entry.value,
          category: entry.category,
          description: entry.description,
        });
      }
      configUpdated++;
    }
  }

  // 3. Import faction config
  let factionUpdated = 0;
  if (snapshot.factionConfig) {
    for (const [factionId, config] of Object.entries(snapshot.factionConfig) as [string, any][]) {
      if (dryRun) {
        console.log(`  [DRY] FACTION ${factionId}: rate=${config.expansion_rate}, aggr=${config.aggression}`);
      } else {
        await api('/faction-config', 'PUT', { factionId, ...config });
      }
      factionUpdated++;
    }
  }

  console.log(`\nGame config: ${configUpdated} updated, ${configSkipped} skipped (defaults)`);
  console.log(`Faction config: ${factionUpdated} updated`);
  if (dryRun) console.log('\nDry run complete. Re-run without --dry-run to apply.');
  else console.log('\nImport complete. Restart server for full effect.');
}

main().catch((err) => {
  console.error('Import failed:', err.message);
  process.exit(1);
});
