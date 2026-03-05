import { create } from 'zustand';
import { createGameSlice, type GameSlice } from './gameSlice';
import { createUISlice, type UISlice } from './uiSlice';
import { createHelpSlice, type HelpSlice } from './helpSlice';

export type StoreState = GameSlice & UISlice & HelpSlice;

export const useStore = create<StoreState>()((...a) => ({
  ...createGameSlice(...a),
  ...createUISlice(...a),
  ...createHelpSlice(...a),
}));
