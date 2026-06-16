import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('starter ship', () => {
  it('pre-installs computer_mk1 so new players can use AUTOMAT', () => {
    const src = readFileSync(join(__dirname, '../db/queries.ts'), 'utf-8');
    expect(src).toMatch(/computer_mk1[\s\S]{0,80}slotIndex:\s*9/);
  });
});
