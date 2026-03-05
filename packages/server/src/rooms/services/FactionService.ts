import type { Client } from 'colyseus';
import type { ServiceContext } from './ServiceContext.js';
import type { AuthPayload } from '../../auth.js';
import type { CreateFactionMessage, FactionActionMessage, FactionUpgradeMessage, FactionUpgradeChoice } from '@void-sector/shared';
import { FACTION_UPGRADE_TIERS } from '@void-sector/shared';
import { rejectGuest } from './utils.js';
import { validateFactionAction } from '../../engine/commands.js';
import {
  createFaction,
  getFactionById,
  getPlayerFaction,
  getFactionMembers,
  addFactionMember,
  removeFactionMember,
  updateMemberRank,
  updateFactionJoinMode,
  getFactionByCode,
  disbandFaction,
  createFactionInvite,
  getPlayerFactionInvites,
  respondToInvite,
  getPlayerIdByUsername,
  getFactionMembersByPlayerIds,
  getPlayerCredits,
  deductCredits,
  getFactionUpgrades,
  setFactionUpgrade,
} from '../../db/queries.js';

export class FactionService {
  constructor(private ctx: ServiceContext) {}

  async sendFactionData(client: Client): Promise<void> {
    const auth = client.auth as AuthPayload;
    const factionRow = await getPlayerFaction(auth.userId);

    if (!factionRow) {
      const invites = await getPlayerFactionInvites(auth.userId);
      this.ctx.send(client, 'factionData', { faction: null, members: [], invites });
      return;
    }

    const members = await getFactionMembers(factionRow.id);
    const invites = await getPlayerFactionInvites(auth.userId);

    this.ctx.send(client, 'factionData', {
      faction: {
        id: factionRow.id,
        name: factionRow.name,
        tag: factionRow.tag,
        leaderId: factionRow.leader_id,
        leaderName: factionRow.leader_name,
        joinMode: factionRow.join_mode,
        inviteCode: factionRow.invite_code,
        memberCount: Number(factionRow.member_count),
        createdAt: new Date(factionRow.created_at).getTime(),
      },
      members: members.map(m => ({
        playerId: m.player_id,
        playerName: m.player_name,
        rank: m.rank,
        joinedAt: new Date(m.joined_at).getTime(),
      })),
      invites,
    });
  }

  async handleCreateFaction(client: Client, data: CreateFactionMessage): Promise<void> {
    if (rejectGuest(client, 'Fraktionen')) return;
    const auth = client.auth as AuthPayload;

    if (!data.name || data.name.trim().length < 3 || data.name.trim().length > 64) {
      this.ctx.send(client, 'createFactionResult', { success: false, error: 'Name must be 3-64 characters' });
      return;
    }
    if (!data.tag || data.tag.trim().length < 3 || data.tag.trim().length > 5) {
      this.ctx.send(client, 'createFactionResult', { success: false, error: 'Tag must be 3-5 characters' });
      return;
    }
    if (!['open', 'code', 'invite'].includes(data.joinMode)) {
      this.ctx.send(client, 'createFactionResult', { success: false, error: 'Invalid join mode' });
      return;
    }

    const existing = await getPlayerFaction(auth.userId);
    if (existing) {
      this.ctx.send(client, 'createFactionResult', { success: false, error: 'Already in a faction' });
      return;
    }

    try {
      await createFaction(auth.userId, data.name.trim(), data.tag.trim().toUpperCase(), data.joinMode);
      await this.sendFactionData(client);
      this.ctx.send(client, 'createFactionResult', { success: true });
    } catch (err: any) {
      if (err.code === '23505') {
        this.ctx.send(client, 'createFactionResult', { success: false, error: 'Name or tag already taken' });
      } else {
        throw err;
      }
    }
  }

