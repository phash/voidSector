import type { Client } from 'colyseus';
import type { ServiceContext } from './ServiceContext.js';
import type { AuthPayload } from '../../auth.js';
import type { JumpMessage, HyperJumpMessage, ShipStats } from '@void-sector/shared';
import { isInt, rejectGuest, MAX_COORD } from './utils.js';
import { addAcepXpForPlayer } from '../../engine/acepXpService.js';
import { awardWissenAndNotify } from '../../engine/wissenService.js';
import { logger } from '../../utils/logger.js';

import { generateSector } from '../../engine/worldgen.js';
import { calculateCurrentAP } from '../../engine/ap.js';
import { validateJump } from '../../engine/commands.js';
import { checkJumpGate, checkAncientJumpGate, generateGateTarget } from '../../engine/jumpgates.js';
import {
  calculateAutopilotPath,
  calculateAutopilotCosts,
  getNextSegment,
  STEP_INTERVAL_MS,
  STEP_INTERVAL_MIN_MS,
} from '../../engine/autopilot.js';
import { hashCoords, isInBlackHoleCluster } from '../../engine/worldgen.js';
import { findReachableGates } from '../../engine/jumpgateRouting.js';
import { getReputationTier } from '../../engine/commands.js';
import { getStationFaction } from '../../engine/npcgen.js';
import { recordVisit } from '../../engine/npcStationEngine.js';
import { sectorToQuadrant } from '../../engine/quadrantEngine.js';
import { isFrontierQuadrant } from '../../engine/expansionEngine.js';
import {
  getSector,
  saveSector,
  addDiscovery,
  getPlayerCredits,
  deductCredits,
  addCredits,
  playerHasGateCode,
  getJumpGate,
  insertJumpGate,
  isRouteDiscovered,
  saveAutopilotRoute,
  getActiveAutopilotRoute,
  updateAutopilotStep,
  pauseAutopilotRoute,
  cancelAutopilotRoute,
  completeAutopilotRoute,
  hasAnyoneBadge,
  awardBadge,
  getPlayerReputation,
  updatePlayerStationRep,
  getPlayerStationRep,
  addPlayerKnownJumpGate,
  getPlayerJumpGate,
  getAllPlayerGates,
  getAllJumpGateLinks,
  getJumpGateLinks,
  recordNewsEvent,
  getAllQuadrantControls,
} from '../../db/queries.js';
import {
  getAPState,
  saveAPState,
  savePlayerPosition,
  getMiningState,
  getFuelState,
  saveFuelState,
  getPlayerPosition,
  getHyperdriveState,
  setHyperdriveState,
} from './RedisAPStore.js';
import {
  JUMP_NORMAL_AP_COST,
  JUMP_NORMAL_MAX_RANGE,
  AUTOPILOT_STEP_MS,
  HYPERJUMP_PIRATE_FUEL_PENALTY,
  BASE_FUEL_PER_JUMP,
  FUEL_COST_PER_UNIT,
  REP_PRICE_MODIFIERS,
  getFuelRepPriceModifier,
  STATION_REP_VISIT,
  calcHyperjumpAP,
  calcHyperjumpFuel,
  calcHyperjumpFuelV2,
  createHyperdriveState,
  calculateCurrentCharge,
  spendCharge,
  WORLD_SEED,
  BLACK_HOLE_SPAWN_CHANCE,
  BLACK_HOLE_MIN_DISTANCE,
} from '@void-sector/shared';

const SLOW_FLIGHT_INTERVAL_MS = 3000;

export class NavigationService {
  constructor(private ctx: ServiceContext) {}

  async handleMoveSector(
    client: Client,
    data: { sectorX: number; sectorY: number },
  ): Promise<void> {
    if (!this.ctx.checkRate(client.sessionId, 'moveSector', 200)) return;
    const { sectorX, sectorY } = data;
    if (
      !isInt(sectorX) ||
      !isInt(sectorY) ||
      Math.abs(sectorX) > MAX_COORD ||
      Math.abs(sectorY) > MAX_COORD
    ) {
      client.send('error', { code: 'INVALID_INPUT', message: 'Invalid coordinates' });
      return;
    }
    const auth = client.auth as AuthPayload;

    // Load or generate sector
    let sectorData = await getSector(sectorX, sectorY);
    if (!sectorData) {
      {
        const { qx, qy } = sectorToQuadrant(sectorX, sectorY);
        const _controls = await getAllQuadrantControls();
        sectorData = generateSector(sectorX, sectorY, auth.userId, isFrontierQuadrant(qx, qy, _controls));
      }
      await saveSector(sectorData);
    }

    // Update player position
    const player = this.ctx.state.players.get(client.sessionId);
    if (player) {
      player.x = sectorX;
      player.y = sectorY;
    }
    this.ctx.playerSectorData.set(client.sessionId, sectorData);
    await savePlayerPosition(auth.userId, sectorX, sectorY);
    await addDiscovery(auth.userId, sectorX, sectorY);

    // Send sector data to client
    client.send('sectorData', sectorData);

    // Station visit tracking
    if (sectorData.type === 'station') {
      recordVisit(sectorX, sectorY).catch(() => {});
      updatePlayerStationRep(auth.userId, sectorX, sectorY, STATION_REP_VISIT).catch(() => {});
      const ship = this.ctx.getShipForClient(client.sessionId);
      await this.tryAutoRefuel(client, auth, ship);
    }

    // Check for JumpGate at this sector
    await this.detectAndSendJumpGate(client, auth, sectorX, sectorY);

    // Check for player-built JumpGate at this sector
    await this.detectAndSendPlayerGate(client, sectorX, sectorY);

    // Quadrant first-contact detection
    await this.ctx.checkFirstContact(client, auth, sectorX, sectorY);

    awardWissenAndNotify(client, auth.userId, 1);  // +1 per new sector
  }

