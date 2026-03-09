import type { Client } from 'colyseus';
import type { ServiceContext } from './ServiceContext.js';
import type { AuthPayload } from '../../auth.js';
import type {
  CompleteScanEventMessage,
  ResourceType,
  SectorEnvironment,
} from '@void-sector/shared';

import { calculateCurrentAP } from '../../engine/ap.js';
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
  addToCargo,
  getPlayerCargo,
  getPlayerReputation,
  addBlueprint,
  getPlayerFaction,
  getFactionMembersByPlayerIds,
} from '../../db/queries.js';
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

    client.send('localScanResult', {
      resources,
      hiddenSignatures: result.hiddenSignatures,
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
          this.ctx.sendToPlayer(memberId, 'scanResult', { sectors: foggedSectors, apRemaining: 0, sharedByScan: true });
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
      await addToCargo(auth.userId, 'artefact' as ResourceType, eventData.rewardArtefact);
      const updatedCargo = await getPlayerCargo(auth.userId);
      client.send('cargoUpdate', updatedCargo);
      client.send('logEntry', 'ARTEFAKT GEFUNDEN! +1 \u273B');
    }

    // Handle blueprint find
    if (event.event_type === 'blueprint_find') {
      const moduleId = (event.data as Record<string, unknown>)?.moduleId as string;
      if (moduleId) {
        await addBlueprint(auth.userId, moduleId);
        client.send('blueprintFound', {
          moduleId,
          moduleName: MODULES[moduleId]?.name ?? moduleId,
        });
        client.send('logEntry', `BLAUPAUSE GEFUNDEN: ${MODULES[moduleId]?.name ?? moduleId}`);
      }
    }

    client.send('logEntry', `Event abgeschlossen! +${eventData.rewardCredits ?? 0} CR`);
  }
}
