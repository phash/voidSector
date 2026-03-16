export interface ResearchNode {
  id: string;
  name: string;
  branch: string;
  description: string;
  effect: Record<string, number>;
  wissenCost: number;
  prerequisiteModuleId: string;
  prerequisiteResearchId?: string;
}

export const RESEARCH_DEFINITIONS: ResearchNode[] = [
  // ============================================================
  // Branch: engines
  // ============================================================
  {
    id: 'jump_enhancer',
    name: 'Jump Enhancer',
    branch: 'engines',
    description: '+20% Jump-Distanz',
    effect: { jumpDistanceBonus: 0.2 },
    wissenCost: 10,
    prerequisiteModuleId: 'ion_drive_mk1',
  },
  {
    id: 'jump_speed',
    name: 'Jump Speed',
    branch: 'engines',
    description: '-20% ms pro Sektor (schnellere Reise)',
    effect: { jumpSpeedReduction: 0.2 },
    wissenCost: 10,
    prerequisiteModuleId: 'ion_drive_mk2',
  },
  {
    id: 'efficiency',
    name: 'Efficiency',
    branch: 'engines',
    description: '-20% Fuel-Verbrauch pro Sektor',
    effect: { fuelConsumptionReduction: 0.2 },
    wissenCost: 10,
    prerequisiteModuleId: 'ion_drive_mk3',
  },
  {
    id: 'recharge_enhancer',
    name: 'Recharge Enhancer',
    branch: 'engines',
    description: '+50% Hyperdrive Recharge-Rate',
    effect: { hyperdriveRechargeMultiplier: 1.5 },
    wissenCost: 10,
    prerequisiteModuleId: 'proto_am_drive',
  },
  {
    id: 'overcharge',
    name: 'OverCharge',
    branch: 'engines',
    description: 'Einmal-Boost: doppelte Recharge für 60s, danach 30s Cooldown',
    effect: { overchargeMultiplier: 2, overchargeDuration: 60, overchargeCooldown: 30 },
    wissenCost: 10,
    prerequisiteModuleId: 'proto_am_drive',
    prerequisiteResearchId: 'recharge_enhancer',
  },
  {
    id: 'improbability_jump',
    name: 'Improbability Jump',
    branch: 'engines',
    description: 'Chance auf Zufalls-Teleport bei Hyperjump (5%, bringt +500 Wissen)',
    effect: { improbabilityChance: 0.05, improbabilityWissenBonus: 500 },
    wissenCost: 10,
    prerequisiteModuleId: 'am_drive_mk1',
  },
  {
    id: 'probability_jump',
    name: 'Probability Jump',
    branch: 'engines',
    description: 'Improbability Jump wird steuerbar (Ziel wählbar)',
    effect: { probabilityJumpControlled: 1 },
    wissenCost: 10,
    prerequisiteModuleId: 'am_drive_mk1',
    prerequisiteResearchId: 'improbability_jump',
  },
  {
    id: 'rescue_system_engine',
    name: 'Rescue System',
    branch: 'engines',
    description: '+1 Safe-Slot für Überlebende',
    effect: { safeSlotBonus: 1 },
    wissenCost: 10,
    prerequisiteModuleId: 'am_drive_mk1',
    prerequisiteResearchId: 'improbability_jump',
  },
  {
    id: 'precaution_system_engine',
    name: 'Precaution System',
    branch: 'engines',
    description: '-30% Fuel-Verlust bei Notlandung',
    effect: { emergencyFuelLossReduction: 0.3 },
    wissenCost: 10,
    prerequisiteModuleId: 'am_drive_mk1',
    prerequisiteResearchId: 'probability_jump',
  },

  // ============================================================
  // Branch: generators
  // ============================================================
  {
    id: 'capacity_enhancer',
    name: 'Capacity Enhancer',
    branch: 'generators',
    description: '+20% max Energy-Kapazität',
    effect: { energyCapacityBonus: 0.2 },
    wissenCost: 10,
    prerequisiteModuleId: 'fusion_cell_mk1',
  },
  {
    id: 'refuel',
    name: 'Refuel',
    branch: 'generators',
    description: '-20% Tankkosten an Stationen',
    effect: { refuelCostReduction: 0.2 },
    wissenCost: 10,
    prerequisiteModuleId: 'fusion_cell_mk2',
  },
  {
    id: 'gen_efficiency',
    name: 'Efficiency',
    branch: 'generators',
    description: '-15% Energy-Verbrauch aller Module',
    effect: { energyConsumptionReduction: 0.15 },
    wissenCost: 10,
    prerequisiteModuleId: 'fusion_cell_mk3',
  },
  {
    id: 'refuel_enhancer',
    name: 'Refuel Enhancer',
    branch: 'generators',
    description: 'Auto-Refuel bei Station (kein manuelles Tanken nötig)',
    effect: { autoRefuel: 1 },
    wissenCost: 10,
    prerequisiteModuleId: 'fusion_cell_mk4',
  },
  {
    id: 'gen_overcharge',
    name: 'OverCharge',
    branch: 'generators',
    description: 'Einmal-Boost: +100% Energy für 30s, danach 60s kein Regen',
    effect: { genOverchargeMultiplier: 2, genOverchargeDuration: 30, genOverchargeCooldown: 60 },
    wissenCost: 10,
    prerequisiteModuleId: 'fusion_cell_mk4',
    prerequisiteResearchId: 'refuel_enhancer',
  },
  {
    id: 'energy_shield',
    name: 'Energy Shield',
    branch: 'generators',
    description: 'Energy kann als Notfall-Schild verwendet werden (1 Energy = 1 Shield)',
    effect: { energyToShieldRatio: 1 },
    wissenCost: 10,
    prerequisiteModuleId: 'am_generator',
  },
  {
    id: 'explosion_dampener',
    name: 'Explosion Dampener',
    branch: 'generators',
    description: '-25% Splash-Schaden von Missiles',
    effect: { missileSplashDamageReduction: 0.25 },
    wissenCost: 10,
    prerequisiteModuleId: 'am_generator',
    prerequisiteResearchId: 'energy_shield',
  },
  {
    id: 'rescue_system_gen',
    name: 'Rescue System',
    branch: 'generators',
    description: '+1 Safe-Slot für Überlebende',
    effect: { safeSlotBonus: 1 },
    wissenCost: 10,
    prerequisiteModuleId: 'am_generator',
    prerequisiteResearchId: 'energy_shield',
  },
  // ============================================================
  // Branch: mining
  // ============================================================
  {
    id: 'yield_enhancer',
    name: 'Yield Enhancer',
    branch: 'mining',
    description: '+20% Ausbeute pro Mining-Zyklus',
    effect: { miningYieldBonus: 0.2 },
    wissenCost: 10,
    prerequisiteModuleId: 'mining_laser_mk1',
  },
  {
    id: 'deep_core_drill',
    name: 'Deep Core Drill',
    branch: 'mining',
    description: '+30% Bonus auf Gas und Crystal in Nebula/Asteroid-Sektoren',
    effect: { deepCoreDrillBonus: 0.3 },
    wissenCost: 10,
    prerequisiteModuleId: 'mining_laser_mk2',
  },
  {
    id: 'ore_refinery',
    name: 'Ore Refinery',
    branch: 'mining',
    description: '-10% Ressourcenverlust beim Verkauf (bessere Reinheit)',
    effect: { oreRefineryLossReduction: 0.1 },
    wissenCost: 10,
    prerequisiteModuleId: 'mining_laser_mk3',
  },
  {
    id: 'multi_spectrum_mining',
    name: 'Multi-Spectrum Mining',
    branch: 'mining',
    description: 'Kann 2 Ressourcentypen gleichzeitig abbauen',
    effect: { multiResourceMining: 2 },
    wissenCost: 10,
    prerequisiteModuleId: 'mining_laser_mk4',
  },

  // ============================================================
  // Branch: cargo
  // ============================================================
  {
    id: 'stack_compression',
    name: 'Stack Compression',
    branch: 'cargo',
    description: '+10% Frachtraum-Kapazität',
    effect: { cargoCapacityBonus: 0.1 },
    wissenCost: 10,
    prerequisiteModuleId: 'cargo_bay_mk1',
  },
  {
    id: 'hazmat_container',
    name: 'Hazmat Container',
    branch: 'cargo',
    description: '+2 Artefakt-Slots',
    effect: { artefactSlotBonus: 2 },
    wissenCost: 10,
    prerequisiteModuleId: 'cargo_bay_mk2',
  },
  {
    id: 'sorting_system',
    name: 'Sorting System',
    branch: 'cargo',
    description: '-20% Handelszeit an Stationen',
    effect: { tradeTimeReduction: 0.2 },
    wissenCost: 10,
    prerequisiteModuleId: 'cargo_bay_mk3',
  },
  {
    id: 'void_storage',
    name: 'Void Storage',
    branch: 'cargo',
    description: '+50% Frachtraum-Kapazität (nur mit T5 Cargo)',
    effect: { cargoCapacityBonus: 0.5 },
    wissenCost: 10,
    prerequisiteModuleId: 'cargo_bay_mk4',
  },

  // ============================================================
  // Branch: scanner
  // ============================================================
  {
    id: 'signal_filter',
    name: 'Signal Filter',
    branch: 'scanner',
    description: '+1 Scan-Radius bei Local Scan',
    effect: { localScanRadiusBonus: 1 },
    wissenCost: 10,
    prerequisiteModuleId: 'scanner_mk1',
  },
  {
    id: 'deep_scan',
    name: 'Deep Scan',
    branch: 'scanner',
    description: 'Zeigt Ressourcen-Qualität (hoch/mittel/niedrig) im Scan-Ergebnis',
    effect: { resourceQualityVisible: 1 },
    wissenCost: 10,
    prerequisiteModuleId: 'scanner_mk2',
  },
  {
    id: 'anomaly_detector',
    name: 'Anomaly Detector',
    branch: 'scanner',
    description: 'Zeigt Anomalien und Hidden Signatures im Area-Scan',
    effect: { anomalyDetection: 1 },
    wissenCost: 10,
    prerequisiteModuleId: 'scanner_mk3',
  },
  {
    id: 'wissen_amplifier',
    name: 'Wissen Amplifier',
    branch: 'scanner',
    description: '+50% Wissen pro Scan',
    effect: { wissenPerScanMultiplier: 1.5 },
    wissenCost: 10,
    prerequisiteModuleId: 'scanner_mk4',
  },

  // ============================================================
  // Branch: repair
  // ============================================================
  {
    id: 'emergency_patch',
    name: 'Emergency Patch',
    branch: 'repair',
    description: 'Einmal-Reparatur: +50 HP sofort (Cooldown 5min)',
    effect: { emergencyPatchHp: 50, emergencyPatchCooldown: 300 },
    wissenCost: 10,
    prerequisiteModuleId: 'repair_drone_mk1',
  },
  {
    id: 'hull_reinforcement',
    name: 'Hull Reinforcement',
    branch: 'repair',
    description: '+10% max HP für alle Module',
    effect: { moduleMaxHpBonus: 0.1 },
    wissenCost: 10,
    prerequisiteModuleId: 'repair_drone_mk2',
  },
  {
    id: 'auto_repair',
    name: 'Auto-Repair',
    branch: 'repair',
    description: 'Passive Regen: 1 HP/Tick außerhalb von Kampf',
    effect: { passiveHpRegenPerTick: 1 },
    wissenCost: 10,
    prerequisiteModuleId: 'repair_drone_mk3',
  },
  {
    id: 'battle_medic',
    name: 'Battle Medic',
    branch: 'repair',
    description: 'Reparatur-Drohne kann auch im Kampf reparieren',
    effect: { combatRepairEnabled: 1 },
    wissenCost: 10,
    prerequisiteModuleId: 'repair_drone_mk4',
  },

  // ============================================================
  // Branch: armor
  // ============================================================
  {
    id: 'ablative_coating',
    name: 'Ablative Coating',
    branch: 'armor',
    description: '+5% generelle Schadensreduktion',
    effect: { damageReduction: 0.05 },
    wissenCost: 10,
    prerequisiteModuleId: 'armor_plating_mk1',
  },
  {
    id: 'reactive_armor',
    name: 'Reactive Armor',
    branch: 'armor',
    description: 'Reflektiert 10% des eingehenden Schadens',
    effect: { damageReflection: 0.1 },
    wissenCost: 10,
    prerequisiteModuleId: 'armor_plating_mk2',
  },
  {
    id: 'hull_integrity',
    name: 'Hull Integrity',
    branch: 'armor',
    description: '+20% Strukturpunkte (Basis-HP des Schiffs)',
    effect: { baseHpBonus: 0.2 },
    wissenCost: 10,
    prerequisiteModuleId: 'armor_plating_mk3',
  },
  {
    id: 'kinetic_dampener',
    name: 'Kinetic Dampener',
    branch: 'armor',
    description: '-25% Schaden durch Kinetic-Waffen (Railguns)',
    effect: { kineticDamageReduction: 0.25 },
    wissenCost: 10,
    prerequisiteModuleId: 'armor_plating_mk4',
  },

  // ============================================================
  // Branch: shields
  // ============================================================
  {
    id: 'quick_charge',
    name: 'Quick Charge',
    branch: 'shields',
    description: '+50% Schild-Regen-Speed',
    effect: { shieldRegenMultiplier: 1.5 },
    wissenCost: 10,
    prerequisiteModuleId: 'schild_gen_mk1',
  },
  {
    id: 'adaptive_frequency',
    name: 'Adaptive Frequency',
    branch: 'shields',
    description: '-15% Schaden durch Energy-Waffen (Laser)',
    effect: { energyWeaponDamageReduction: 0.15 },
    wissenCost: 10,
    prerequisiteModuleId: 'schild_gen_mk2',
  },
  {
    id: 'shield_harmonics',
    name: 'Shield Harmonics',
    branch: 'shields',
    description: '+20% Schild-Kapazität',
    effect: { shieldCapacityBonus: 0.2 },
    wissenCost: 10,
    prerequisiteModuleId: 'schild_gen_mk3',
  },
  {
    id: 'overload_burst',
    name: 'Overload Burst',
    branch: 'shields',
    description: 'Einmal-Skill: Schild → Schaden (1:1, Schild wird aufgebraucht)',
    effect: { shieldToDamageRatio: 1 },
    wissenCost: 10,
    prerequisiteModuleId: 'am_shield_mk1',
  },

  // ============================================================
  // Branch: weapon_energy
  // ============================================================
  {
    id: 'beam_focus',
    name: 'Beam Focus',
    branch: 'weapon_energy',
    description: '+10% Accuracy für Energy-Waffen',
    effect: { energyWeaponAccuracyBonus: 0.1 },
    wissenCost: 10,
    prerequisiteModuleId: 'puls_laser_mk1',
  },
  {
    id: 'overcharge_lens',
    name: 'Overcharge Lens',
    branch: 'weapon_energy',
    description: '+20% DMG, +10 Energy-Kosten pro Schuss',
    effect: { energyWeaponDamageBonus: 0.2, energyWeaponExtraEnergyCost: 10 },
    wissenCost: 10,
    prerequisiteModuleId: 'puls_laser_mk2',
  },
  {
    id: 'rapid_fire',
    name: 'Rapid Fire',
    branch: 'weapon_energy',
    description: '2 Hits pro Runde (halber Schaden pro Hit)',
    effect: { energyWeaponHitsPerRound: 2 },
    wissenCost: 10,
    prerequisiteModuleId: 'puls_laser_mk3',
  },

  // ============================================================
  // Branch: weapon_kinetic
  // ============================================================
  {
    id: 'piercing_rounds',
    name: 'Piercing Rounds',
    branch: 'weapon_kinetic',
    description: '+10% Piercing für alle Kinetic-Waffen',
    effect: { kineticPiercingBonus: 0.1 },
    wissenCost: 10,
    prerequisiteModuleId: 'rail_kanone_mk1',
  },
  {
    id: 'armor_shredder',
    name: 'Armor Shredder',
    branch: 'weapon_kinetic',
    description: 'Trifft: reduziert Ziel-Armor um 20% für 3 Runden',
    effect: { armorShredderReduction: 0.2, armorShredderDuration: 3 },
    wissenCost: 10,
    prerequisiteModuleId: 'rail_kanone_mk2',
  },

  // ============================================================
  // Branch: weapon_missile
  // ============================================================
  {
    id: 'tracking_enhancement',
    name: 'Tracking Enhancement',
    branch: 'weapon_missile',
    description: '+20% Trefferchance vs ECM',
    effect: { missileTrackingVsEcmBonus: 0.2 },
    wissenCost: 10,
    prerequisiteModuleId: 'raketen_pod_mk1',
  },
  {
    id: 'cluster_warhead',
    name: 'Cluster Warhead',
    branch: 'weapon_missile',
    description: 'Splash-Schaden: trifft auch ein zufälliges Nebenmodul',
    effect: { clusterSplashEnabled: 1 },
    wissenCost: 10,
    prerequisiteModuleId: 'raketen_pod_mk2',
  },

  // ============================================================
  // Branch: defense_pv
  // ============================================================
  {
    id: 'flak_field',
    name: 'Flak Field',
    branch: 'defense_pv',
    description: '+15% Missile-Abwehrchance',
    effect: { missileInterceptBonus: 0.15 },
    wissenCost: 10,
    prerequisiteModuleId: 'pv_mk2',
  },
  {
    id: 'missile_jammer',
    name: 'Missile Jammer',
    branch: 'defense_pv',
    description: '50% Chance: eingehende Missile verfehlt komplett',
    effect: { missileJammerChance: 0.5 },
    wissenCost: 10,
    prerequisiteModuleId: 'pv_mk3',
  },

  // ============================================================
  // Branch: defense_ecm
  // ============================================================
  {
    id: 'ghost_signal',
    name: 'Ghost Signal',
    branch: 'defense_ecm',
    description: '+10% Dodge-Chance',
    effect: { dodgeChanceBonus: 0.1 },
    wissenCost: 10,
    prerequisiteModuleId: 'ecm_suite_1',
  },
  {
    id: 'sensor_overload',
    name: 'Sensor Overload',
    branch: 'defense_ecm',
    description: 'Einmal-Skill: Gegner verliert 1 Kampfrunde',
    effect: { sensorOverloadRoundsLost: 1 },
    wissenCost: 10,
    prerequisiteModuleId: 'ecm_suite_2',
  },
];
