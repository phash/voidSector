import { create } from 'zustand';
import { createGameSlice, type GameSlice } from './gameSlice';
import { createUISlice, type UISlice } from './uiSlice';

export type StoreState = GameSlice & UISlice;

export const useStore = create<StoreState>()((...a) => ({
  ...createGameSlice(...a),
  ...createUISlice(...a),
}));
