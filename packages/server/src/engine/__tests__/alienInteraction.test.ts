/**
 * Tests for AlienInteractionService helper logic — deterministic, no DB needed.
 */
import { describe, it, expect } from 'vitest';

// ── Mirror of math puzzle logic ──

function generateMathPuzzle(seed: number): { sequence: number[]; answer: number } {
  const base = ((seed % 7) + 2) as number;
  const length = 4 + (seed % 3);
  const sequence = Array.from({ length }, (_, i) => base + i * base);
  const answer = sequence[length - 1] + base;
  return { sequence, answer };
}

// ── Mirror of symbol puzzle logic ──

const MYCELIAN_SYMBOLS = ['▣', '○', '△', '◈', '✦', '⬡', '⊕'];

function generateSymbolPuzzle(seed: number): { shown: string[]; correct: string } {
  const idx = seed % MYCELIAN_SYMBOLS.length;
  const size = 3 + (seed % 3);
  const pattern = Array.from({ length: size }, (_, i) => MYCELIAN_SYMBOLS[(idx + i) % MYCELIAN_SYMBOLS.length]);
  const correct = MYCELIAN_SYMBOLS[(idx + size) % MYCELIAN_SYMBOLS.length];
  return { shown: pattern, correct };
}

// ── K'thari rank assignment ──

const KTHARI_RANKS = [
  { rank: 4, name: 'Ehrenmitglied', minVictories: 50 },
  { rank: 3, name: 'Krieger', minVictories: 20 },
  { rank: 2, name: 'Verbündeter', minVictories: 5 },
  { rank: 1, name: 'Beobachter', minVictories: 1 },
  { rank: 0, name: 'Eindringling', minVictories: 0 },
];

function getKthariRank(victories: number) {
  return KTHARI_RANKS.find((r) => victories >= r.minVictories)!;
}

describe('alienInteraction — math puzzles (Axioms)', () => {
  it('generates a valid arithmetic sequence', () => {
    const { sequence, answer } = generateMathPuzzle(5);
    // Each element = base * index
    const base = ((5 % 7) + 2);
    expect(sequence[0]).toBe(base);
    expect(sequence[1]).toBe(base * 2);
    // Answer follows the pattern
    expect(answer).toBe(sequence[sequence.length - 1] + base);
  });

  it('is deterministic for same seed', () => {
    const a = generateMathPuzzle(42);
    const b = generateMathPuzzle(42);
    expect(a.sequence).toEqual(b.sequence);
    expect(a.answer).toBe(b.answer);
  });

  it('produces different puzzles for different seeds', () => {
    const a = generateMathPuzzle(1);
    const b = generateMathPuzzle(8);
    expect(a.sequence).not.toEqual(b.sequence);
  });

  it('answer always follows arithmetic pattern', () => {
    for (const seed of [0, 1, 5, 10, 42, 99]) {
      const { sequence, answer } = generateMathPuzzle(seed);
      const step = sequence[1] - sequence[0];
      expect(answer).toBe(sequence[sequence.length - 1] + step);
    }
  });
});

describe('alienInteraction — symbol puzzles (Mycelians)', () => {
  it('produces valid Mycelian symbols', () => {
    const { shown, correct } = generateSymbolPuzzle(3);
    for (const sym of shown) {
      expect(MYCELIAN_SYMBOLS).toContain(sym);
    }
    expect(MYCELIAN_SYMBOLS).toContain(correct);
  });

  it('is deterministic', () => {
    const a = generateSymbolPuzzle(7);
    const b = generateSymbolPuzzle(7);
    expect(a.shown).toEqual(b.shown);
    expect(a.correct).toBe(b.correct);
  });

  it('correct answer is next in sequence', () => {
    const seed = 2;
    const { shown, correct } = generateSymbolPuzzle(seed);
    const idx = seed % MYCELIAN_SYMBOLS.length;
    const expectedNext = MYCELIAN_SYMBOLS[(idx + shown.length) % MYCELIAN_SYMBOLS.length];
    expect(correct).toBe(expectedNext);
  });
});

describe('alienInteraction — K\'thari rank', () => {
  it('returns rank 0 for 0 victories', () => {
    expect(getKthariRank(0).rank).toBe(0);
    expect(getKthariRank(0).name).toBe('Eindringling');
  });

  it('returns rank 1 for 1-4 victories', () => {
    expect(getKthariRank(1).rank).toBe(1);
    expect(getKthariRank(4).rank).toBe(1);
  });

  it('returns rank 2 for 5-19 victories', () => {
    expect(getKthariRank(5).rank).toBe(2);
    expect(getKthariRank(19).rank).toBe(2);
  });

  it('returns rank 3 for 20-49 victories', () => {
    expect(getKthariRank(20).rank).toBe(3);
    expect(getKthariRank(49).rank).toBe(3);
  });

  it('returns rank 4 for 50+ victories', () => {
    expect(getKthariRank(50).rank).toBe(4);
    expect(getKthariRank(1000).rank).toBe(4);
  });
});