  /**
   * Detect jumpgate at sector and send info to client.
   * Returns gateInfo object if gate found (for handleJump's jumpResult), or null.
   */
  async detectAndSendJumpGate(
    client: Client,
    auth: AuthPayload,
    sectorX: number,
    sectorY: number,
    returnInfo = false,
  ): Promise<import('@void-sector/shared').JumpGateInfo | null> {
    const isAncient = checkAncientJumpGate(sectorX, sectorY);
    const isNatural = isAncient || checkJumpGate(sectorX, sectorY);

    // Check DB first — admin-created gates exist here even if they don't pass the natural hash check
    let gate = await getJumpGate(sectorX, sectorY);
    if (!gate && !isNatural) return null;
    if (!gate) {
      const gateData = generateGateTarget(sectorX, sectorY, isAncient);
      const gateId = `gate_${sectorX}_${sectorY}`;
      await insertJumpGate({ id: gateId, sectorX, sectorY, ...gateData });
      gate = { id: gateId, sectorX, sectorY, ...gateData };

      // #137: Auto-create return gate for bidirectional gates
      if (gateData.gateType === 'bidirectional') {
        const returnGateId = `gate_${gateData.targetX}_${gateData.targetY}`;
        await insertJumpGate({
          id: returnGateId,
          sectorX: gateData.targetX,
          sectorY: gateData.targetY,
          targetX: sectorX,
          targetY: sectorY,
          gateType: 'bidirectional',
          requiresCode: gateData.requiresCode,
          requiresMinigame: gateData.requiresMinigame,
          accessCode: gateData.accessCode,
        });
      }
    }

    const hasCode = gate.requiresCode ? await playerHasGateCode(auth.userId, gate.id) : true;
    const gateInfo = {
      id: gate.id,
      gateType: gate.gateType,
      requiresCode: gate.requiresCode,
      requiresMinigame: gate.requiresMinigame,
      hasCode,
    };

    // Record discovered jumpgate for map display
    await addPlayerKnownJumpGate(
      auth.userId,
      gate.id,
      sectorX,
      sectorY,
      gate.targetX,
      gate.targetY,
      gate.gateType,
    );

    // For moveSector/onJoin, send directly; for handleJump, return for inclusion in jumpResult
    if (!returnInfo) {
      client.send('jumpGateInfo', gateInfo);
    }

    return gateInfo;
  }

  async handleJump(client: Client, data: JumpMessage): Promise<void> {
    if (!this.ctx.checkRate(client.sessionId, 'jump', 300)) {
      client.send('jumpResult', { success: false, error: 'Too fast' });
      return;
    }
    if (
      !isInt(data.targetX) ||
      !isInt(data.targetY) ||
      Math.abs(data.targetX) > MAX_COORD ||
      Math.abs(data.targetY) > MAX_COORD
    ) {
      logger.warn(
        {
          username: (client.auth as AuthPayload)?.username,
          targetX: data.targetX,
          targetY: data.targetY,
        },
        'handleJump invalid coords',
      );
      client.send('jumpResult', { success: false, error: 'Invalid coordinates' });
      return;
    }
    const auth = client.auth as AuthPayload;
    const { targetX, targetY } = data;

    // Normal jump: 1 AP, 0 fuel, max range 1
    const mining = await getMiningState(auth.userId);
    const ap = await getAPState(auth.userId);
    const currentX = this.ctx.state.players.get(client.sessionId)?.x ?? 0;
    const currentY = this.ctx.state.players.get(client.sessionId)?.y ?? 0;
    const jumpResult = validateJump(
      ap,
      currentX,
      currentY,
      targetX,
      targetY,
      JUMP_NORMAL_MAX_RANGE,
      JUMP_NORMAL_AP_COST,
      mining?.active ?? false,
    );
    if (!jumpResult.valid) {
      client.send('jumpResult', { success: false, error: jumpResult.error });
      return;
    }
    await saveAPState(auth.userId, jumpResult.newAP!);

    const ship = this.ctx.getShipForClient(client.sessionId);
    const currentFuel = await getFuelState(auth.userId);

    // Load or generate target sector
    let targetSector = await getSector(targetX, targetY);
    if (!targetSector) {
      {
        const { qx, qy } = sectorToQuadrant(targetX, targetY);
        const _controls = await getAllQuadrantControls();
        targetSector = generateSector(targetX, targetY, auth.userId, isFrontierQuadrant(qx, qy, _controls));
      }
      await saveSector(targetSector);
    }

    // Block entry to black holes
    if (targetSector.environment === 'black_hole') {
      client.send('jumpResult', {
        success: false,
        error: 'BLACK_HOLE_BLOCKED',
        message: 'Schwarzes Loch erkannt — Sprung abgebrochen',
      });
      // Refund AP (normal jump has no fuel cost)
      await saveAPState(auth.userId, ap);
      return;
    }

    // Record discovery (check first-time before inserting)
    const sectorAlreadyKnown = await isRouteDiscovered(auth.userId, targetX, targetY);
    await addDiscovery(auth.userId, targetX, targetY);

    // ACEP XP: AUSBAU per jump
    addAcepXpForPlayer(auth.userId, 'ausbau', 2).catch(() => {});
    // ACEP XP: EXPLORER for first sector discovery
    if (!sectorAlreadyKnown) {
      addAcepXpForPlayer(auth.userId, 'explorer', 10).catch(() => {});
    }

    // Check for origin badge
    if (targetX === 0 && targetY === 0) {
      const isFirst = !(await hasAnyoneBadge('ORIGIN_FIRST'));
      const badgeType = isFirst ? 'ORIGIN_FIRST' : 'ORIGIN_REACHED';
      const awarded = await awardBadge(auth.userId, badgeType);
      if (awarded) {
        client.send('badgeAwarded', { badgeType });
        if (isFirst) {
          this.ctx.broadcast('announcement', {
            message: `${auth.username} is the FIRST to reach the Origin!`,
            type: 'origin_first',
          });
        }
      }
    }

    // Phase 4: Check quest progress for arrive/fetch/delivery
    await this.ctx.checkQuestProgress(client, auth.userId, 'arrive', {
      sectorX: targetX,
      sectorY: targetY,
    });

    // Phase 5: Check for JumpGate at target sector
    const gateInfo = await this.detectAndSendJumpGate(client, auth, targetX, targetY, true);

    // Check if target is in the same quadrant
    const { qx: curQx, qy: curQy } = sectorToQuadrant(currentX, currentY);
    const { qx: tgtQx, qy: tgtQy } = sectorToQuadrant(targetX, targetY);
    const crossQuadrant = curQx !== tgtQx || curQy !== tgtQy;

    if (!crossQuadrant) {
      // Intra-quadrant: update player position in-place (no room change)
      const player = this.ctx.state.players.get(client.sessionId);
      if (player) {
        player.x = targetX;
        player.y = targetY;
      }
      this.ctx.playerSectorData.set(client.sessionId, targetSector);
      await savePlayerPosition(auth.userId, targetX, targetY);
    }

    client.send('jumpResult', {
      success: true,
      newSector: targetSector,
      apRemaining: jumpResult.newAP!.current,
      fuelRemaining: currentFuel ?? 0,
      gateInfo,
      crossQuadrant,
    });

    // Check for player-built JumpGate at target sector
    await this.detectAndSendPlayerGate(client, targetX, targetY);

    // Phase 5: Check for distress calls in comm range
    await this.ctx.checkAndEmitDistressCalls(client, auth.userId, targetX, targetY);

    // Quadrant first-contact detection
    await this.ctx.checkFirstContact(client, auth, targetX, targetY);

    awardWissenAndNotify(client, auth.userId, 1);  // +1 per new sector

    // Record quadrant discovery news event on cross-quadrant jump
    if (crossQuadrant) {
      recordNewsEvent({
        eventType: 'quadrant_discovery',
        headline: `${auth.username} entdeckte Quadrant ${tgtQx}:${tgtQy}`,
        playerId: auth.userId,
        playerName: auth.username,
        quadrantX: tgtQx,
        quadrantY: tgtQy,
        eventData: { fromQuadrant: { qx: curQx, qy: curQy }, toQuadrant: { qx: tgtQx, qy: tgtQy } },
      }).catch(() => {});
      // ACEP: EXPLORER-XP (+50) for world-first quadrant discovery is handled in WorldService.checkFirstContact
      awardWissenAndNotify(client, auth.userId, 5);  // +5 per quadrant change
    }
  }

