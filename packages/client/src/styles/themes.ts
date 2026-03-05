export const COLOR_PROFILES = {
  'Amber Classic': { primary: '#FFB000', dim: 'rgba(255, 176, 0, 0.6)' },
  'Green Phosphor': { primary: '#00FF66', dim: 'rgba(0, 255, 102, 0.6)' },
  'Ice Blue': { primary: '#00CCFF', dim: 'rgba(0, 204, 255, 0.6)' },
  'High Contrast': { primary: '#FFFFFF', dim: 'rgba(255, 255, 255, 0.6)' },
} as const;

export type ColorProfileName = keyof typeof COLOR_PROFILES;
