export type TechBranch = 'kampf' | 'ausbau' | 'intel' | 'explorer';
export type TechNodeType = 'branch' | 'module' | 'specialization' | 'leaf';

export type TechStatKey =
  | 'weapon_damage' | 'weapon_range' | 'weapon_efficiency'
  | 'shield_strength' | 'shield_regen' | 'shield_efficiency'
  | 'cargo_capacity' | 'cargo_weight' | 'cargo_protection'
  | 'mining_yield' | 'mining_speed' | 'mining_range'
  | 'scan_range' | 'scan_detail' | 'scan_speed'
  | 'sensor_precision' | 'sensor_stealth' | 'sensor_range'
  | 'lab_wissen_rate' | 'lab_efficiency' | 'lab_capacity'
  | 'drive_ap_efficiency' | 'drive_speed' | 'drive_jump_range'
  | 'fuel_capacity' | 'fuel_consumption' | 'fuel_regen'
  | 'nav_autopilot' | 'nav_route_efficiency' | 'nav_discovery';

export interface TechEffect {
  type: 'unlock_tier' | 'stat_bonus';
  /** For unlock_tier: module category. For stat_bonus: stat key */
  target: string;
  /** For unlock_tier: tier number. For stat_bonus: bonus value (decimal, e.g. 0.15 = +15%) */
  value: number;
  /** Optional penalty for stat_bonus */
  penalty?: { target: TechStatKey; value: number };
}

export interface TechTreeNode {
  id: string;
  type: TechNodeType;
  name: string;
  description: string;
  parent: string | null;
  exclusiveGroup?: string;
  maxLevel: number;
  baseCost: number;
  costPerLevel?: number[];  // for branch/leaf with maxLevel > 1
  effects: TechEffect[];
  branch: TechBranch;
  depth: number;
}

// --- Helpers ---

function branch(id: string, name: string, desc: string, b: TechBranch): TechTreeNode {
  return {
    id, type: 'branch', name, description: desc, parent: null,
    maxLevel: 3, baseCost: 150, costPerLevel: [150, 450, 1350],
    effects: [{ type: 'unlock_tier', target: b, value: 2 }],
    branch: b, depth: 0,
  };
}

function mod(id: string, name: string, desc: string, parentId: string, b: TechBranch, group: string, effects: TechEffect[]): TechTreeNode {
  return {
    id, type: 'module', name, description: desc, parent: parentId,
    exclusiveGroup: group, maxLevel: 1, baseCost: 280, effects, branch: b, depth: 1,
  };
}

function spec(id: string, name: string, desc: string, parentId: string, b: TechBranch, group: string, effects: TechEffect[]): TechTreeNode {
  return {
    id, type: 'specialization', name, description: desc, parent: parentId,
    exclusiveGroup: group, maxLevel: 1, baseCost: 620, effects, branch: b, depth: 2,
  };
}

/** Depth is auto-computed: module-leaf -> depth 2, spec-leaf -> depth 3 */
function leaf(id: string, name: string, desc: string, parentId: string, b: TechBranch, group: string, stat: TechStatKey, value: number, penalty?: { target: TechStatKey; value: number }): TechTreeNode {
  const eff: TechEffect = { type: 'stat_bonus', target: stat, value };
  if (penalty) eff.penalty = penalty;
  return {
    id, type: 'leaf', name, description: desc, parent: parentId,
    exclusiveGroup: group, maxLevel: 3, baseCost: 180, costPerLevel: [180, 540, 1620],
    effects: [eff], branch: b, depth: -1,  // placeholder, computed below
  };
}

// --- Full Tree Definition ---

