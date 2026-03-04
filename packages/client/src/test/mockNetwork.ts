import { vi } from 'vitest';

export function createMockNetwork() {
  return {
    sendJump: vi.fn(),
    sendScan: vi.fn(),
    sendMine: vi.fn(),
    sendStopMine: vi.fn(),
    sendJettison: vi.fn(),
    requestAP: vi.fn(),
    requestCargo: vi.fn(),
    requestDiscoveries: vi.fn(),
    requestMiningStatus: vi.fn(),
    sendLocalScan: vi.fn(),
    sendAreaScan: vi.fn(),
    sendBuild: vi.fn(),
    sendChat: vi.fn(),
  };
}