  async handleHyperJump(client: Client, data: HyperJumpMessage): Promise<void> {
    const auth = client.auth as AuthPayload;
    logger.info(
      { username: auth.username, targetX: data.targetX, targetY: data.targetY },
      'Hyperjump attempt',
    );
    if (!this.ctx.checkRate(client.sessionId, 'hyperJump', 1000)) {
      client.send('error', { code: 'RATE_LIMIT', message: 'Too fast' });
      return;
    }
    if (
      !isInt(data.targetX) ||
      !isInt(data.targetY) ||
      Math.abs(data.targetX) > MAX_COORD ||
      Math.abs(data.targetY) > MAX_COORD
    ) {
      logger.warn(
        { username: auth.username, targetX: data.targetX, targetY: data.targetY },
        'handleHyperJump invalid coords',
      );
      client.send('error', { code: 'INVALID_INPUT', message: 'Invalid coordinates' });
      return;
    }
    const { targetX, targetY } = data;

    // Reject if already in autopilot
    if (this.ctx.autopilotTimers.has(client.sessionId)) {
      logger.info({ username: auth.username }, 'Hyperjump rejected: autopilot active');
      client.send('error', { code: 'HYPERJUMP_FAIL', message: 'Autopilot already active' });
      return;
    }

    // Validate target is discovered
    const discovered = await isRouteDiscovered(auth.userId, targetX, targetY);
    if (!discovered) {
      logger.info(
        { username: auth.username, targetX, targetY, userId: auth.userId },
        'Hyperjump target not discovered',
      );
      client.send('error', { code: 'HYPERJUMP_FAIL', message: 'Target sector not discovered' });
      return;
    }
    logger.info({ username: auth.username }, 'Hyperjump target discovered, proceeding');

    // Nebula blocking: can't hyperjump into or out of nebula
    const currentX = this.ctx.state.players.get(client.sessionId)?.x ?? 0;
    const currentY = this.ctx.state.players.get(client.sessionId)?.y ?? 0;
    const currentSectorData = await getSector(currentX, currentY);
    if (currentSectorData?.environment === 'nebula') {
      client.send('error', {
        code: 'HYPERJUMP_FAIL',
        message: 'Nebula interference: hyperjump blocked inside nebula',
      });
      return;
    }
    const targetSectorData = await getSector(targetX, targetY);
    if (targetSectorData?.environment === 'nebula') {
      client.send('error', {
        code: 'HYPERJUMP_FAIL',
        message: 'Nebula interference: cannot hyperjump into nebula',
      });
      return;
    }

    // Check mining state (reject if mining is active)
    const mining = await getMiningState(auth.userId);
    if (mining?.active) {
      client.send('error', { code: 'HYPERJUMP_FAIL', message: 'Cannot hyperjump while mining' });
      return;
    }

    // Get current position
    const pos = await getPlayerPosition(auth.userId);
    if (!pos) {
      client.send('error', { code: 'HYPERJUMP_FAIL', message: 'Position unknown' });
      return;
    }
    const dx = targetX - pos.x;
    const dy = targetY - pos.y;
    const distance = Math.abs(dx) + Math.abs(dy);
    if (distance <= 1) {
      client.send('error', {
        code: 'HYPERJUMP_FAIL',
        message: 'Use normal jump for adjacent sectors',
      });
      return;
    }

    // Nebula zones block hyperjump in both directions
    const sourceSector = await getSector(pos.x, pos.y);
    if (sourceSector?.environment === 'nebula') {
      client.send('error', {
        code: 'HYPERJUMP_FAIL',
        message: 'Nebula interference: cannot hyperjump from nebula sector',
      });
      return;
    }
    const targetSectorNebula = await getSector(targetX, targetY);
    if (targetSectorNebula?.environment === 'nebula') {
      client.send('error', {
        code: 'HYPERJUMP_FAIL',
        message: 'Nebula interference: cannot hyperjump into nebula sector',
      });
      return;
    }

    // Black holes block hyperjump in both directions
    if (sourceSector?.environment === 'black_hole') {
      client.send('error', {
        code: 'HYPERJUMP_FAIL',
        message: 'Schwarzes Loch — Hyperjump nicht möglich',
      });
      return;
    }
    if (targetSectorNebula?.environment === 'black_hole') {
      client.send('error', {
        code: 'HYPERJUMP_FAIL',
        message: 'Schwarzes Loch am Ziel — Hyperjump nicht möglich',
      });
      return;
    }

    // Get ship stats
    const ship = this.ctx.getShipForClient(client.sessionId);

    // ── Hyperdrive V2: charge-gated jumps ──

    // Require a drive module (hyperdriveRange > 0)
    if (ship.hyperdriveRange <= 0) {
      client.send('error', { code: 'HYPERJUMP_FAIL', message: 'No hyperdrive installed' });
      return;
    }

    // Get or init hyperdrive state from Redis
    let hdState = await getHyperdriveState(auth.userId);
    if (!hdState) {
      hdState = createHyperdriveState(ship);
      await setHyperdriveState(auth.userId, hdState);
    }

    // Calculate current charge (lazy regen)
    const now = Date.now();
    const currentCharge = calculateCurrentCharge(hdState, now);

    // Check charge covers distance
    if (distance > currentCharge) {
      client.send('error', {
        code: 'HYPERJUMP_FAIL',
        message: `Insufficient hyperdrive charge (need ${distance}, have ${Math.floor(currentCharge)})`,
      });
      return;
    }

    // Fuel cost: V2 formula with drive efficiency
    const fuelCost = calcHyperjumpFuelV2(
      BASE_FUEL_PER_JUMP,
      distance,
      ship.hyperdriveFuelEfficiency,
    );

    // Apply pirate zone fuel penalty
    const isPirate =
      sourceSector?.contents?.includes('pirate_zone') ||
      targetSectorNebula?.contents?.includes('pirate_zone');
    const finalFuelCost = isPirate
      ? Math.ceil(fuelCost * HYPERJUMP_PIRATE_FUEL_PENALTY)
      : fuelCost;

    // Validate AP
    const apCost = calcHyperjumpAP(ship.engineSpeed);
    const ap = await getAPState(auth.userId);
    const updated = calculateCurrentAP(ap);
    if (updated.current < apCost) {
      client.send('error', {
        code: 'HYPERJUMP_FAIL',
        message: `Not enough AP (need ${apCost}, have ${updated.current})`,
      });
      return;
    }

    // Validate fuel
    const currentFuel = await getFuelState(auth.userId);
    if (currentFuel === null || currentFuel < finalFuelCost) {
      client.send('error', {
        code: 'HYPERJUMP_FAIL',
        message: `Not enough fuel (need ${finalFuelCost}, have ${currentFuel ?? 0})`,
      });
      return;
    }

    // Spend charge
    const newHdState = spendCharge(hdState, distance, now);
    if (!newHdState) {
      client.send('error', { code: 'HYPERJUMP_FAIL', message: 'Hyperdrive charge spend failed' });
      return;
    }
    await setHyperdriveState(auth.userId, newHdState);

    // Deduct AP upfront
    const newAP = { ...updated, current: updated.current - apCost };
    await saveAPState(auth.userId, newAP);
    client.send('apUpdate', newAP);

    // Deduct fuel upfront
    const newFuel = currentFuel - finalFuelCost;
    await saveFuelState(auth.userId, newFuel);
    client.send('fuelUpdate', { current: newFuel, max: ship.fuelMax });

    // Send hyperdrive state update to client
    client.send('hyperdriveUpdate', {
      charge: newHdState.charge,
      maxCharge: newHdState.maxCharge,
      regenPerSecond: newHdState.regenPerSecond,
      lastTick: newHdState.lastTick,
    });

    // Build step list (Manhattan path: X first, then Y)
    // Use hyperdriveSpeed for autopilot tick rate
    const autopilotMs =
      ship.hyperdriveSpeed > 0
        ? Math.max(20, Math.floor(AUTOPILOT_STEP_MS / ship.hyperdriveSpeed))
        : AUTOPILOT_STEP_MS;
    const steps: { x: number; y: number }[] = [];
    let cx = pos.x;
    let cy = pos.y;
    const stepX = dx > 0 ? 1 : dx < 0 ? -1 : 0;
    const stepY = dy > 0 ? 1 : dy < 0 ? -1 : 0;
    for (let i = 0; i < Math.abs(dx); i++) {
      cx += stepX;
      steps.push({ x: cx, y: cy });
    }
    for (let i = 0; i < Math.abs(dy); i++) {
      cy += stepY;
      steps.push({ x: cx, y: cy });
    }

    // Start autopilot
    let stepIndex = 0;
    client.send('autopilotStart', { targetX, targetY, totalSteps: steps.length });

    const timer = setInterval(async () => {
      try {
        if (stepIndex >= steps.length) {
          clearInterval(timer);
          this.ctx.autopilotTimers.delete(client.sessionId);
          await savePlayerPosition(auth.userId, targetX, targetY);
          await addDiscovery(auth.userId, targetX, targetY);
          const hjPlayer = this.ctx.state.players.get(client.sessionId);
          if (hjPlayer) {
            hjPlayer.x = targetX;
            hjPlayer.y = targetY;
          }
          let targetSector = await getSector(targetX, targetY);
          if (!targetSector) {
            {
              const { qx, qy } = sectorToQuadrant(targetX, targetY);
              const _controls = await getAllQuadrantControls();
              targetSector = generateSector(targetX, targetY, auth.userId, isFrontierQuadrant(qx, qy, _controls));
            }
            await saveSector(targetSector);
          }
          this.ctx.playerSectorData.set(client.sessionId, targetSector);
          client.send('autopilotComplete', { x: targetX, y: targetY, sector: targetSector });
          await this.ctx.checkFirstContact(client, auth, targetX, targetY);

          // Auto-refuel at station
          if (targetSector.contents?.includes('station') || targetSector.type === 'station') {
            await this.tryAutoRefuel(client, auth, ship);
          }
          return;
        }
        const step = steps[stepIndex];
        await savePlayerPosition(auth.userId, step.x, step.y);
        await addDiscovery(auth.userId, step.x, step.y);
        const hjStepPlayer = this.ctx.state.players.get(client.sessionId);
        if (hjStepPlayer) {
          hjStepPlayer.x = step.x;
          hjStepPlayer.y = step.y;
        }
        stepIndex++;
        client.send('autopilotUpdate', {
          x: step.x,
          y: step.y,
          remaining: steps.length - stepIndex,
        });
      } catch (err) {
        logger.error({ err }, 'Hyperjump autopilot step error');
        clearInterval(timer);
        this.ctx.autopilotTimers.delete(client.sessionId);
        client.send('autopilotComplete', { x: -1, y: -1 });
      }
    }, autopilotMs);

    this.ctx.autopilotTimers.set(client.sessionId, timer);
  }

