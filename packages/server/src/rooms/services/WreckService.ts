import type { Client } from 'colyseus';
import type { ServiceContext } from './ServiceContext.js';
import type { AuthPayload } from '../../auth.js';
import { v4 as uuidv4 } from 'uuid';
import {
  WRECK_SALVAGE_DURATION_MS,
  WRECK_DIFFICULTY_FAIL_DELTA,
  WRECK_DIFFICULTY_SUCCESS_DELTA,
  WRECK_DIFFICULTY_MAX,
  WRECK_DIFFICULTY_MIN,
  WRECK_SALVAGE_AP_COST,
  WRECK_INVESTIGATE_AP_COST,
  WRECK_SLATE_CAP,
  WRECK_SLATE_JUMPGATE_HUMANITY_TAX,
} from '@void-sector/shared';
import type { WreckSize, WreckItem } from '@void-sector/shared';
import {
  getWreckAtSector,
  getWreckById,
  updateWreckStatus,
  updateWreckItem,
  updateWreckModifier,
  insertWreckSlateMetadata,
  getWreckSlateMetadata,
  deleteWreckSlateMetadata,
} from '../../db/wreckQueries.js';
import {
  getSalvageSession,
  saveSalvageSession,
  clearSalvageSession,
} from './RedisAPStore.js';
import {
  addToInventory,
  removeFromInventory,
  canAddResource,
  getCargoState,
} from '../../engine/inventoryService.js';
import {
  getAcepXpSummary,
  getAcepEffects,
  addAcepXpForPlayer,
} from '../../engine/acepXpService.js';
import { calcSalvageChance } from '../../engine/wreckSpawnEngine.js';
import {
  getInventory,
  addDiscovery,
  getSector,
  saveSector,
  insertJumpGate,
  contributeHumanityRep,
} from '../../db/queries.js';
import { generateSector } from '../../engine/worldgen.js';
import { logger } from '../../utils/logger.js';

export class WreckService {
  private salvageTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(private ctx: ServiceContext) {}

  clearAllTimers(): void {
    for (const t of this.salvageTimers.values()) clearTimeout(t);
    this.salvageTimers.clear();
  }

  async handleInvestigate(client: Client, _data: unknown): Promise<void> {
    if (!this.ctx.checkRate(client.sessionId, 'investigate', 1000)) {
      client.send('actionError', { code: 'RATE_LIMIT', message: 'Too fast' });
      return;
    }
    const auth = client.auth as AuthPayload;
    const sectorX = this.ctx._px(client.sessionId);
    const sectorY = this.ctx._py(client.sessionId);

    const wreck = await getWreckAtSector(sectorX, sectorY);
    if (!wreck) {
      client.send('actionError', { code: 'NO_WRECK', message: 'Kein Wrack in diesem Sektor' });
      return;
    }
    if (wreck.status === 'exhausted') {
      client.send('actionError', { code: 'WRECK_GONE', message: 'Wrack bereits geborgen' });
      return;
    }

    const apOk = await this.ctx.deductAP(auth.userId, WRECK_INVESTIGATE_AP_COST);
    if (!apOk) {
      client.send('actionError', { code: 'NO_AP', message: 'Zu wenig AP' });
      return;
    }

    if (wreck.status === 'intact') {
      await updateWreckStatus(wreck.id, 'investigated');
    }

    client.send('wreckInvestigated', {
      wreckId: wreck.id,
      items: wreck.items,
      size: wreck.size,
      tier: wreck.tier,
    });
  }

