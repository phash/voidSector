// jest-canvas-mock is a CommonJS library that references `jest.fn()` and
// `jest.isMockFunction()` at load time. Vitest does not expose a global `jest`
// object, so we provide a shim that delegates to vitest's `vi`.
// This file MUST be listed before any setup file that imports jest-canvas-mock.
import { vi } from 'vitest';

(globalThis as any).jest = {
  fn: (...args: any[]) => vi.fn(...args),
  isMockFunction: (fn: any) => vi.isMockFunction(fn),
  spyOn: (...args: any[]) => (vi.spyOn as any)(...args),
};