  async handleCancelAutopilot(client: Client): Promise<void> {
    const timer = this.ctx.autopilotTimers.get(client.sessionId);
    if (timer) {
      clearInterval(timer);
      this.ctx.autopilotTimers.delete(client.sessionId);
    }
    const auth = client.auth as AuthPayload;
    try {
      await cancelAutopilotRoute(auth.userId);
    } catch {
      // best-effort DB cancellation
    }
    client.send('autopilotCancelled', { success: true });
    client.send('autopilotComplete', { x: -1, y: -1 });
  }

  /**
   * Start a new autopilot route: validate target, compute path + cost preview,
   * store in DB, and begin stepping.
   */
  async handleStartAutopilot(
    client: Client,
    data: { targetX: number; targetY: number; useHyperjump?: boolean },
  ): Promise<void> {
    if (!this.ctx.checkRate(client.sessionId, 'startAutopilot', 1000)) {
      client.send('error', { code: 'RATE_LIMIT', message: 'Too fast' });
      return;
    }
    const { targetX, targetY } = data;
    const useHyperjump = data.useHyperjump ?? false;

    if (
      !isInt(targetX) ||
      !isInt(targetY) ||
      Math.abs(targetX) > MAX_COORD ||
      Math.abs(targetY) > MAX_COORD
    ) {
      client.send('error', { code: 'INVALID_INPUT', message: 'Invalid coordinates' });
      return;
    }

    const auth = client.auth as AuthPayload;

    // Reject if already in autopilot
    if (this.ctx.autopilotTimers.has(client.sessionId)) {
      client.send('error', { code: 'AUTOPILOT_FAIL', message: 'Autopilot already active' });
      return;
    }

    // Reject guests
    if (rejectGuest(client, 'Autopilot')) return;

    // Validate target is discovered
    const discovered = await isRouteDiscovered(auth.userId, targetX, targetY);
    if (!discovered) {
      client.send('error', { code: 'AUTOPILOT_FAIL', message: 'Target sector not discovered' });
      return;
    }

    // Check mining state
    const mining = await getMiningState(auth.userId);
    if (mining?.active) {
      client.send('error', {
        code: 'AUTOPILOT_FAIL',
        message: 'Cannot start autopilot while mining',
      });
      return;
    }

    // Get current position
    const pos = await getPlayerPosition(auth.userId);
    if (!pos) {
      client.send('error', { code: 'AUTOPILOT_FAIL', message: 'Position unknown' });
      return;
    }

    if (pos.x === targetX && pos.y === targetY) {
      client.send('error', { code: 'AUTOPILOT_FAIL', message: 'Already at target' });
      return;
    }

    const ship = this.ctx.getShipForClient(client.sessionId);

    // Calculate path with black-hole avoidance
    const isBlackHole = (x: number, y: number): boolean => {
      if (isInBlackHoleCluster(x, y)) return true;
      const dist = Math.max(Math.abs(x), Math.abs(y));
      if (dist > BLACK_HOLE_MIN_DISTANCE) {
        const seed = hashCoords(x, y, WORLD_SEED);
        const bhRoll = (seed >>> 0) / 0x100000000;
        if (bhRoll < BLACK_HOLE_SPAWN_CHANCE) return true;
      }
      return false;
    };

    const path = calculateAutopilotPath(
      { x: pos.x, y: pos.y },
      { x: targetX, y: targetY },
      isBlackHole,
    );

    if (path.length === 0) {
      client.send('error', { code: 'AUTOPILOT_FAIL', message: 'No path found' });
      return;
    }

    // Calculate cost preview
    const costs = calculateAutopilotCosts(path, ship, useHyperjump);

    // Validate AP
    const ap = await getAPState(auth.userId);
    const updated = calculateCurrentAP(ap);
    if (updated.current < ship.apCostJump) {
      client.send('error', { code: 'AUTOPILOT_FAIL', message: 'Not enough AP to start' });
      return;
    }

    // Validate fuel if using hyperjump
    if (useHyperjump) {
      const fuel = await getFuelState(auth.userId);
      if (fuel === null || fuel < 1) {
        client.send('error', { code: 'AUTOPILOT_FAIL', message: 'Not enough fuel for hyperjump' });
        return;
      }
    }

    // Save route to DB
    const now = Date.now();
    await saveAutopilotRoute(auth.userId, targetX, targetY, useHyperjump, path, now);

    // Send preview + start
    client.send('autopilotStart', {
      targetX,
      targetY,
      totalSteps: path.length,
      currentStep: 0,
      costs,
      resumed: false,
    });

    // Begin stepping
    this.startAutopilotTimer(client, auth, path, 0, useHyperjump, ship);
  }

