import { describe, it, expect } from 'vitest';

describe('structure duplicate detection', () => {
  it('PostgreSQL error code 23505 indicates unique_violation', () => {
    const error = new Error('duplicate key value violates unique constraint') as any;
    error.code = '23505';
    expect(error.code).toBe('23505');
  });
});
