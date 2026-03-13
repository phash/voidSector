import { vi } from 'vitest';
import '@testing-library/jest-dom';
import 'jest-canvas-mock';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (opts) {
        return Object.entries(opts).reduce(
          (s, [k, v]) => s.replace(`{{${k}}}`, String(v)),
          key,
        );
      }
      return key;
    },
    i18n: { changeLanguage: vi.fn(), language: 'de' },
  }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