  /**
   * Return current autopilot progress.
   */
  async handleGetAutopilotStatus(client: Client): Promise<void> {
    const auth = client.auth as AuthPayload;
    const route = await getActiveAutopilotRoute(auth.userId);
    if (!route) {
      client.send('autopilotStatus', { active: false });
      return;
    }
    const ship = this.ctx.getShipForClient(client.sessionId);
    const remaining = route.totalSteps - route.currentStep;
    const costs = calculateAutopilotCosts(
      route.path.slice(route.currentStep),
      ship,
      route.useHyperjump,
    );
    client.send('autopilotStatus', {
      active: true,
      targetX: route.targetX,
      targetY: route.targetY,
      currentStep: route.currentStep,
      totalSteps: route.totalSteps,
      remaining,
      eta: costs.estimatedTime,
      useHyperjump: route.useHyperjump,
    });
  }

  /**
   * Slow Flight: automatic sector-by-sector navigation, intra-quadrant only.
   * Extends the existing autopilot with a fixed 3000ms tick and no fuel cost.
   */
  async handleSlowFlight(
    client: Client,
    data: { targetX: number; targetY: number },
  ): Promise<void> {
    const { targetX, targetY } = data;
    const auth = client.auth as AuthPayload;

    // Reject if autopilot already active
    if (this.ctx.autopilotTimers.has(client.sessionId)) {
      client.send('error', { code: 'SLOW_FLIGHT_FAIL', message: 'Autopilot already active' });
      return;
    }

    if (!this.ctx.checkRate(client.sessionId, 'slowFlight', 1000)) {
      client.send('error', { code: 'RATE_LIMIT', message: 'Too fast' });
      return;
    }

    // Reject guests
    if (rejectGuest(client, 'SlowFlight')) return;

    if (
      !isInt(targetX) ||
      !isInt(targetY) ||
      Math.abs(targetX) > MAX_COORD ||
      Math.abs(targetY) > MAX_COORD
    ) {
      client.send('error', { code: 'INVALID_INPUT', message: 'Invalid coordinates' });
      return;
    }

    // Check mining state
    const mining = await getMiningState(auth.userId);
    if (mining?.active) {
      client.send('error', { code: 'SLOW_FLIGHT_FAIL', message: 'Cannot start while mining' });
      return;
    }

    // Get current position
    const pos = await getPlayerPosition(auth.userId);
    if (!pos) {
      client.send('error', { code: 'SLOW_FLIGHT_FAIL', message: 'Position unknown' });
      return;
    }

    if (pos.x === targetX && pos.y === targetY) {
      client.send('error', { code: 'SLOW_FLIGHT_FAIL', message: 'Already at target' });
      return;
    }

    // Validate intra-quadrant
    const { qx: curQx, qy: curQy } = sectorToQuadrant(pos.x, pos.y);
    const { qx: tgtQx, qy: tgtQy } = sectorToQuadrant(targetX, targetY);
    if (curQx !== tgtQx || curQy !== tgtQy) {
      client.send('error', {
        code: 'SLOW_FLIGHT_FAIL',
        message: 'Slow Flight is intra-quadrant only — use Hyperjump for cross-quadrant',
      });
      return;
    }

    const ship = this.ctx.getShipForClient(client.sessionId);

    // Calculate path (no black hole avoidance for slow flight)
    const path = calculateAutopilotPath(
      { x: pos.x, y: pos.y },
      { x: targetX, y: targetY },
      () => false,
    );

    if (path.length === 0) {
      client.send('error', { code: 'SLOW_FLIGHT_FAIL', message: 'No path found' });
      return;
    }

    // Validate AP
    const ap = await getAPState(auth.userId);
    const updated = calculateCurrentAP(ap);
    if (updated.current < ship.apCostJump) {
      client.send('error', { code: 'SLOW_FLIGHT_FAIL', message: 'Not enough AP' });
      return;
    }

    // Save route to DB
    const now = Date.now();
    await saveAutopilotRoute(auth.userId, targetX, targetY, false, path, now);

    // Send start message with source identifier
    client.send('autopilotStart', {
      targetX,
      targetY,
      totalSteps: path.length,
      currentStep: 0,
      source: 'slow_flight',
    });

    // Begin stepping at SLOW_FLIGHT_INTERVAL_MS (3000ms per sector)
    this.startAutopilotTimer(client, auth, path, 0, false, ship, SLOW_FLIGHT_INTERVAL_MS, true);
  }