  async handleFactionAction(client: Client, data: FactionActionMessage): Promise<void> {
    if (rejectGuest(client, 'Fraktionen')) return;
    const auth = client.auth as AuthPayload;
    const myFaction = await getPlayerFaction(auth.userId);

    if (data.action === 'join') {
      return this.handleJoinFaction(client, auth, data);
    }
    if (data.action === 'joinCode') {
      return this.handleJoinByCode(client, auth, data);
    }
    if (data.action === 'leave') {
      return this.handleLeaveFaction(client, auth, myFaction);
    }

    if (!myFaction) {
      this.ctx.send(client, 'factionActionResult', { success: false, action: data.action, error: 'Not in a faction' });
      return;
    }

    const myRank = myFaction.player_rank;

    if (data.action === 'invite') {
      return this.handleFactionInvite(client, auth, myFaction, data);
    }

    if (data.action === 'disband') {
      const v = validateFactionAction('disband', myRank);
      if (!v.valid) {
        this.ctx.send(client, 'factionActionResult', { success: false, action: 'disband', error: v.error });
        return;
      }
      await disbandFaction(myFaction.id);
      this.ctx.send(client, 'factionActionResult', { success: true, action: 'disband' });
      await this.sendFactionData(client);
      return;
    }

    if (data.action === 'setJoinMode') {
      const v = validateFactionAction('setJoinMode', myRank);
      if (!v.valid) {
        this.ctx.send(client, 'factionActionResult', { success: false, action: 'setJoinMode', error: v.error });
        return;
      }
      if (!data.joinMode || !['open', 'code', 'invite'].includes(data.joinMode)) {
        this.ctx.send(client, 'factionActionResult', { success: false, action: 'setJoinMode', error: 'Invalid mode' });
        return;
      }
      await updateFactionJoinMode(myFaction.id, data.joinMode);
      this.ctx.send(client, 'factionActionResult', { success: true, action: 'setJoinMode' });
      await this.sendFactionData(client);
      return;
    }

    if (!data.targetPlayerId) {
      this.ctx.send(client, 'factionActionResult', { success: false, action: data.action, error: 'No target' });
      return;
    }

    const targetMembers = await getFactionMembers(myFaction.id);
    const target = targetMembers.find(m => m.player_id === data.targetPlayerId);
    if (!target) {
      this.ctx.send(client, 'factionActionResult', { success: false, action: data.action, error: 'Target not in faction' });
      return;
    }

    const v = validateFactionAction(data.action, myRank, target.rank);
    if (!v.valid) {
      this.ctx.send(client, 'factionActionResult', { success: false, action: data.action, error: v.error });
      return;
    }

    if (data.action === 'kick') {
      await removeFactionMember(myFaction.id, data.targetPlayerId);
    } else if (data.action === 'promote') {
      await updateMemberRank(myFaction.id, data.targetPlayerId, 'officer');
    } else if (data.action === 'demote') {
      await updateMemberRank(myFaction.id, data.targetPlayerId, 'member');
    }

    this.ctx.send(client, 'factionActionResult', { success: true, action: data.action });
    await this.sendFactionData(client);
  }

  private async handleJoinFaction(client: Client, auth: AuthPayload, data: FactionActionMessage): Promise<void> {
    if (!data.targetPlayerId) {
      this.ctx.send(client, 'factionActionResult', { success: false, action: 'join', error: 'No faction specified' });
      return;
    }
    const existing = await getPlayerFaction(auth.userId);
    if (existing) {
      this.ctx.send(client, 'factionActionResult', { success: false, action: 'join', error: 'Already in a faction' });
      return;
    }
    const faction = await getFactionById(data.targetPlayerId);
    if (!faction || faction.join_mode !== 'open') {
      this.ctx.send(client, 'factionActionResult', { success: false, action: 'join', error: 'Faction not open' });
      return;
    }
    await addFactionMember(data.targetPlayerId, auth.userId);
    this.ctx.send(client, 'factionActionResult', { success: true, action: 'join' });
    await this.sendFactionData(client);
  }

  private async handleJoinByCode(client: Client, auth: AuthPayload, data: FactionActionMessage): Promise<void> {
    if (!data.code) {
      this.ctx.send(client, 'factionActionResult', { success: false, action: 'joinCode', error: 'No code' });
      return;
    }
    const existing = await getPlayerFaction(auth.userId);
    if (existing) {
      this.ctx.send(client, 'factionActionResult', { success: false, action: 'joinCode', error: 'Already in a faction' });
      return;
    }
    const faction = await getFactionByCode(data.code.toUpperCase());
    if (!faction || faction.join_mode !== 'code') {
      this.ctx.send(client, 'factionActionResult', { success: false, action: 'joinCode', error: 'Invalid code' });
      return;
    }
    await addFactionMember(faction.id, auth.userId);
    this.ctx.send(client, 'factionActionResult', { success: true, action: 'joinCode' });
    await this.sendFactionData(client);
  }