const nodes: TechTreeNode[] = [
  // ===== KAMPF =====
  branch('kampf', 'KAMPF', 'Waffensysteme und Kampftechnologie.', 'kampf'),

  mod('kampf.laser', 'LASER', 'Präzisionswaffe mit hoher Reichweite und niedrigem Energieverbrauch.', 'kampf', 'kampf', 'kampf.weapons', []),
  mod('kampf.missile', 'MISSILE', 'Raketensysteme mit hohem Burst-Schaden. Begrenzte Munition.', 'kampf', 'kampf', 'kampf.weapons', []),
  mod('kampf.railgun', 'RAILGUN', 'Elektromagnetische Massegeschosse. Extrem hoher Einzelschaden.', 'kampf', 'kampf', 'kampf.weapons', []),

  leaf('kampf.laser.dmg', 'SCHADEN', 'Erhöhter Laser-Schaden.', 'kampf.laser', 'kampf', 'kampf.laser.leaves', 'weapon_damage', 0.15, { target: 'weapon_efficiency', value: -0.05 }),
  leaf('kampf.laser.range', 'REICHWEITE', 'Erhöhte Laser-Reichweite.', 'kampf.laser', 'kampf', 'kampf.laser.leaves', 'weapon_range', 0.20, { target: 'weapon_damage', value: -0.05 }),
  leaf('kampf.laser.eff', 'ENERGIEEFFIZIENZ', 'Reduzierter Energieverbrauch.', 'kampf.laser', 'kampf', 'kampf.laser.leaves', 'weapon_efficiency', 0.15, { target: 'weapon_damage', value: -0.10 }),

  spec('kampf.laser.phaser', 'PHASER', 'Phasenstrahlen durchdringen Schilde teilweise.', 'kampf.laser', 'kampf', 'kampf.laser.specs', [{ type: 'stat_bonus', target: 'weapon_damage', value: -0.20 }]),
  spec('kampf.laser.impulse', 'IMPULSLASER', 'Kurze hochenergetische Impulse. Burst-DPS.', 'kampf.laser', 'kampf', 'kampf.laser.specs', [{ type: 'stat_bonus', target: 'weapon_efficiency', value: -0.20 }]),

  leaf('kampf.missile.dmg', 'SCHADEN', 'Erhöhter Raketenschaden.', 'kampf.missile', 'kampf', 'kampf.missile.leaves', 'weapon_damage', 0.15),
  leaf('kampf.missile.range', 'REICHWEITE', 'Erhöhte Raketenreichweite.', 'kampf.missile', 'kampf', 'kampf.missile.leaves', 'weapon_range', 0.20),
  leaf('kampf.missile.eff', 'ENERGIEEFFIZIENZ', 'Reduzierter Munitionsverbrauch.', 'kampf.missile', 'kampf', 'kampf.missile.leaves', 'weapon_efficiency', 0.15),
  spec('kampf.missile.antimatter', 'ANTI-MATTER', 'Anti-Materie-Sprengkopf. Maximaler Einzelzielschaden.', 'kampf.missile', 'kampf', 'kampf.missile.specs', []),
  spec('kampf.missile.swarm', 'MISSILE SWARM', 'Schwarm kleiner Raketen. Flächenschaden.', 'kampf.missile', 'kampf', 'kampf.missile.specs', []),

  leaf('kampf.railgun.dmg', 'SCHADEN', 'Erhöhter Railgun-Schaden.', 'kampf.railgun', 'kampf', 'kampf.railgun.leaves', 'weapon_damage', 0.15),
  leaf('kampf.railgun.range', 'REICHWEITE', 'Erhöhte Railgun-Reichweite.', 'kampf.railgun', 'kampf', 'kampf.railgun.leaves', 'weapon_range', 0.20),
  leaf('kampf.railgun.eff', 'ENERGIEEFFIZIENZ', 'Reduzierter Energieverbrauch.', 'kampf.railgun', 'kampf', 'kampf.railgun.leaves', 'weapon_efficiency', 0.15),
  spec('kampf.railgun.power', 'POWERGUN', 'Maximale Durchschlagskraft. Panzerungsignorierung.', 'kampf.railgun', 'kampf', 'kampf.railgun.specs', []),
  spec('kampf.railgun.multi', 'MULTI GUN', 'Schnellfeuer-Railgun. Geringerer Einzelschaden.', 'kampf.railgun', 'kampf', 'kampf.railgun.specs', []),

  // --- KAMPF spec-leaves (18) ---
  leaf('kampf.laser.phaser.dmg', 'SCHADEN', 'Phaser-Schaden.', 'kampf.laser.phaser', 'kampf', 'kampf.laser.phaser.leaves', 'weapon_damage', 0.15),
  leaf('kampf.laser.phaser.range', 'REICHWEITE', 'Phaser-Reichweite.', 'kampf.laser.phaser', 'kampf', 'kampf.laser.phaser.leaves', 'weapon_range', 0.20),
  leaf('kampf.laser.phaser.eff', 'ENERGIEEFFIZIENZ', 'Phaser-Effizienz.', 'kampf.laser.phaser', 'kampf', 'kampf.laser.phaser.leaves', 'weapon_efficiency', 0.15),
  leaf('kampf.laser.impulse.dmg', 'SCHADEN', 'Impulslaser-Schaden.', 'kampf.laser.impulse', 'kampf', 'kampf.laser.impulse.leaves', 'weapon_damage', 0.15),
  leaf('kampf.laser.impulse.range', 'REICHWEITE', 'Impulslaser-Reichweite.', 'kampf.laser.impulse', 'kampf', 'kampf.laser.impulse.leaves', 'weapon_range', 0.20),
  leaf('kampf.laser.impulse.eff', 'ENERGIEEFFIZIENZ', 'Impulslaser-Effizienz.', 'kampf.laser.impulse', 'kampf', 'kampf.laser.impulse.leaves', 'weapon_efficiency', 0.15),
  leaf('kampf.missile.antimatter.dmg', 'SCHADEN', 'Anti-Matter-Schaden.', 'kampf.missile.antimatter', 'kampf', 'kampf.missile.antimatter.leaves', 'weapon_damage', 0.15),
  leaf('kampf.missile.antimatter.range', 'REICHWEITE', 'Anti-Matter-Reichweite.', 'kampf.missile.antimatter', 'kampf', 'kampf.missile.antimatter.leaves', 'weapon_range', 0.20),
  leaf('kampf.missile.antimatter.eff', 'ENERGIEEFFIZIENZ', 'Anti-Matter-Effizienz.', 'kampf.missile.antimatter', 'kampf', 'kampf.missile.antimatter.leaves', 'weapon_efficiency', 0.15),
  leaf('kampf.missile.swarm.dmg', 'SCHADEN', 'Schwarm-Schaden.', 'kampf.missile.swarm', 'kampf', 'kampf.missile.swarm.leaves', 'weapon_damage', 0.15),
  leaf('kampf.missile.swarm.range', 'REICHWEITE', 'Schwarm-Reichweite.', 'kampf.missile.swarm', 'kampf', 'kampf.missile.swarm.leaves', 'weapon_range', 0.20),
  leaf('kampf.missile.swarm.eff', 'ENERGIEEFFIZIENZ', 'Schwarm-Effizienz.', 'kampf.missile.swarm', 'kampf', 'kampf.missile.swarm.leaves', 'weapon_efficiency', 0.15),
  leaf('kampf.railgun.power.dmg', 'SCHADEN', 'Powergun-Schaden.', 'kampf.railgun.power', 'kampf', 'kampf.railgun.power.leaves', 'weapon_damage', 0.15),
  leaf('kampf.railgun.power.range', 'REICHWEITE', 'Powergun-Reichweite.', 'kampf.railgun.power', 'kampf', 'kampf.railgun.power.leaves', 'weapon_range', 0.20),
  leaf('kampf.railgun.power.eff', 'ENERGIEEFFIZIENZ', 'Powergun-Effizienz.', 'kampf.railgun.power', 'kampf', 'kampf.railgun.power.leaves', 'weapon_efficiency', 0.15),
  leaf('kampf.railgun.multi.dmg', 'SCHADEN', 'Multi-Gun-Schaden.', 'kampf.railgun.multi', 'kampf', 'kampf.railgun.multi.leaves', 'weapon_damage', 0.15),
  leaf('kampf.railgun.multi.range', 'REICHWEITE', 'Multi-Gun-Reichweite.', 'kampf.railgun.multi', 'kampf', 'kampf.railgun.multi.leaves', 'weapon_range', 0.20),
  leaf('kampf.railgun.multi.eff', 'ENERGIEEFFIZIENZ', 'Multi-Gun-Effizienz.', 'kampf.railgun.multi', 'kampf', 'kampf.railgun.multi.leaves', 'weapon_efficiency', 0.15),

  // ===== AUSBAU =====
  branch('ausbau', 'AUSBAU', 'Schiffsbau und Verteidigungssysteme.', 'ausbau'),

  mod('ausbau.schild', 'SCHILD', 'Fortschrittliche Schildsysteme.', 'ausbau', 'ausbau', 'ausbau.modules', []),
  mod('ausbau.cargo', 'CARGO', 'Frachtsysteme.', 'ausbau', 'ausbau', 'ausbau.modules', []),
  mod('ausbau.mining', 'MINING', 'Abbausysteme.', 'ausbau', 'ausbau', 'ausbau.modules', []),

  leaf('ausbau.schild.str', 'STÄRKE', 'Erhöhte Schildstärke.', 'ausbau.schild', 'ausbau', 'ausbau.schild.leaves', 'shield_strength', 0.15),
  leaf('ausbau.schild.regen', 'REGENERATION', 'Schnellere Schildregeneration.', 'ausbau.schild', 'ausbau', 'ausbau.schild.leaves', 'shield_regen', 0.20),
  leaf('ausbau.schild.eff', 'EFFIZIENZ', 'Reduzierter Schild-Energieverbrauch.', 'ausbau.schild', 'ausbau', 'ausbau.schild.leaves', 'shield_efficiency', 0.15),
  spec('ausbau.schild.deflektor', 'DEFLEKTOR', 'Kinetische Ablenkung. Bonus gegen Projektile.', 'ausbau.schild', 'ausbau', 'ausbau.schild.specs', []),
  spec('ausbau.schild.energy', 'ENERGIESCHILD', 'Energiebarriere. Bonus gegen Energiewaffen.', 'ausbau.schild', 'ausbau', 'ausbau.schild.specs', []),

  leaf('ausbau.cargo.cap', 'KAPAZITÄT', 'Erhöhte Frachtkapazität.', 'ausbau.cargo', 'ausbau', 'ausbau.cargo.leaves', 'cargo_capacity', 0.15),
  leaf('ausbau.cargo.weight', 'GEWICHT', 'Reduziertes Frachtgewicht.', 'ausbau.cargo', 'ausbau', 'ausbau.cargo.leaves', 'cargo_weight', 0.15),
  leaf('ausbau.cargo.prot', 'SCHUTZ', 'Frachtschutz bei Kampf.', 'ausbau.cargo', 'ausbau', 'ausbau.cargo.leaves', 'cargo_protection', 0.20),
  spec('ausbau.cargo.smuggler', 'SCHMUGGLERFACH', 'Versteckter Frachtraum.', 'ausbau.cargo', 'ausbau', 'ausbau.cargo.specs', []),
  spec('ausbau.cargo.bulk', 'MASSENFRACHTER', 'Maximale Kapazität.', 'ausbau.cargo', 'ausbau', 'ausbau.cargo.specs', []),

  leaf('ausbau.mining.yield', 'AUSBEUTE', 'Erhöhte Mining-Ausbeute.', 'ausbau.mining', 'ausbau', 'ausbau.mining.leaves', 'mining_yield', 0.15),
  leaf('ausbau.mining.speed', 'GESCHWINDIGKEIT', 'Schnellerer Abbau.', 'ausbau.mining', 'ausbau', 'ausbau.mining.leaves', 'mining_speed', 0.20),
  leaf('ausbau.mining.range', 'REICHWEITE', 'Erhöhte Mining-Reichweite.', 'ausbau.mining', 'ausbau', 'ausbau.mining.leaves', 'mining_range', 0.15),
  spec('ausbau.mining.deep', 'TIEFBOHRER', 'Seltene Ressourcen. Kristall-Bonus.', 'ausbau.mining', 'ausbau', 'ausbau.mining.specs', []),
  spec('ausbau.mining.strip', 'STRIP-MINER', 'Massenabbau. Erz-Bonus.', 'ausbau.mining', 'ausbau', 'ausbau.mining.specs', []),

  // --- AUSBAU spec-leaves (18) ---
  leaf('ausbau.schild.deflektor.str', 'STÄRKE', 'Deflektor-Stärke.', 'ausbau.schild.deflektor', 'ausbau', 'ausbau.schild.deflektor.leaves', 'shield_strength', 0.15),
  leaf('ausbau.schild.deflektor.regen', 'REGENERATION', 'Deflektor-Regen.', 'ausbau.schild.deflektor', 'ausbau', 'ausbau.schild.deflektor.leaves', 'shield_regen', 0.20),
  leaf('ausbau.schild.deflektor.eff', 'EFFIZIENZ', 'Deflektor-Effizienz.', 'ausbau.schild.deflektor', 'ausbau', 'ausbau.schild.deflektor.leaves', 'shield_efficiency', 0.15),
  leaf('ausbau.schild.energy.str', 'STÄRKE', 'Energieschild-Stärke.', 'ausbau.schild.energy', 'ausbau', 'ausbau.schild.energy.leaves', 'shield_strength', 0.15),
  leaf('ausbau.schild.energy.regen', 'REGENERATION', 'Energieschild-Regen.', 'ausbau.schild.energy', 'ausbau', 'ausbau.schild.energy.leaves', 'shield_regen', 0.20),
  leaf('ausbau.schild.energy.eff', 'EFFIZIENZ', 'Energieschild-Effizienz.', 'ausbau.schild.energy', 'ausbau', 'ausbau.schild.energy.leaves', 'shield_efficiency', 0.15),
  leaf('ausbau.cargo.smuggler.cap', 'KAPAZITÄT', 'Schmugglerfach-Kapazität.', 'ausbau.cargo.smuggler', 'ausbau', 'ausbau.cargo.smuggler.leaves', 'cargo_capacity', 0.15),
  leaf('ausbau.cargo.smuggler.weight', 'GEWICHT', 'Schmugglerfach-Gewicht.', 'ausbau.cargo.smuggler', 'ausbau', 'ausbau.cargo.smuggler.leaves', 'cargo_weight', 0.15),
  leaf('ausbau.cargo.smuggler.prot', 'SCHUTZ', 'Schmugglerfach-Schutz.', 'ausbau.cargo.smuggler', 'ausbau', 'ausbau.cargo.smuggler.leaves', 'cargo_protection', 0.20),
  leaf('ausbau.cargo.bulk.cap', 'KAPAZITÄT', 'Massenfrachter-Kapazität.', 'ausbau.cargo.bulk', 'ausbau', 'ausbau.cargo.bulk.leaves', 'cargo_capacity', 0.15),
  leaf('ausbau.cargo.bulk.weight', 'GEWICHT', 'Massenfrachter-Gewicht.', 'ausbau.cargo.bulk', 'ausbau', 'ausbau.cargo.bulk.leaves', 'cargo_weight', 0.15),
  leaf('ausbau.cargo.bulk.prot', 'SCHUTZ', 'Massenfrachter-Schutz.', 'ausbau.cargo.bulk', 'ausbau', 'ausbau.cargo.bulk.leaves', 'cargo_protection', 0.20),
  leaf('ausbau.mining.deep.yield', 'AUSBEUTE', 'Tiefbohrer-Ausbeute.', 'ausbau.mining.deep', 'ausbau', 'ausbau.mining.deep.leaves', 'mining_yield', 0.15),
  leaf('ausbau.mining.deep.speed', 'GESCHWINDIGKEIT', 'Tiefbohrer-Speed.', 'ausbau.mining.deep', 'ausbau', 'ausbau.mining.deep.leaves', 'mining_speed', 0.20),
  leaf('ausbau.mining.deep.range', 'REICHWEITE', 'Tiefbohrer-Reichweite.', 'ausbau.mining.deep', 'ausbau', 'ausbau.mining.deep.leaves', 'mining_range', 0.15),
  leaf('ausbau.mining.strip.yield', 'AUSBEUTE', 'Strip-Miner-Ausbeute.', 'ausbau.mining.strip', 'ausbau', 'ausbau.mining.strip.leaves', 'mining_yield', 0.15),
  leaf('ausbau.mining.strip.speed', 'GESCHWINDIGKEIT', 'Strip-Miner-Speed.', 'ausbau.mining.strip', 'ausbau', 'ausbau.mining.strip.leaves', 'mining_speed', 0.20),
  leaf('ausbau.mining.strip.range', 'REICHWEITE', 'Strip-Miner-Reichweite.', 'ausbau.mining.strip', 'ausbau', 'ausbau.mining.strip.leaves', 'mining_range', 0.15),

  // ===== INTEL =====
  branch('intel', 'INTEL', 'Aufklärung und Informationsgewinnung.', 'intel'),

  mod('intel.scanner', 'SCANNER', 'Sektoranalyse und Entdeckung.', 'intel', 'intel', 'intel.modules', []),
  mod('intel.sensor', 'SENSOR', 'Echtzeiterfassung und Ortung.', 'intel', 'intel', 'intel.modules', []),
  mod('intel.labor', 'LABOR', 'Forschungseinrichtung.', 'intel', 'intel', 'intel.modules', []),

  leaf('intel.scanner.range', 'REICHWEITE', 'Erhöhte Scan-Reichweite.', 'intel.scanner', 'intel', 'intel.scanner.leaves', 'scan_range', 0.20),
  leaf('intel.scanner.detail', 'DETAILGRAD', 'Bessere Scan-Details.', 'intel.scanner', 'intel', 'intel.scanner.leaves', 'scan_detail', 0.15),
  leaf('intel.scanner.speed', 'SCANZEIT', 'Schnellere Scans.', 'intel.scanner', 'intel', 'intel.scanner.leaves', 'scan_speed', 0.20),
  spec('intel.scanner.deep', 'DEEP-SCANNER', 'Fernreichweiten-Scanner.', 'intel.scanner', 'intel', 'intel.scanner.specs', []),
  spec('intel.scanner.bio', 'BIO-SCANNER', 'Anomalien- und Lebenserkennung.', 'intel.scanner', 'intel', 'intel.scanner.specs', []),

  leaf('intel.sensor.prec', 'PRÄZISION', 'Erhöhte Sensorpräzision.', 'intel.sensor', 'intel', 'intel.sensor.leaves', 'sensor_precision', 0.15),
  leaf('intel.sensor.stealth', 'TARNENTDECKUNG', 'Erkennung getarnter Objekte.', 'intel.sensor', 'intel', 'intel.sensor.leaves', 'sensor_stealth', 0.20),
  leaf('intel.sensor.range', 'REICHWEITE', 'Erhöhte Sensor-Reichweite.', 'intel.sensor', 'intel', 'intel.sensor.leaves', 'sensor_range', 0.15),
  spec('intel.sensor.taktik', 'TAKTIK-ARRAY', 'Kampfinformationssystem.', 'intel.sensor', 'intel', 'intel.sensor.specs', []),
  spec('intel.sensor.survey', 'SURVEY-SONDE', 'Ressourcen-Kartierung.', 'intel.sensor', 'intel', 'intel.sensor.specs', []),

  leaf('intel.labor.rate', 'WISSEN-RATE', 'Erhöhte Wissen-Generierung.', 'intel.labor', 'intel', 'intel.labor.leaves', 'lab_wissen_rate', 0.20),
  leaf('intel.labor.eff', 'EFFIZIENZ', 'Labor-Effizienz.', 'intel.labor', 'intel', 'intel.labor.leaves', 'lab_efficiency', 0.15),
  leaf('intel.labor.cap', 'KAPAZITÄT', 'Labor-Kapazität.', 'intel.labor', 'intel', 'intel.labor.leaves', 'lab_capacity', 0.15),
  spec('intel.labor.forschung', 'FORSCHUNGSLAB', 'Wissen-Boost.', 'intel.labor', 'intel', 'intel.labor.specs', []),
  spec('intel.labor.analyse', 'ANALYSE-LAB', 'Artefakt-Analyse.', 'intel.labor', 'intel', 'intel.labor.specs', []),

  // --- INTEL spec-leaves (18) ---
  leaf('intel.scanner.deep.range', 'REICHWEITE', 'Deep-Scanner-Reichweite.', 'intel.scanner.deep', 'intel', 'intel.scanner.deep.leaves', 'scan_range', 0.20),
  leaf('intel.scanner.deep.detail', 'DETAILGRAD', 'Deep-Scanner-Details.', 'intel.scanner.deep', 'intel', 'intel.scanner.deep.leaves', 'scan_detail', 0.15),
  leaf('intel.scanner.deep.speed', 'SCANZEIT', 'Deep-Scanner-Speed.', 'intel.scanner.deep', 'intel', 'intel.scanner.deep.leaves', 'scan_speed', 0.20),
  leaf('intel.scanner.bio.range', 'REICHWEITE', 'Bio-Scanner-Reichweite.', 'intel.scanner.bio', 'intel', 'intel.scanner.bio.leaves', 'scan_range', 0.20),
  leaf('intel.scanner.bio.detail', 'DETAILGRAD', 'Bio-Scanner-Details.', 'intel.scanner.bio', 'intel', 'intel.scanner.bio.leaves', 'scan_detail', 0.15),
  leaf('intel.scanner.bio.speed', 'SCANZEIT', 'Bio-Scanner-Speed.', 'intel.scanner.bio', 'intel', 'intel.scanner.bio.leaves', 'scan_speed', 0.20),
  leaf('intel.sensor.taktik.prec', 'PRÄZISION', 'Taktik-Array-Präzision.', 'intel.sensor.taktik', 'intel', 'intel.sensor.taktik.leaves', 'sensor_precision', 0.15),
  leaf('intel.sensor.taktik.stealth', 'TARNENTDECKUNG', 'Taktik-Array-Tarnerkennung.', 'intel.sensor.taktik', 'intel', 'intel.sensor.taktik.leaves', 'sensor_stealth', 0.20),
  leaf('intel.sensor.taktik.range', 'REICHWEITE', 'Taktik-Array-Reichweite.', 'intel.sensor.taktik', 'intel', 'intel.sensor.taktik.leaves', 'sensor_range', 0.15),
  leaf('intel.sensor.survey.prec', 'PRÄZISION', 'Survey-Sonde-Präzision.', 'intel.sensor.survey', 'intel', 'intel.sensor.survey.leaves', 'sensor_precision', 0.15),
  leaf('intel.sensor.survey.stealth', 'TARNENTDECKUNG', 'Survey-Sonde-Tarnerkennung.', 'intel.sensor.survey', 'intel', 'intel.sensor.survey.leaves', 'sensor_stealth', 0.20),
  leaf('intel.sensor.survey.range', 'REICHWEITE', 'Survey-Sonde-Reichweite.', 'intel.sensor.survey', 'intel', 'intel.sensor.survey.leaves', 'sensor_range', 0.15),
  leaf('intel.labor.forschung.rate', 'WISSEN-RATE', 'Forschungslab-Rate.', 'intel.labor.forschung', 'intel', 'intel.labor.forschung.leaves', 'lab_wissen_rate', 0.20),
  leaf('intel.labor.forschung.eff', 'EFFIZIENZ', 'Forschungslab-Effizienz.', 'intel.labor.forschung', 'intel', 'intel.labor.forschung.leaves', 'lab_efficiency', 0.15),
  leaf('intel.labor.forschung.cap', 'KAPAZITÄT', 'Forschungslab-Kapazität.', 'intel.labor.forschung', 'intel', 'intel.labor.forschung.leaves', 'lab_capacity', 0.15),
  leaf('intel.labor.analyse.rate', 'WISSEN-RATE', 'Analyse-Lab-Rate.', 'intel.labor.analyse', 'intel', 'intel.labor.analyse.leaves', 'lab_wissen_rate', 0.20),
  leaf('intel.labor.analyse.eff', 'EFFIZIENZ', 'Analyse-Lab-Effizienz.', 'intel.labor.analyse', 'intel', 'intel.labor.analyse.leaves', 'lab_efficiency', 0.15),
  leaf('intel.labor.analyse.cap', 'KAPAZITÄT', 'Analyse-Lab-Kapazität.', 'intel.labor.analyse', 'intel', 'intel.labor.analyse.leaves', 'lab_capacity', 0.15),

  // ===== EXPLORER =====
  branch('explorer', 'EXPLORER', 'Erkundung und Mobilität.', 'explorer'),

  mod('explorer.antrieb', 'ANTRIEB', 'Fortbewegungssysteme.', 'explorer', 'explorer', 'explorer.modules', []),
  mod('explorer.treibstoff', 'TREIBSTOFF', 'Energieversorgung.', 'explorer', 'explorer', 'explorer.modules', []),
  mod('explorer.nav', 'NAVIGATION', 'Wegfindung und Kartierung.', 'explorer', 'explorer', 'explorer.modules', []),

  leaf('explorer.antrieb.ap', 'AP-EFFIZIENZ', 'Reduzierter AP-Verbrauch.', 'explorer.antrieb', 'explorer', 'explorer.antrieb.leaves', 'drive_ap_efficiency', 0.15),
  leaf('explorer.antrieb.speed', 'GESCHWINDIGKEIT', 'Erhöhte Reisegeschwindigkeit.', 'explorer.antrieb', 'explorer', 'explorer.antrieb.leaves', 'drive_speed', 0.20),
  leaf('explorer.antrieb.jump', 'SPRUNGREICHWEITE', 'Größere Sprungdistanz.', 'explorer.antrieb', 'explorer', 'explorer.antrieb.leaves', 'drive_jump_range', 0.15),
  spec('explorer.antrieb.warp', 'WARP-CORE', 'Weite Sprünge.', 'explorer.antrieb', 'explorer', 'explorer.antrieb.specs', []),
  spec('explorer.antrieb.ion', 'IONEN-ANTRIEB', 'AP-Effizienz.', 'explorer.antrieb', 'explorer', 'explorer.antrieb.specs', []),

  leaf('explorer.treibstoff.cap', 'TANKGRÖSSE', 'Erhöhte Treibstoffkapazität.', 'explorer.treibstoff', 'explorer', 'explorer.treibstoff.leaves', 'fuel_capacity', 0.20),
  leaf('explorer.treibstoff.cons', 'VERBRAUCH', 'Reduzierter Treibstoffverbrauch.', 'explorer.treibstoff', 'explorer', 'explorer.treibstoff.leaves', 'fuel_consumption', 0.15),
  leaf('explorer.treibstoff.regen', 'REGENERATION', 'Passive Treibstoff-Regeneration.', 'explorer.treibstoff', 'explorer', 'explorer.treibstoff.leaves', 'fuel_regen', 0.10),
  spec('explorer.treibstoff.processor', 'FUEL-PROZESSOR', 'Erz → Treibstoff Konvertierung.', 'explorer.treibstoff', 'explorer', 'explorer.treibstoff.specs', []),
  spec('explorer.treibstoff.solar', 'SOLAR-KOLLEKTOR', 'Passive Treibstoff-Regeneration.', 'explorer.treibstoff', 'explorer', 'explorer.treibstoff.specs', []),

  leaf('explorer.nav.autopilot', 'AUTOPILOT', 'Erhöhte Autopilot-Reichweite.', 'explorer.nav', 'explorer', 'explorer.nav.leaves', 'nav_autopilot', 0.20),
  leaf('explorer.nav.route', 'ROUTEN', 'Effizientere Routenberechnung.', 'explorer.nav', 'explorer', 'explorer.nav.leaves', 'nav_route_efficiency', 0.15),
  leaf('explorer.nav.discovery', 'ENTDECKUNG', 'Höhere Entdeckungsrate.', 'explorer.nav', 'explorer', 'explorer.nav.leaves', 'nav_discovery', 0.15),
  spec('explorer.nav.pathfinder', 'PATHFINDER-AI', 'Optimale Routen.', 'explorer.nav', 'explorer', 'explorer.nav.specs', []),
  spec('explorer.nav.kartograph', 'KARTOGRAPH', 'Sektoren-Aufdeckung.', 'explorer.nav', 'explorer', 'explorer.nav.specs', []),

  // --- EXPLORER spec-leaves (18) ---
  leaf('explorer.antrieb.warp.ap', 'AP-EFFIZIENZ', 'Warp-AP-Effizienz.', 'explorer.antrieb.warp', 'explorer', 'explorer.antrieb.warp.leaves', 'drive_ap_efficiency', 0.15),
  leaf('explorer.antrieb.warp.speed', 'GESCHWINDIGKEIT', 'Warp-Geschwindigkeit.', 'explorer.antrieb.warp', 'explorer', 'explorer.antrieb.warp.leaves', 'drive_speed', 0.20),
  leaf('explorer.antrieb.warp.jump', 'SPRUNGREICHWEITE', 'Warp-Sprungreichweite.', 'explorer.antrieb.warp', 'explorer', 'explorer.antrieb.warp.leaves', 'drive_jump_range', 0.15),
  leaf('explorer.antrieb.ion.ap', 'AP-EFFIZIENZ', 'Ionen-AP-Effizienz.', 'explorer.antrieb.ion', 'explorer', 'explorer.antrieb.ion.leaves', 'drive_ap_efficiency', 0.15),
  leaf('explorer.antrieb.ion.speed', 'GESCHWINDIGKEIT', 'Ionen-Geschwindigkeit.', 'explorer.antrieb.ion', 'explorer', 'explorer.antrieb.ion.leaves', 'drive_speed', 0.20),
  leaf('explorer.antrieb.ion.jump', 'SPRUNGREICHWEITE', 'Ionen-Sprungreichweite.', 'explorer.antrieb.ion', 'explorer', 'explorer.antrieb.ion.leaves', 'drive_jump_range', 0.15),
  leaf('explorer.treibstoff.processor.cap', 'TANKGRÖSSE', 'Fuel-Prozessor-Tank.', 'explorer.treibstoff.processor', 'explorer', 'explorer.treibstoff.processor.leaves', 'fuel_capacity', 0.20),
  leaf('explorer.treibstoff.processor.cons', 'VERBRAUCH', 'Fuel-Prozessor-Verbrauch.', 'explorer.treibstoff.processor', 'explorer', 'explorer.treibstoff.processor.leaves', 'fuel_consumption', 0.15),
  leaf('explorer.treibstoff.processor.regen', 'REGENERATION', 'Fuel-Prozessor-Regen.', 'explorer.treibstoff.processor', 'explorer', 'explorer.treibstoff.processor.leaves', 'fuel_regen', 0.10),
  leaf('explorer.treibstoff.solar.cap', 'TANKGRÖSSE', 'Solar-Tank.', 'explorer.treibstoff.solar', 'explorer', 'explorer.treibstoff.solar.leaves', 'fuel_capacity', 0.20),
  leaf('explorer.treibstoff.solar.cons', 'VERBRAUCH', 'Solar-Verbrauch.', 'explorer.treibstoff.solar', 'explorer', 'explorer.treibstoff.solar.leaves', 'fuel_consumption', 0.15),
  leaf('explorer.treibstoff.solar.regen', 'REGENERATION', 'Solar-Regen.', 'explorer.treibstoff.solar', 'explorer', 'explorer.treibstoff.solar.leaves', 'fuel_regen', 0.10),
  leaf('explorer.nav.pathfinder.autopilot', 'AUTOPILOT', 'Pathfinder-Autopilot.', 'explorer.nav.pathfinder', 'explorer', 'explorer.nav.pathfinder.leaves', 'nav_autopilot', 0.20),
  leaf('explorer.nav.pathfinder.route', 'ROUTEN', 'Pathfinder-Routen.', 'explorer.nav.pathfinder', 'explorer', 'explorer.nav.pathfinder.leaves', 'nav_route_efficiency', 0.15),
  leaf('explorer.nav.pathfinder.discovery', 'ENTDECKUNG', 'Pathfinder-Entdeckung.', 'explorer.nav.pathfinder', 'explorer', 'explorer.nav.pathfinder.leaves', 'nav_discovery', 0.15),
  leaf('explorer.nav.kartograph.autopilot', 'AUTOPILOT', 'Kartograph-Autopilot.', 'explorer.nav.kartograph', 'explorer', 'explorer.nav.kartograph.leaves', 'nav_autopilot', 0.20),
  leaf('explorer.nav.kartograph.route', 'ROUTEN', 'Kartograph-Routen.', 'explorer.nav.kartograph', 'explorer', 'explorer.nav.kartograph.leaves', 'nav_route_efficiency', 0.15),
  leaf('explorer.nav.kartograph.discovery', 'ENTDECKUNG', 'Kartograph-Entdeckung.', 'explorer.nav.kartograph', 'explorer', 'explorer.nav.kartograph.leaves', 'nav_discovery', 0.15),
];