  /**
   * Start (or resume) the autopilot interval timer for a client.
   * Each tick applies one segment of movement, deducts resources
   * incrementally, and persists progress to DB.
   */
  startAutopilotTimer(
    client: Client,
    auth: AuthPayload,
    path: Array<{ x: number; y: number }>,
    startStep: number,
    useHyperjump: boolean,
    ship: ShipStats,
    overrideTickMs?: number,
    isSlowFlight?: boolean,
  ): void {
    let currentStep = startStep;
    const speed = ship.engineSpeed;
    const tickMs =
      overrideTickMs ??
      (useHyperjump && speed > 0
        ? Math.max(STEP_INTERVAL_MIN_MS, Math.floor(STEP_INTERVAL_MS / speed))
        : STEP_INTERVAL_MS);

    const timer = setInterval(async () => {
      try {
        // Check if route is complete
        if (currentStep >= path.length) {
          clearInterval(timer);
          this.ctx.autopilotTimers.delete(client.sessionId);
          const target = path[path.length - 1];
          await completeAutopilotRoute(auth.userId);
          await savePlayerPosition(auth.userId, target.x, target.y);
          await addDiscovery(auth.userId, target.x, target.y);

          // Update player position in schema
          const player = this.ctx.state.players.get(client.sessionId);
          if (player) {
            player.x = target.x;
            player.y = target.y;
          }

          // Load or generate target sector
          let targetSector = await getSector(target.x, target.y);
          if (!targetSector) {
            {
              const { qx, qy } = sectorToQuadrant(target.x, target.y);
              const _controls = await getAllQuadrantControls();
              targetSector = generateSector(target.x, target.y, auth.userId, isFrontierQuadrant(qx, qy, _controls));
            }
            await saveSector(targetSector);
          }
          this.ctx.playerSectorData.set(client.sessionId, targetSector);

          client.send('autopilotComplete', {
            x: target.x,
            y: target.y,
            sector: targetSector,
            ...(isSlowFlight ? { source: 'slow_flight' } : {}),
          });

          // Quadrant first-contact detection
          await this.ctx.checkFirstContact(client, auth, target.x, target.y);

          // Auto-refuel at station
          if (targetSector.contents?.includes('station') || targetSector.type === 'station') {
            await this.tryAutoRefuel(client, auth, ship);
          }
          return;
        }

        // Get current AP + fuel
        const ap = await getAPState(auth.userId);
        const updatedAP = calculateCurrentAP(ap);

        // Determine the next segment
        let hyperdriveCharge = 0;
        if (useHyperjump) {
          const hdState = await getHyperdriveState(auth.userId);
          if (hdState) {
            hyperdriveCharge = calculateCurrentCharge(hdState);
          }
        }

        const segment = getNextSegment(
          path,
          currentStep,
          useHyperjump ? hyperdriveCharge : 0,
          useHyperjump ? speed : 0,
        );

        if (segment.moves.length === 0) {
          // Path exhausted or no charge — should not happen if currentStep < path.length
          // Pause the route
          clearInterval(timer);
          this.ctx.autopilotTimers.delete(client.sessionId);
          await pauseAutopilotRoute(auth.userId);
          client.send('autopilotPaused', { reason: 'no_charge', currentStep });
          return;
        }

        // Calculate resource costs for this segment
        const apCost = segment.isHyperjump
          ? Math.max(1, Math.ceil(segment.moves.length * ship.apCostJump * 0.5))
          : segment.moves.length * ship.apCostJump;

        if (updatedAP.current < apCost) {
          // Not enough AP — pause
          clearInterval(timer);
          this.ctx.autopilotTimers.delete(client.sessionId);
          await pauseAutopilotRoute(auth.userId);
          client.send('autopilotPaused', { reason: 'ap_exhausted', currentStep });
          return;
        }

        let fuelCost = 0;
        if (segment.isHyperjump) {
          fuelCost = calcHyperjumpFuelV2(BASE_FUEL_PER_JUMP, segment.moves.length, ship.hyperdriveFuelEfficiency);

          const currentFuel = await getFuelState(auth.userId);
          if (currentFuel === null || currentFuel < fuelCost) {
            clearInterval(timer);
            this.ctx.autopilotTimers.delete(client.sessionId);
            await pauseAutopilotRoute(auth.userId);
            client.send('autopilotPaused', { reason: 'fuel_exhausted', currentStep });
            return;
          }
        }

        // Deduct AP
        const newAP = { ...updatedAP, current: updatedAP.current - apCost };
        await saveAPState(auth.userId, newAP);
        client.send('apUpdate', newAP);

        // Deduct fuel
        if (fuelCost > 0) {
          const currentFuel = (await getFuelState(auth.userId)) ?? 0;
          const newFuel = Math.max(0, currentFuel - fuelCost);
          await saveFuelState(auth.userId, newFuel);
          client.send('fuelUpdate', { current: newFuel, max: ship.fuelMax });
        }

        // Spend hyperdrive charge if V2
        if (segment.isHyperjump) {
          const hdState = await getHyperdriveState(auth.userId);
          if (hdState) {
            const now = Date.now();
            const newHd = spendCharge(hdState, segment.moves.length, now);
            if (newHd) {
              await setHyperdriveState(auth.userId, newHd);
              client.send('hyperdriveUpdate', {
                charge: newHd.charge,
                maxCharge: newHd.maxCharge,
                regenPerSecond: newHd.regenPerSecond,
                lastTick: newHd.lastTick,
              });
            }
          }
        }

        // Apply movement for each move in the segment
        const lastMove = segment.moves[segment.moves.length - 1];
        for (const move of segment.moves) {
          await savePlayerPosition(auth.userId, move.x, move.y);
          await addDiscovery(auth.userId, move.x, move.y);
        }
        // Update player position in schema
        const apPlayer = this.ctx.state.players.get(client.sessionId);
        if (apPlayer) {
          apPlayer.x = lastMove.x;
          apPlayer.y = lastMove.y;
        }
        currentStep += segment.moves.length;

        // Persist step progress to DB
        await updateAutopilotStep(auth.userId, currentStep, Date.now());

        // Send progress update to client
        client.send('autopilotUpdate', {
          x: lastMove.x,
          y: lastMove.y,
          remaining: path.length - currentStep,
          currentStep,
          totalSteps: path.length,
        });
      } catch (err) {
        logger.error({ err }, 'Autopilot step error');
        clearInterval(timer);
        this.ctx.autopilotTimers.delete(client.sessionId);
        try {
          await pauseAutopilotRoute(auth.userId);
        } catch {
          // best-effort
        }
        client.send('autopilotPaused', { reason: 'error', currentStep });
      }
    }, tickMs);

    this.ctx.autopilotTimers.set(client.sessionId, timer);
  }

