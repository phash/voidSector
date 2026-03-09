import type { Client } from 'colyseus';
import type { ServiceContext } from './ServiceContext.js';
import type { AuthPayload } from '../../auth.js';
import type { CompleteScanEventMessage, SectorEnvironment } from '@void-sector/shared';

import { calculateCurrentAP } from '../../engine/ap.js';
import { addAcepXpForPlayer, getAcepXpSummary } from '../../engine/acepXpService.js';
import { calculateTraits } from '../../engine/traitCalculator.js';
import { getPersonalityComment } from '../../engine/personalityMessages.js';
import { validateLocalScan, validateAreaScan } from '../../engine/commands.js';
import { checkScanEvent } from '../../engine/scanEvents.js';
import { generateSector } from '../../engine/worldgen.js';
import { initCombatV2 } from '../../engine/combatV2.js';
import { createPirateEncounter } from '../../engine/commands.js';
import { getAPState, saveAPState } from './RedisAPStore.js';
import {
  getSector,
  saveSector,
  addDiscoveriesBatch,
  getSectorsInRange,
  addDiscovery,
  insertScanEvent,
  getPlayerScanEvents,
  completeScanEvent,
  getPlayerCredits,
  addCredits,
  getPlayerReputation,
  getPlayerFaction,
  getFactionMembersByPlayerIds,
  hasScannedRuin,
  insertAncientRuinScan,
  getActiveShip,
  recordAlienEncounter,
  addTypedArtefact,
} from '../../db/queries.js';
import { addToInventory, getInventoryItem, getCargoState } from '../../engine/inventoryService.js';
import { resolveAncientRuinScan } from '../../engine/ancientRuinsService.js';
import { getWrecksInSector, salvageWreckModule } from '../../engine/permadeathService.js';
import { WORLD_SEED } from '@void-sector/shared';
import type { SectorData } from '@void-sector/shared';
import { AP_COSTS_LOCAL_SCAN, FEATURE_COMBAT_V2, MODULES } from '@void-sector/shared';

export class ScanService {
  constructor(private ctx: ServiceContext) {}

  async handleLocalScan(client: Client): Promise<void> {
    if (!this.ctx.checkRate(client.sessionId, 'localScan', 1000)) {
      client.send('error', { code: 'RATE_LIMIT', message: 'Too fast' });
      return;
    }
    const auth = client.auth as AuthPayload;
    const ap = await getAPState(auth.userId);
    const currentAP = calculateCurrentAP(ap, Date.now());
    const scannerLevel = this.ctx.getShipForClient(client.sessionId).scannerLevel;

    const result = validateLocalScan(currentAP, AP_COSTS_LOCAL_SCAN, scannerLevel);
    if (!result.valid) {
      client.send('error', { code: 'LOCAL_SCAN_FAIL', message: result.error! });
      return;
    }

    await saveAPState(auth.userId, result.newAP!);

    const sectorData = await getSector(
      this.ctx._px(client.sessionId),
      this.ctx._py(client.sessionId),
    );
    const resources = sectorData?.resources ?? { ore: 0, gas: 0, crystal: 0 };

    // Check for ship wrecks in this sector (Permadeath POIs)
    const px = this.ctx._px(client.sessionId);
    const py = this.ctx._py(client.sessionId);
    const wrecks = await getWrecksInSector(this.ctx.quadrantX, this.ctx.quadrantY, px, py);

    client.send('localScanResult', {
      resources,
      hiddenSignatures: result.hiddenSignatures,
      wrecks: wrecks.map((w) => ({
        id: w.id,
        playerName: w.playerName,
        radarIconData: w.radarIconData,
        lastLogEntry: w.lastLogEntry,
        hasSalvage: w.salvageableModules.length > 0,
      })),
    });
    client.send('apUpdate', result.newAP!);

    // Phase 4: Check for scan events (pass environment for pirate frequency scaling)
    const env = (
      this.ctx._pst(client.sessionId) === 'nebula' ? 'nebula' : 'empty'
    ) as SectorEnvironment;
    await this.checkAndEmitScanEvents(client, [
      { x: this.ctx._px(client.sessionId), y: this.ctx._py(client.sessionId), environment: env },
    ]);

    // Check quest progress for scan quests at current sector
    await this.ctx.checkQuestProgress(client, auth.userId, 'scan', {
      sectorX: this.ctx._px(client.sessionId),
      sectorY: this.ctx._py(client.sessionId),
    });

    // ACEP: INTEL-XP + personality comment for scanning (spec: +3 per scan)
    addAcepXpForPlayer(auth.userId, 'intel', 3).catch(() => {});
    this._emitPersonalityComment(client, auth.userId, 'scan').catch(() => {});

    // Ancient ruin scan: reveal lore fragment + artefact chance
    if (sectorData?.contents?.includes('ruin')) {
      const px = this.ctx._px(client.sessionId);
      const py = this.ctx._py(client.sessionId);
      const alreadyScanned = await hasScannedRuin(auth.userId, px, py);
      if (!alreadyScanned) {
        const scanSeed = (Date.now() ^ auth.userId.charCodeAt(0)) >>> 0;
        const ruinResult = resolveAncientRuinScan(px, py, WORLD_SEED, scanSeed);
        await insertAncientRuinScan(
          auth.userId,
          px,
          py,
          ruinResult.fragmentIndex,
          ruinResult.ruinLevel,
          ruinResult.artefactFound,
        );
        if (ruinResult.artefactFound) {
          await addToInventory(auth.userId, 'resource', 'artefact', 1);
          client.send('cargoUpdate', await getCargoState(auth.userId));
        }
        client.send('ancientRuinScan', {
          fragmentIndex: ruinResult.fragmentIndex,
          fragmentText: ruinResult.fragmentText,
          ruinLevel: ruinResult.ruinLevel,
          artefactFound: ruinResult.artefactFound,
          sectorX: px,
          sectorY: py,
        });
        client.send('logEntry', `ANCIENT RUIN — ${ruinResult.fragmentText.split('\n')[0]}`);
        // ACEP: EXPLORER-XP for ancient ruin scan (spec: +15)
        addAcepXpForPlayer(auth.userId, 'explorer', 15).catch(() => {});
        this._emitPersonalityComment(client, auth.userId, 'scan_ruin').catch(() => {});
      }
    }
  }

