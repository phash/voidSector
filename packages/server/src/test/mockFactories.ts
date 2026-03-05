import type { QueryResult, FieldDef } from 'pg';

export function mockQueryResult<T extends Record<string, unknown> = Record<string, unknown>>(
  rows: T[] = [],
  command: string = 'SELECT',
  rowCount?: number,
): QueryResult<T> {
  return {
    rows,
    rowCount: rowCount ?? rows.length,
    command,
    oid: 0,
    fields: [] as FieldDef[],
  };
}
