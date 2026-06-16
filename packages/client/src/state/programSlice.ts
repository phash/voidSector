import type { StateCreator } from 'zustand';

export interface ShipProgramItem {
  id: string;
  name: string;
  source: string;
  mode: string;
  is_active: boolean;
}

export interface ShipProgramRun {
  status: string;
  pc: number;
}

export interface ProgramSlice {
  shipPrograms: ShipProgramItem[];
  activeShipProgramId: string | null;
  shipProgramRun: ShipProgramRun | null;
  shipProgramLog: string[];
  setShipPrograms: (p: ShipProgramItem[]) => void;
  setActiveShipProgramId: (id: string | null) => void;
  setShipProgramRun: (r: ShipProgramRun | null) => void;
  appendShipProgramLog: (line: string) => void;
}

export const createProgramSlice: StateCreator<ProgramSlice, [], [], ProgramSlice> = (set) => ({
  shipPrograms: [],
  activeShipProgramId: null,
  shipProgramRun: null,
  shipProgramLog: [],
  setShipPrograms: (shipPrograms) =>
    set({ shipPrograms, activeShipProgramId: shipPrograms.find((p) => p.is_active)?.id ?? null }),
  setActiveShipProgramId: (activeShipProgramId) => set({ activeShipProgramId }),
  setShipProgramRun: (shipProgramRun) => set({ shipProgramRun }),
  appendShipProgramLog: (line) =>
    set((s) => ({ shipProgramLog: [...s.shipProgramLog, line].slice(-200) })),
});
