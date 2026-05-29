import { query } from './client.js';

export interface FeedbackRow {
  id: number;
  playerId: string | null;
  username: string | null;
  category: string;
  message: string;
  status: string;
  createdAt: string;
}

export async function createFeedback(input: {
  playerId: string | null;
  username: string | null;
  category: string;
  message: string;
}): Promise<number> {
  const res = await query<{ id: number }>(
    `INSERT INTO feedback (player_id, username, category, message)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [input.playerId, input.username, input.category, input.message],
  );
  return res.rows[0].id;
}

export async function getFeedback(limit = 100): Promise<FeedbackRow[]> {
  const res = await query<{
    id: number;
    player_id: string | null;
    username: string | null;
    category: string;
    message: string;
    status: string;
    created_at: string;
  }>(
    `SELECT id, player_id, username, category, message, status, created_at
       FROM feedback
      ORDER BY created_at DESC
      LIMIT $1`,
    [limit],
  );
  return res.rows.map((r) => ({
    id: r.id,
    playerId: r.player_id,
    username: r.username,
    category: r.category,
    message: r.message,
    status: r.status,
    createdAt: r.created_at,
  }));
}

export async function setFeedbackStatus(id: number, status: string): Promise<void> {
  await query(`UPDATE feedback SET status = $1 WHERE id = $2`, [status, id]);
}