  async handleStartSalvage(
    client: Client,
    data: { itemIndex: number },
  ): Promise<void> {
    if (!this.ctx.checkRate(client.sessionId, 'salvage', 1000)) {
      client.send('actionError', { code: 'RATE_LIMIT', message: 'Too fast' });
      return;
    }
    const auth = client.auth as AuthPayload;
    const sectorX = this.ctx._px(client.sessionId);
    const sectorY = this.ctx._py(client.sessionId);

    const wreck = await getWreckAtSector(sectorX, sectorY);
    if (!wreck || wreck.status === 'exhausted') {
      client.send('actionError', { code: 'WRECK_GONE', message: 'Wrack nicht verfügbar' });
      return;
    }

    const { itemIndex } = data;
    const item = (wreck.items as WreckItem[])[itemIndex];
    if (!item) {
      client.send('actionError', { code: 'INVALID_ITEM', message: 'Item nicht gefunden' });
      return;
    }
    if (item.salvaged) {
      client.send('actionError', { code: 'ITEM_DONE', message: 'Item bereits versucht' });
      return;
    }

    if (item.itemType === 'resource') {
      const hasSpace = await canAddResource(auth.userId, item.quantity);
      if (!hasSpace) {
        client.send('actionError', { code: 'CARGO_FULL', message: 'Frachtraum voll' });
        return;
      }
    }
    if (item.itemType === 'data_slate') {
      const inv = await getInventory(auth.userId);
      const slates = (inv as any[]).filter((i: any) => i.itemType === 'data_slate').length;
      if (slates >= WRECK_SLATE_CAP) {
        client.send('actionError', { code: 'SLATE_CAP', message: 'Max. 5 Slates im Inventar' });
        return;
      }
    }

    const apOk = await this.ctx.deductAP(auth.userId, WRECK_SALVAGE_AP_COST);
    if (!apOk) {
      client.send('actionError', { code: 'NO_AP', message: 'Zu wenig AP' });
      return;
    }

    const shipXp = await getAcepXpSummary(auth.userId);
    const effects = getAcepEffects(shipXp);
    const chance = calcSalvageChance(
      item.baseDifficulty,
      wreck.difficulty_modifier,
      shipXp.explorer,
      effects.helionDecoderEnabled,
    );

    const duration = WRECK_SALVAGE_DURATION_MS[wreck.size as WreckSize];

    await saveSalvageSession(auth.userId, {
      wreckId: wreck.id,
      itemIndex,
      startedAt: Date.now(),
      duration,
      resolveChance: chance,
    });

    client.send('salvageStarted', {
      wreckId: wreck.id,
      itemIndex,
      duration,
      chance,
    });

    const existing = this.salvageTimers.get(auth.userId);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(async () => {
      this.salvageTimers.delete(auth.userId);
      try {
        await this.resolveSalvage(client, auth.userId, wreck.id, itemIndex);
      } catch (err) {
        logger.error({ err }, 'resolveSalvage failed');
      }
    }, duration);
    this.salvageTimers.set(auth.userId, timer);
  }

  private async resolveSalvage(
    client: Client,
    playerId: string,
    wreckId: string,
    itemIndex: number,
  ): Promise<void> {
    const session = await getSalvageSession(playerId);
    if (!session || session.wreckId !== wreckId || session.itemIndex !== itemIndex) return;

    await clearSalvageSession(playerId);

    const success = Math.random() < session.resolveChance;
    const w = await getWreckById(wreckId);
    if (!w) return;
    const item = (w.items as WreckItem[])[itemIndex];
    if (!item) return;

    const delta = success ? WRECK_DIFFICULTY_SUCCESS_DELTA : WRECK_DIFFICULTY_FAIL_DELTA;
    const newModifier = Math.max(
      WRECK_DIFFICULTY_MIN,
      Math.min(WRECK_DIFFICULTY_MAX, w.difficulty_modifier + delta),
    );
    await updateWreckModifier(wreckId, newModifier);
    await updateWreckItem(wreckId, itemIndex, true);

    let cargoUpdate = undefined;

    if (success) {
      addAcepXpForPlayer(playerId, 'explorer', 2).catch(() => {});

      if (item.itemType === 'data_slate') {
        const slateId = uuidv4();
        const targetX = 50 + Math.floor(Math.random() * 200);
        const targetY = 50 + Math.floor(Math.random() * 200);
        const hasJumpgate = w.tier >= 5 && Math.random() < 0.3;
        await insertWreckSlateMetadata({
          id: slateId,
          playerId,
          sectorX: targetX,
          sectorY: targetY,
          sectorType: 'unknown',
          hasJumpgate,
          wreckTier: w.tier,
        });
        await addToInventory(playerId, 'data_slate', slateId, 1);
      } else {
        await addToInventory(playerId, item.itemType, item.itemId, item.quantity);
      }

      cargoUpdate = await getCargoState(playerId);
    }

    client.send('salvageResult', {
      success,
      item,
      cargoUpdate,
      newModifier,
    });

    const updatedWreck = await getWreckById(wreckId);
    const updatedItems = updatedWreck?.items as WreckItem[] | undefined;

    if (updatedItems?.every((i) => i.salvaged)) {
      await updateWreckStatus(wreckId, 'exhausted');
      client.send('wreckExhausted', {
        wreckId,
        sectorX: w.sector_x,
        sectorY: w.sector_y,
      });
    }
  }