  private async handleLeaveFaction(client: Client, auth: AuthPayload, faction: any): Promise<void> {
    if (!faction) {
      this.ctx.send(client, 'factionActionResult', { success: false, action: 'leave', error: 'Not in faction' });
      return;
    }
    if (faction.player_rank === 'leader') {
      this.ctx.send(client, 'factionActionResult', { success: false, action: 'leave', error: 'Leader cannot leave — disband instead' });
      return;
    }
    await removeFactionMember(faction.id, auth.userId);
    this.ctx.send(client, 'factionActionResult', { success: true, action: 'leave' });
    await this.sendFactionData(client);
  }

  private async handleFactionInvite(client: Client, auth: AuthPayload, faction: any, data: FactionActionMessage): Promise<void> {
    const v = validateFactionAction('invite', faction.player_rank);
    if (!v.valid) {
      this.ctx.send(client, 'factionActionResult', { success: false, action: 'invite', error: v.error });
      return;
    }
    if (!data.targetPlayerName) {
      this.ctx.send(client, 'factionActionResult', { success: false, action: 'invite', error: 'No player name' });
      return;
    }
    const targetId = await getPlayerIdByUsername(data.targetPlayerName);
    if (!targetId) {
      this.ctx.send(client, 'factionActionResult', { success: false, action: 'invite', error: 'Player not found' });
      return;
    }
    const targetFaction = await getPlayerFaction(targetId);
    if (targetFaction) {
      this.ctx.send(client, 'factionActionResult', { success: false, action: 'invite', error: 'Player already in a faction' });
      return;
    }
    await createFactionInvite(faction.id, auth.userId, targetId);
    this.ctx.send(client, 'factionActionResult', { success: true, action: 'invite' });
  }

  async handleRespondInvite(client: Client, data: { inviteId: string; accept: boolean }): Promise<void> {
    const auth = client.auth as AuthPayload;
    const invite = await respondToInvite(data.inviteId, auth.userId, data.accept);
    if (!invite) {
      this.ctx.send(client, 'factionActionResult', { success: false, action: 'respondInvite', error: 'Invite not found' });
      return;
    }
    if (data.accept) {
      await addFactionMember(invite.faction_id, auth.userId);
    }
    this.ctx.send(client, 'factionActionResult', { success: true, action: 'respondInvite' });
    await this.sendFactionData(client);
  }

  async handleFactionUpgrade(client: Client, data: FactionUpgradeMessage): Promise<void> {
    const auth = client.auth as AuthPayload;
    const { tier, choice } = data;

    // Validate tier exists
    const tierDef = FACTION_UPGRADE_TIERS[tier];
    if (!tierDef) {
      this.ctx.send(client, 'factionUpgradeResult', { success: false, error: 'Invalid tier' });
      return;
    }

    // Must be in a faction as leader
    const faction = await getPlayerFaction(auth.userId);
    if (!faction) {
      this.ctx.send(client, 'factionUpgradeResult', { success: false, error: 'Not in a faction' });
      return;
    }

    const members = await getFactionMembers(faction.id);
    const member = members.find((m: any) => m.player_id === auth.userId);
    if (!member || member.rank !== 'leader') {
      this.ctx.send(client, 'factionUpgradeResult', { success: false, error: 'Only faction leader can upgrade' });
      return;
    }

    // Check prerequisites (previous tiers must be chosen)
    const existing = await getFactionUpgrades(faction.id);
    if (tier > 1 && !existing.some((u: any) => u.tier === tier - 1)) {
      this.ctx.send(client, 'factionUpgradeResult', { success: false, error: `Tier ${tier - 1} must be chosen first` });
      return;
    }
    if (existing.some((u: any) => u.tier === tier)) {
      this.ctx.send(client, 'factionUpgradeResult', { success: false, error: 'Tier already chosen' });
      return;
    }

    // Check credits
    const credits = await getPlayerCredits(auth.userId);
    if (credits < tierDef.cost) {
      this.ctx.send(client, 'factionUpgradeResult', { success: false, error: 'Not enough credits' });
      return;
    }

    await deductCredits(auth.userId, tierDef.cost);
    await setFactionUpgrade(faction.id, tier, choice, auth.userId);

    const upgrades = await getFactionUpgrades(faction.id);
    this.ctx.send(client, 'factionUpgradeResult', {
      success: true,
      upgrades: upgrades.map((u: any) => ({ tier: u.tier, choice: u.choice as FactionUpgradeChoice, chosenAt: Date.now() })),
    });
  }
}
