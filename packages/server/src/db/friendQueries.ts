import { query } from './client.js';

export const friendQueries = {
  async getFriends(playerId: string): Promise<Array<{ friend_id: string; username: string; level: number }>> {
    const res = await query<{ friend_id: string; username: string; level: number }>(
      `SELECT f.friend_id, p.username, p.level
       FROM player_friends f JOIN players p ON p.id = f.friend_id
       WHERE f.player_id = $1 ORDER BY p.username`,
      [playerId],
    );
    return res.rows;
  },

  async getPendingRequests(playerId: string): Promise<Array<{ id: string; from_player: string; username: string; created_at: string }>> {
    const res = await query<{ id: string; from_player: string; username: string; created_at: string }>(
      `SELECT fr.id, fr.from_player, p.username, fr.created_at
       FROM friend_requests fr JOIN players p ON p.id = fr.from_player
       WHERE fr.to_player = $1 ORDER BY fr.created_at DESC`,
      [playerId],
    );
    return res.rows;
  },

  async getBlocked(playerId: string): Promise<Array<{ blocked_id: string; username: string }>> {
    const res = await query<{ blocked_id: string; username: string }>(
      `SELECT b.blocked_id, p.username FROM player_blocks b
       JOIN players p ON p.id = b.blocked_id WHERE b.blocker_id = $1`,
      [playerId],
    );
    return res.rows;
  },

  async isBlocked(idA: string, idB: string): Promise<boolean> {
    const res = await query<{ x: number }>(
      `SELECT 1 as x FROM player_blocks
       WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1)
       LIMIT 1`,
      [idA, idB],
    );
    return res.rows.length > 0;
  },

  async isFriend(idA: string, idB: string): Promise<boolean> {
    const res = await query<{ x: number }>(
      `SELECT 1 as x FROM player_friends WHERE player_id = $1 AND friend_id = $2 LIMIT 1`,
      [idA, idB],
    );
    return res.rows.length > 0;
  },

  async hasPendingRequest(fromId: string, toId: string): Promise<boolean> {
    const res = await query<{ x: number }>(
      `SELECT 1 as x FROM friend_requests WHERE from_player = $1 AND to_player = $2 LIMIT 1`,
      [fromId, toId],
    );
    return res.rows.length > 0;
  },

  async insertRequest(fromId: string, toId: string): Promise<string> {
    const res = await query<{ id: string }>(
      `INSERT INTO friend_requests (from_player, to_player) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING id`,
      [fromId, toId],
    );
    return res.rows[0]?.id ?? '';
  },

  async deleteRequest(requestId: string, toPlayerId: string): Promise<boolean> {
    const res = await query(
      `DELETE FROM friend_requests WHERE id = $1 AND to_player = $2`,
      [requestId, toPlayerId],
    );
    return (res.rowCount ?? 0) > 0;
  },

  async deleteRequestsBetween(idA: string, idB: string): Promise<void> {
    await query(
      `DELETE FROM friend_requests WHERE (from_player = $1 AND to_player = $2) OR (from_player = $2 AND to_player = $1)`,
      [idA, idB],
    );
  },

  async getRequestById(requestId: string): Promise<{ id: string; from_player: string; to_player: string } | null> {
    const res = await query<{ id: string; from_player: string; to_player: string }>(
      `SELECT id, from_player, to_player FROM friend_requests WHERE id = $1`,
      [requestId],
    );
    return res.rows[0] ?? null;
  },

  async insertFriendship(idA: string, idB: string): Promise<void> {
    await query(
      `INSERT INTO player_friends (player_id, friend_id) VALUES ($1, $2), ($2, $1) ON CONFLICT DO NOTHING`,
      [idA, idB],
    );
  },

  async deleteFriendship(idA: string, idB: string): Promise<void> {
    await query(
      `DELETE FROM player_friends WHERE (player_id = $1 AND friend_id = $2) OR (player_id = $2 AND friend_id = $1)`,
      [idA, idB],
    );
  },

  async insertBlock(blockerId: string, blockedId: string): Promise<void> {
    await query(
      `INSERT INTO player_blocks (blocker_id, blocked_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [blockerId, blockedId],
    );
  },

  async deleteBlock(blockerId: string, blockedId: string): Promise<void> {
    await query(`DELETE FROM player_blocks WHERE blocker_id = $1 AND blocked_id = $2`, [blockerId, blockedId]);
  },

  async getPlayerCardRow(targetId: string): Promise<{ id: string; username: string; level: number } | null> {
    const res = await query<{ id: string; username: string; level: number }>(
      `SELECT id, username, level FROM players WHERE id = $1`,
      [targetId],
    );
    return res.rows[0] ?? null;
  },
};