  async handleAreaScan(client: Client): Promise<void> {
    if (!this.ctx.checkRate(client.sessionId, 'areaScan', 1000)) {
      client.send('error', { code: 'RATE_LIMIT', message: 'Too fast' });
      return;
    }
    const auth = client.auth as AuthPayload;
    const ap = await getAPState(auth.userId);
    const currentAP = calculateCurrentAP(ap, Date.now());
    const scannerLevel = this.ctx.getShipForClient(client.sessionId).scannerLevel;

    const scanResult = validateAreaScan(currentAP, scannerLevel);
    if (!scanResult.valid) {
      client.send('error', { code: 'SCAN_FAIL', message: scanResult.error! });
      return;
    }

    await saveAPState(auth.userId, scanResult.newAP!);

    // Apply faction scan radius bonus
    const bonuses = await this.ctx.getPlayerBonuses(auth.userId);
    const radius = scanResult.radius + bonuses.scanRadiusBonus;
    const sectorX = this.ctx._px(client.sessionId);
    const sectorY = this.ctx._py(client.sessionId);

    // Nebula interference: area scan is blocked inside nebula sectors
    const currentSectorData = await getSector(sectorX, sectorY);
    if (currentSectorData?.type === 'nebula') {
      client.send('error', {
        code: 'SCAN_FAIL',
        message: 'Nebula interference: only local scan available in nebula sectors',
      });
      return;
    }

    // Batch load existing sectors
    const existingSectors = await getSectorsInRange(sectorX, sectorY, radius);
    const existingMap = new Map(existingSectors.map((s) => [`${s.x}:${s.y}`, s]));

    const sectors: SectorData[] = [];
    const newSectors: SectorData[] = [];
    const allCoords: { x: number; y: number }[] = [];

    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        const tx = sectorX + dx;
        const ty = sectorY + dy;
        const key = `${tx}:${ty}`;
        let sector = existingMap.get(key);
        if (!sector) {
          sector = generateSector(tx, ty, auth.userId);
          newSectors.push(sector);
        }
        sectors.push(sector);
        allCoords.push({ x: tx, y: ty });
      }
    }

    // Batch save new sectors and discoveries
    for (const s of newSectors) await saveSector(s);
    await addDiscoveriesBatch(auth.userId, allCoords);

    // Phase 4: Check for scan events in scanned sectors (skip pirate ambush — remote scan can't trigger physical encounters)
    await this.checkAndEmitScanEvents(
      client,
      sectors.map((s) => ({ x: s.x, y: s.y, environment: s.environment })),
      false,
    );

    // Nebula fog: hide contents of nebula sectors when scanned from outside
    const foggedSectors = sectors.map((s) => {
      if (s.environment === 'nebula') {
        return {
          ...s,
          resources: { ore: 0, gas: 0, crystal: 0 },
          contents: [],
          type: 'nebula' as const,
          metadata: {},
        };
      }
      return s;
    });

    client.send('scanResult', { sectors: foggedSectors, apRemaining: scanResult.newAP!.current });

    // #159: Share scan results with online faction members
    try {
      const playerFaction = await getPlayerFaction(auth.userId);
      if (playerFaction) {
        const memberIds = await getFactionMembersByPlayerIds(playerFaction.id);
        for (const memberId of memberIds) {
          if (memberId === auth.userId) continue;
          this.ctx.sendToPlayer(memberId, 'scanResult', {
            sectors: foggedSectors,
            apRemaining: 0,
            sharedByScan: true,
          });
        }
      }
    } catch {
      // Faction sharing failure must not break scan
    }

    // Phase 4: Check quest progress for scan quests
    for (const s of sectors) {
      await this.ctx.checkQuestProgress(client, auth.userId, 'scan', {
        sectorX: s.x,
        sectorY: s.y,
      });
    }

    // ACEP: INTEL-XP for area scan (discovering new sectors) (spec: +3)
    if (newSectors.length > 0) {
      addAcepXpForPlayer(auth.userId, 'intel', 3).catch(() => {});
    }
  }

  async checkAndEmitScanEvents(
    client: Client,
    scannedSectors: { x: number; y: number; environment?: SectorEnvironment }[],
    includeImmediateEvents = true,
  ): Promise<void> {
    const auth = client.auth as AuthPayload;
    for (const sector of scannedSectors) {
      const eventResult = checkScanEvent(sector.x, sector.y, sector.environment ?? 'empty');
      if (!eventResult.hasEvent || !eventResult.eventType) continue;

      if (eventResult.isImmediate && eventResult.eventType === 'pirate_ambush') {
        if (!includeImmediateEvents) continue;
        const pirateLevel = (eventResult.data?.pirateLevel as number) ?? 1;
        const pirateRep = await getPlayerReputation(auth.userId, 'pirates');
        const encounter = createPirateEncounter(pirateLevel, sector.x, sector.y, pirateRep);
        client.send('pirateAmbush', { encounter, sectorX: sector.x, sectorY: sector.y });
        // Init combat v2 state
        if (FEATURE_COMBAT_V2) {
          const combatShip = this.ctx.getShipForClient(client.sessionId);
          const combatState = initCombatV2(encounter, combatShip);
          this.ctx.combatV2States.set(client.sessionId, combatState);
          client.send('combatV2Init', { state: combatState });
        }
        client.send('logEntry', `WARNUNG: Piraten-Hinterhalt bei (${sector.x}, ${sector.y})!`);
      } else {
        const eventId = await insertScanEvent(
          auth.userId,
          sector.x,
          sector.y,
          eventResult.eventType,
          eventResult.data ?? {},
        );
        if (eventId) {
          client.send('scanEventDiscovered', {
            event: {
              id: eventId,
              eventType: eventResult.eventType,
              sectorX: sector.x,
              sectorY: sector.y,
              status: 'discovered',
              data: eventResult.data ?? {},
              createdAt: Date.now(),
            },
          });
          const eventNames: Record<string, string> = {
            distress_signal: 'Notsignal',
            anomaly_reading: 'Anomalie',
            artifact_find: 'Artefakt-Signal',
          };
          client.send(
            'logEntry',
            `${eventNames[eventResult.eventType] ?? 'Event'} entdeckt bei (${sector.x}, ${sector.y})`,
          );
        }
      }
    }
  }

  async handleCompleteScanEvent(client: Client, data: CompleteScanEventMessage): Promise<void> {
    const auth = client.auth as AuthPayload;
    const events = await getPlayerScanEvents(auth.userId, 'discovered');
    const event = events.find((e) => e.id === data.eventId);

    if (!event) {
      client.send('logEntry', 'Event nicht gefunden.');
      return;
    }

    const completed = await completeScanEvent(data.eventId, auth.userId);
    if (!completed) return;

    // Apply rewards based on event type
    const eventData = event.data as Record<string, number>;
    if (eventData.rewardCredits) {
      await addCredits(auth.userId, eventData.rewardCredits);
      client.send('creditsUpdate', { credits: await getPlayerCredits(auth.userId) });
    }
    if (eventData.rewardXp) {
      await this.ctx.applyXpGain(auth.userId, eventData.rewardXp, client);
    }
    if (eventData.rewardRep) {
      const repFaction =
        event.event_type === 'anomaly_reading'
          ? 'scientists'
          : event.event_type === 'artifact_find'
            ? 'ancients'
            : 'traders';
      await this.ctx.applyReputationChange(
        auth.userId,
        repFaction as import('@void-sector/shared').NpcFactionId,
        eventData.rewardRep,
        client,
      );
    }
    if (eventData.rewardArtefact && eventData.rewardArtefact > 0) {
      await addToInventory(auth.userId, 'resource', 'artefact', eventData.rewardArtefact);
      const scanEventData = event.data as Record<string, unknown>;
      if (scanEventData.rewardArtefactType) {
        await addTypedArtefact(
          auth.userId,
          scanEventData.rewardArtefactType as string,
          eventData.rewardArtefact,
        );
      }
      const updatedCargo = await getCargoState(auth.userId);
      client.send('cargoUpdate', updatedCargo);
      client.send('logEntry', 'ARTEFAKT GEFUNDEN! +1 \u273B');
    }

    // Handle blueprint find — stored in unified inventory (type='blueprint')
    if (event.event_type === 'blueprint_find') {
      const moduleId = (event.data as Record<string, unknown>)?.moduleId as string;
      if (moduleId) {
        const existing = await getInventoryItem(auth.userId, 'blueprint', moduleId);
        if (existing === 0) {
          await addToInventory(auth.userId, 'blueprint', moduleId, 1);
          client.send('blueprintFound', {
            moduleId,
            moduleName: MODULES[moduleId]?.name ?? moduleId,
          });
          client.send('logEntry', `BLAUPAUSE GEFUNDEN: ${MODULES[moduleId]?.name ?? moduleId}`);
        } else {
          client.send(
            'logEntry',
            `BLAUPAUSE BEREITS BEKANNT: ${MODULES[moduleId]?.name ?? moduleId}`,
          );
        }
      }
    }

    // Build completion summary
    const rewards: string[] = [];
    if (eventData.rewardCredits) rewards.push(`+${eventData.rewardCredits} CR`);
    if (eventData.rewardXp) rewards.push(`+${eventData.rewardXp} XP`);
    if (eventData.rewardArtefact && eventData.rewardArtefact > 0) rewards.push('+1 ARTEFAKT');
    const rewardSummary = rewards.length > 0 ? rewards.join(', ') : 'REP +';
    client.send('logEntry', `Event abgeschlossen! ${rewardSummary}`);

    // Remove event from client state
    client.send('scanEventCompleted', { eventId: data.eventId });

    // ACEP: INTEL-XP for completing a scan event / anomaly analysis (spec: ~+8, throttled to +3)
    addAcepXpForPlayer(auth.userId, 'intel', 3).catch(() => {});
  }

  /** Salvage a module from a ship wreck. */
  async handleSalvageWreck(client: Client, data: { wreckId: string }): Promise<void> {
    const auth = client.auth as AuthPayload;
    if (!data.wreckId) {
      client.send('error', { code: 'SALVAGE_FAIL', message: 'Wrack-ID fehlt' });
      return;
    }
    const module = await salvageWreckModule(data.wreckId, auth.userId);
    if (!module) {
      client.send('salvageResult', {
        success: false,
        message: 'Keine bergbaren Module in diesem Wrack',
      });
      return;
    }
    const moduleName = MODULES[module]?.name ?? module;
    client.send('salvageResult', { success: true, module, moduleName });
    client.send('logEntry', `WRACK GEPLÜNDERT: Modul "${moduleName}" geborgen.`);
    // Record as salvage encounter for Scrapper access tracking
    recordAlienEncounter({
      playerId: auth.userId,
      factionId: 'scrappers',
      encounterType: 'salvage',
      sectorX: this.ctx._px(client.sessionId),
      sectorY: this.ctx._py(client.sessionId),
      quadrantX: this.ctx.quadrantX,
      quadrantY: this.ctx.quadrantY,
      encounterData: { wreckId: data.wreckId, module },
      repBefore: 0,
      repAfter: 0,
    }).catch(() => {});
  }

  /** Emit a personality comment to the client's event log (fire-and-forget). */
  private async _emitPersonalityComment(
    client: Client,
    playerId: string,
    context: Parameters<typeof getPersonalityComment>[1],
  ): Promise<void> {
    const ship = await getActiveShip(playerId);
    if (!ship) return;
    const xp = await getAcepXpSummary(ship.id);
    const traits = calculateTraits(xp);
    const comment = getPersonalityComment(traits, context);
    if (comment) {
      client.send('logEntry', comment);
    }
  }
}