  async handleCancelSalvage(client: Client): Promise<void> {
    const auth = client.auth as AuthPayload;
    const timer = this.salvageTimers.get(auth.userId);
    if (timer) {
      clearTimeout(timer);
      this.salvageTimers.delete(auth.userId);
    }
    await clearSalvageSession(auth.userId);
  }

  async handleConsumeSlate(client: Client, data: { slateId: string }): Promise<void> {
    if (!this.ctx.checkRate(client.sessionId, 'consumeSlate', 2000)) {
      client.send('actionError', { code: 'RATE_LIMIT', message: 'Too fast' });
      return;
    }
    const auth = client.auth as AuthPayload;
    const meta = await getWreckSlateMetadata(data.slateId);
    if (!meta) {
      client.send('actionError', { code: 'SLATE_NOT_FOUND', message: 'Slate nicht gefunden' });
      return;
    }
    if (meta.playerId !== auth.userId) {
      client.send('actionError', { code: 'NOT_OWNER', message: 'Nicht dein Slate' });
      return;
    }

    await removeFromInventory(auth.userId, 'data_slate', data.slateId, 1);
    await deleteWreckSlateMetadata(data.slateId);

    let sector = await getSector(meta.sectorX, meta.sectorY);
    if (!sector) {
      sector = generateSector(meta.sectorX, meta.sectorY, null, false);
      await saveSector(sector);
    }
    await addDiscovery(auth.userId, meta.sectorX, meta.sectorY);

    client.send('slateConsumed', {
      slateId: data.slateId,
      sectorX: meta.sectorX,
      sectorY: meta.sectorY,
      sectorType: meta.sectorType,
    });
    client.send('logEntry', `DATA SLATE KONSUMIERT — Sektor (${meta.sectorX}, ${meta.sectorY}) aufgedeckt`);
  }

  async handleFeedSlateToGate(client: Client, data: { slateId: string }): Promise<void> {
    if (!this.ctx.checkRate(client.sessionId, 'feedSlate', 2000)) {
      client.send('actionError', { code: 'RATE_LIMIT', message: 'Too fast' });
      return;
    }
    const auth = client.auth as AuthPayload;
    const sectorX = this.ctx._px(client.sessionId);
    const sectorY = this.ctx._py(client.sessionId);

    const sector = await getSector(sectorX, sectorY);
    if (!sector?.jumpgate) {
      client.send('actionError', { code: 'NO_GATE', message: 'Kein Jumpgate in diesem Sektor' });
      return;
    }

    const meta = await getWreckSlateMetadata(data.slateId);
    if (!meta?.hasJumpgate) {
      client.send('actionError', { code: 'NO_JUMPGATE_IN_SLATE', message: 'Slate enthält kein Jumpgate-Sektor' });
      return;
    }
    if (meta.playerId !== auth.userId) {
      client.send('actionError', { code: 'NOT_OWNER', message: 'Nicht dein Slate' });
      return;
    }

    const dist = Math.sqrt((meta.sectorX - sectorX) ** 2 + (meta.sectorY - sectorY) ** 2);
    if (dist > meta.wreckTier * 500) {
      client.send('actionError', { code: 'GATE_OUT_OF_RANGE', message: 'Ziel außerhalb Reichweite' });
      return;
    }

    await removeFromInventory(auth.userId, 'data_slate', data.slateId, 1);
    await deleteWreckSlateMetadata(data.slateId);

    await insertJumpGate({
      id: uuidv4(),
      sectorX,
      sectorY,
      targetX: meta.sectorX,
      targetY: meta.sectorY,
      gateType: 'human',
      requiresCode: false,
      requiresMinigame: false,
      accessCode: null,
    });

    await contributeHumanityRep('human', WRECK_SLATE_JUMPGATE_HUMANITY_TAX);

    client.send('gateConnectionAdded', {
      fromX: sectorX,
      fromY: sectorY,
      toX: meta.sectorX,
      toY: meta.sectorY,
    });
    client.send('logEntry', `JUMPGATE VERBUNDEN — Route zu (${meta.sectorX}, ${meta.sectorY}) hergestellt`);
  }
}