  /**
   * Auto-refuel at a station: top up fuel to max using credits.
   * Applies the better of station-rep vs faction-rep price modifier.
   */
  async tryAutoRefuel(client: Client, auth: AuthPayload, ship: ShipStats): Promise<void> {
    try {
      const currentFuel = (await getFuelState(auth.userId)) ?? 0;
      const tankSpace = ship.fuelMax - currentFuel;
      if (tankSpace <= 0) return;

      // Calculate price modifier using station/faction rep
      const sx = this.ctx.state.players.get(client.sessionId)?.x ?? 0;
      const sy = this.ctx.state.players.get(client.sessionId)?.y ?? 0;
      let modifier = 1.0;
      const sectorFaction = getStationFaction(sx, sy);
      if (sectorFaction) {
        const factionRep = await getPlayerReputation(auth.userId, sectorFaction);
        const tier = getReputationTier(factionRep);
        modifier = REP_PRICE_MODIFIERS[tier] ?? 1.0;
      }
      const stationRep = await getPlayerStationRep(auth.userId, sx, sy);
      const stationModifier = getFuelRepPriceModifier(stationRep);
      modifier = Math.min(modifier, stationModifier);

      const credits = await getPlayerCredits(auth.userId);
      const cost = Math.ceil(tankSpace * FUEL_COST_PER_UNIT * modifier);
      if (credits < cost) return; // silently skip if can't afford full refuel

      await deductCredits(auth.userId, cost);
      const newFuel = currentFuel + tankSpace;
      await saveFuelState(auth.userId, newFuel);

      const remainingCredits = await getPlayerCredits(auth.userId);
      client.send('fuelUpdate', { current: newFuel, max: ship.fuelMax });
      client.send('creditsUpdate', { credits: remainingCredits });
      client.send('logEntry', `AUTO-REFUEL: +${tankSpace} fuel (-${cost} credits)`);
    } catch {
      // Don't block on auto-refuel failure
    }
  }

  // ── Player Gate Travel ─────────────────────────────────────────────

  /**
   * Detect player-built jumpgate at sector and send info to client.
   * Called from handleMoveSector / onJoin alongside detectAndSendJumpGate.
   */
  async detectAndSendPlayerGate(client: Client, sectorX: number, sectorY: number): Promise<void> {
    const gate = await getPlayerJumpGate(sectorX, sectorY);
    if (!gate) return;

    // Build gate graph for BFS
    const { gatesMap, linksMap } = await this.buildGateGraph();

    // Get reachable destinations via BFS
    const destinations = findReachableGates(gate.id, gatesMap, linksMap);

    // Get direct links for UI display
    const links = await getJumpGateLinks(gate.id);

    client.send('playerGateInfo', {
      gate: {
        id: gate.id,
        sectorX: gate.sectorX,
        sectorY: gate.sectorY,
        ownerId: gate.ownerId,
        ownerName: gate.ownerName,
        tollCredits: gate.tollCredits,
        levelConnection: gate.levelConnection,
        levelDistance: gate.levelDistance,
        linkedGates: links,
      },
      destinations,
    });
  }

  /**
   * Build the gate graph (gates map + links map) from DB for BFS routing.
   */
  private async buildGateGraph(): Promise<{
    gatesMap: Map<string, { id: string; sectorX: number; sectorY: number; tollCredits: number }>;
    linksMap: Map<string, string[]>;
  }> {
    const [allGates, allLinks] = await Promise.all([getAllPlayerGates(), getAllJumpGateLinks()]);

    const gatesMap = new Map<
      string,
      { id: string; sectorX: number; sectorY: number; tollCredits: number }
    >();
    for (const g of allGates) {
      gatesMap.set(g.id, {
        id: g.id,
        sectorX: g.sectorX,
        sectorY: g.sectorY,
        tollCredits: g.tollCredits,
      });
    }

    const linksMap = new Map<string, string[]>();
    for (const link of allLinks) {
      const existing = linksMap.get(link.gateId) ?? [];
      existing.push(link.linkedGateId);
      linksMap.set(link.gateId, existing);
    }

    return { gatesMap, linksMap };
  }