// Build lookup map and compute leaf depths from parent
export const TECH_TREE_NODES: Record<string, TechTreeNode> = {};
for (const node of nodes) {
  TECH_TREE_NODES[node.id] = node;
}
// Fix leaf depths: derive from parent depth + 1
for (const node of Object.values(TECH_TREE_NODES)) {
  if (node.depth === -1 && node.parent) {
    const parent = TECH_TREE_NODES[node.parent];
    node.depth = parent ? parent.depth + 1 : 2;
  }
}

export const TECH_TREE_NODE_COUNT = nodes.length;

export function getTechNode(id: string): TechTreeNode | undefined {
  return TECH_TREE_NODES[id];
}

export function getChildNodes(parentId: string): TechTreeNode[] {
  return Object.values(TECH_TREE_NODES).filter((n) => n.parent === parentId);
}

export function getExclusiveGroup(nodeId: string): string | undefined {
  return TECH_TREE_NODES[nodeId]?.exclusiveGroup;
}

export const BRANCH_COLORS: Record<TechBranch, string> = {
  kampf: '#ff4444',
  ausbau: '#4488ff',
  intel: '#bb44ff',
  explorer: '#44ff88',
};

/** Global cost escalation: +5% per researched node */
export const GLOBAL_COST_ESCALATION = 0.05;

/** Reset cooldown in milliseconds (24 hours) */
export const TECH_TREE_RESET_COOLDOWN_MS = 24 * 60 * 60 * 1000;
