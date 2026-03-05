import { query } from './client.js';

export interface KontorOrder {
  id: string;
  ownerId: string;
  sectorX: number;
  sectorY: number;
  itemType: string;
  amountWanted: number;
  amountFilled: number;
  pricePerUnit: number;
  budgetReserved: number;
  active: boolean;
  createdAt: string;
  expiresAt: string | null;
}

interface KontorOrderRow {
  id: string;
  owner_id: string;
  sector_x: number;
  sector_y: number;
  item_type: string;
  amount_wanted: number;
  amount_filled: number;
  price_per_unit: number;
  budget_reserved: number;
  active: boolean;
  created_at: string;
  expires_at: string | null;
}

function rowToOrder(row: KontorOrderRow): KontorOrder {
  return {
    id: row.id,
    ownerId: row.owner_id,
    sectorX: row.sector_x,
    sectorY: row.sector_y,
    itemType: row.item_type,
    amountWanted: row.amount_wanted,
    amountFilled: row.amount_filled,
    pricePerUnit: row.price_per_unit,
    budgetReserved: row.budget_reserved,
    active: row.active,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  };
}

export async function createKontorOrder(
  order: Omit<KontorOrder, 'id' | 'amountFilled' | 'active' | 'createdAt'>,
): Promise<KontorOrder> {
  const { rows } = await query<KontorOrderRow>(
    `INSERT INTO kontor_orders (owner_id, sector_x, sector_y, item_type, amount_wanted, price_per_unit, budget_reserved, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      order.ownerId,
      order.sectorX,
      order.sectorY,
      order.itemType,
      order.amountWanted,
      order.pricePerUnit,
      order.budgetReserved,
      order.expiresAt,
    ],
  );
  return rowToOrder(rows[0]);
}

export async function getKontorOrderById(id: string): Promise<KontorOrder | null> {
  const { rows } = await query<KontorOrderRow>('SELECT * FROM kontor_orders WHERE id = $1', [id]);
  if (rows.length === 0) return null;
  return rowToOrder(rows[0]);
}

export async function getKontorOrdersBySector(x: number, y: number): Promise<KontorOrder[]> {
  const { rows } = await query<KontorOrderRow>(
    'SELECT * FROM kontor_orders WHERE sector_x = $1 AND sector_y = $2 AND active = TRUE ORDER BY created_at ASC',
    [x, y],
  );
  return rows.map(rowToOrder);
}

export async function getPlayerKontorOrders(ownerId: string): Promise<KontorOrder[]> {
  const { rows } = await query<KontorOrderRow>(
    'SELECT * FROM kontor_orders WHERE owner_id = $1 AND active = TRUE ORDER BY created_at ASC',
    [ownerId],
  );
  return rows.map(rowToOrder);
}

export async function updateKontorOrderFilled(id: string, additionalFilled: number): Promise<void> {
  await query('UPDATE kontor_orders SET amount_filled = amount_filled + $2 WHERE id = $1', [
    id,
    additionalFilled,
  ]);
}

export async function deactivateKontorOrder(id: string): Promise<void> {
  await query('UPDATE kontor_orders SET active = FALSE WHERE id = $1', [id]);
}