  /**
   * Handle player using a player-built jumpgate network.
   * Uses BFS to find the route and handles toll credit distribution.
   */
  async handleUsePlayerGate(
    client: Client,
    data: { gateId: string; destinationGateId: string },
  ): Promise<void> {
    if (!this.ctx.checkRate(client.sessionId, 'usePlayerGate', 1000)) {
      client.send('error', { code: 'RATE_LIMIT', message: 'Too fast' });
      return;
    }

    const auth = client.auth as AuthPayload;

    // Verify player is at the gate's sector
    const sx = this.ctx._px(client.sessionId);
    const sy = this.ctx._py(client.sessionId);
    const gate = await getPlayerJumpGate(sx, sy);
    if (!gate || gate.id !== data.gateId) {
      client.send('error', { code: 'GATE_FAIL', message: 'Not at this gate' });
      return;
    }

    // Reject if mining is active
    const mining = await getMiningState(auth.userId);
    if (mining?.active) {
      client.send('error', { code: 'GATE_FAIL', message: 'Cannot travel while mining' });
      return;
    }

    // Build gate graph from DB and run BFS
    const { gatesMap, linksMap } = await this.buildGateGraph();
    const destinations = findReachableGates(data.gateId, gatesMap, linksMap);

    const destination = destinations.find((r) => r.gateId === data.destinationGateId);
    if (!destination) {
      client.send('error', { code: 'GATE_FAIL', message: 'Destination not reachable' });
      return;
    }

    // Check credits
    const credits = await getPlayerCredits(auth.userId);
    if (credits < destination.totalCost) {
      client.send('error', {
        code: 'GATE_FAIL',
        message: `Need ${destination.totalCost} credits (have ${credits})`,
      });
      return;
    }

    // Deduct total cost from traveler and distribute tolls
    if (destination.totalCost > 0) {
      const deducted = await deductCredits(auth.userId, destination.totalCost);
      if (!deducted) {
        client.send('error', { code: 'GATE_FAIL', message: 'Insufficient credits' });
        return;
      }

      // Distribute tolls to gate owners along the route.
      // BFS gives us totalCost but not the path. We trace it by running a
      // simple BFS from start to destination and crediting each hop's
      // origin gate owner their toll.
      await this.distributeTolls(
        data.gateId,
        data.destinationGateId,
        auth.userId,
        gatesMap,
        linksMap,
      );
    }

    const targetX = destination.sectorX;
    const targetY = destination.sectorY;

    // Load or generate target sector
    let targetSector = await getSector(targetX, targetY);
    if (!targetSector) {
      {
        const { qx, qy } = sectorToQuadrant(targetX, targetY);
        const _controls = await getAllQuadrantControls();
        targetSector = generateSector(targetX, targetY, auth.userId, isFrontierQuadrant(qx, qy, _controls));
      }
      await saveSector(targetSector);
    }

    // Record discovery (check first-time before inserting)
    const pgSectorAlreadyKnown = await isRouteDiscovered(auth.userId, targetX, targetY);
    await addDiscovery(auth.userId, targetX, targetY);

    // ACEP XP: AUSBAU per jump
    addAcepXpForPlayer(auth.userId, 'ausbau', 2).catch(() => {});
    // ACEP XP: EXPLORER for first sector discovery
    if (!pgSectorAlreadyKnown) {
      addAcepXpForPlayer(auth.userId, 'explorer', 10).catch(() => {});
    }
    awardWissenAndNotify(client, auth.userId, 1);  // +1 per new sector

    // Check cross-quadrant
    const { qx: curQx, qy: curQy } = sectorToQuadrant(sx, sy);
    const { qx: tgtQx, qy: tgtQy } = sectorToQuadrant(targetX, targetY);
    const crossQuadrant = curQx !== tgtQx || curQy !== tgtQy;

    if (!crossQuadrant) {
      // Intra-quadrant: update player position in-place
      const player = this.ctx.state.players.get(client.sessionId);
      if (player) {
        player.x = targetX;
        player.y = targetY;
      }
      this.ctx.playerSectorData.set(client.sessionId, targetSector);
      await savePlayerPosition(auth.userId, targetX, targetY);
    }

    const remainingCredits = await getPlayerCredits(auth.userId);

    client.send('playerGateResult', {
      success: true,
      newSector: targetSector,
      targetX,
      targetY,
      credits: remainingCredits,
      hops: destination.hops,
      tollPaid: destination.totalCost,
      crossQuadrant,
    });

    // Check for JumpGate at target sector
    await this.detectAndSendJumpGate(client, auth, targetX, targetY, false);

    // Check for player gate at target sector
    await this.detectAndSendPlayerGate(client, targetX, targetY);

    // Quadrant first-contact detection
    await this.ctx.checkFirstContact(client, auth, targetX, targetY);

    if (crossQuadrant) {
      awardWissenAndNotify(client, auth.userId, 5);  // +5 per quadrant change
    }

    logger.info(
      {
        username: auth.username,
        from: `${sx},${sy}`,
        to: `${targetX},${targetY}`,
        hops: destination.hops,
        tollPaid: destination.totalCost,
        crossQuadrant,
      },
      'Player gate travel',
    );
  }

  /**
   * Trace the BFS path from start to destination and credit each gate owner
   * their toll along the route.
   */
  private async distributeTolls(
    startGateId: string,
    destGateId: string,
    travelerId: string,
    gatesMap: Map<string, { id: string; sectorX: number; sectorY: number; tollCredits: number }>,
    linksMap: Map<string, string[]>,
  ): Promise<void> {
    // BFS to find the path from start to destination
    const visited = new Set<string>([startGateId]);
    const parent = new Map<string, string>(); // child -> parent
    const queue: string[] = [];

    const neighbors = linksMap.get(startGateId) ?? [];
    for (const n of neighbors) {
      if (!visited.has(n)) {
        visited.add(n);
        parent.set(n, startGateId);
        queue.push(n);
      }
    }

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current === destGateId) break;

      const nextNeighbors = linksMap.get(current) ?? [];
      for (const n of nextNeighbors) {
        if (!visited.has(n)) {
          visited.add(n);
          parent.set(n, current);
          queue.push(n);
        }
      }
    }

    // Reconstruct path: destGateId <- ... <- startGateId
    const path: string[] = [];
    let current: string | undefined = destGateId;
    while (current && current !== startGateId) {
      path.unshift(current);
      current = parent.get(current);
    }
    if (current === startGateId) {
      path.unshift(startGateId);
    }

    // Credit each hop's origin gate owner their toll
    // Path: [start, hop1, hop2, ..., dest]
    // Each hop from path[i] to path[i+1] costs path[i]'s toll
    for (let i = 0; i < path.length - 1; i++) {
      const hopGate = gatesMap.get(path[i]);
      if (!hopGate || hopGate.tollCredits <= 0) continue;

      // Get the owner from the DB (gatesMap doesn't have ownerId)
      const fullGate = await getPlayerJumpGate(hopGate.sectorX, hopGate.sectorY);
      if (fullGate && fullGate.ownerId && fullGate.ownerId !== travelerId) {
        await addCredits(fullGate.ownerId, hopGate.tollCredits);
      }
    }
  }
}
