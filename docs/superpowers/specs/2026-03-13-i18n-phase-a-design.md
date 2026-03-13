# i18n Phase A — Client-UI Labels — Design Spec

## Goal

Add internationalization infrastructure (react-i18next) to the client and translate all hardcoded UI labels/buttons/status texts to German + English via JSON translation files.

## Scope

**Phase A only:** Client-side UI strings (labels, buttons, status messages). No module names, no server-side strings, no quest/story/NPC text.

This is part of a 3-phase plan:
- **Phase A** (this spec): i18n infrastructure, `ui-strings.ts` migration, Settings toggle, component migration
- Phase B (future): Shared constants — module names, effect labels (~150 strings)
- Phase C (future): Server-side — quests, NPC dialog, personality, errors (~400 strings)

## Existing State: `ui-strings.ts`

The project already has `packages/client/src/ui-strings.ts` — a centralized string constants module with ~90 English strings organized into categories: `actions`, `tabs`, `status`, `empty`, `programs`, `reasons`. It also provides `btn()` and `btnDisabled()` helpers.

**11 component files** currently import from `ui-strings.ts`:
`QuestsScreen`, `TradeScreen`, `NavControls`, `MiningScreen`, `GameScreen`, `BookmarkBar`, `CargoScreen`, `CockpitLayout`, `AlienEncounterToast`, `StationTerminalOverlay`

**Migration strategy:** `ui-strings.ts` gets **deleted**. All its keys move into the i18n JSON files. `btn()` / `btnDisabled()` move to a small utility file (`ui-helpers.ts`) that takes the already-translated string. Components switch from `UI.actions.ACCEPT` to `t('actions.accept')`.

## Architecture

### Dependencies

```
react-i18next
i18next
i18next-browser-languagedetector
```

### New Files

| File | Responsibility |
|------|----------------|
| `packages/client/src/i18n.ts` | i18next initialization: language detector, resources, fallback config |
| `packages/client/src/locales/de/ui.json` | German UI translations (~130 keys) |
| `packages/client/src/locales/en/ui.json` | English UI translations (~130 keys) |
| `packages/client/src/ui-helpers.ts` | `btn()` and `btnDisabled()` helpers (moved from `ui-strings.ts`) |

### Removed Files

| File | Reason |
|------|--------|
| `packages/client/src/ui-strings.ts` | Replaced by i18n JSON files |
| `packages/client/src/__tests__/ui-strings.test.ts` | No longer needed |

### Modified Files

| File | Change |
|------|--------|
| `packages/client/src/main.tsx` | Import `./i18n` before App render |
| `packages/client/src/components/SettingsPanel.tsx` | Add language toggle `[DE] [EN]`, migrate existing German labels ("EINSTELLUNGEN", "PILOT", "FARBE", "HELLIGKEIT", "KOMPENDIUM") |
| 11 components importing `ui-strings` | Switch to `useTranslation()` + `t()` |
| ~20 additional components with hardcoded German | Add `useTranslation()` + `t()` |

### i18n Configuration (`i18n.ts`)

```ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import de from './locales/de/ui.json';
import en from './locales/en/ui.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      de: { ui: de },
      en: { ui: en },
    },
    fallbackLng: false,        // show key when translation missing
    load: 'languageOnly',      // 'de-DE' → 'de', 'en-US' → 'en'
    defaultNS: 'ui',
    ns: ['ui'],
    interpolation: { escapeValue: false },  // React handles escaping
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'vs_language',
      caches: ['localStorage'],
    },
  });

export default i18n;
```

Key decisions:
- `fallbackLng: false` — missing keys show the key string (e.g. `actions.accept`), making gaps visible during development
- `load: 'languageOnly'` (top-level) — normalizes `de-DE` → `de`, `en-US` → `en`
- `vs_language` localStorage key — consistent with existing `vs_admin_mode` naming
- Static imports (no lazy loading) — ~130 keys per language is tiny
- `escapeValue: false` — React already escapes

### Test Setup Mock

Add to `packages/client/src/test/setup.ts`:

```ts
import { vi } from 'vitest';

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
```

This makes `t('actions.accept')` return `'actions.accept'` in tests. Existing test assertions that check for specific German text (e.g. `screen.getByText('KEIN SCHIFF')`) must be updated to check for keys (e.g. `screen.getByText('noShip')`).

### TypeScript Type Safety

Defer full typed keys to Phase B. For Phase A, keys are plain strings. Type augmentation can be added later:

```ts
// Future: packages/client/src/i18n.d.ts
import 'i18next';
import type ui from './locales/en/ui.json';
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'ui';
    resources: { ui: typeof ui };
  }
}
```

### Language Toggle (SettingsPanel)

New section in the existing Settings panel (Sec 4):

```tsx
const { t, i18n } = useTranslation('ui');

<div>
  <span>{t('language')}</span>
  <button onClick={() => i18n.changeLanguage('de')}
          className={i18n.language === 'de' ? 'active' : ''}>DE</button>
  <button onClick={() => i18n.changeLanguage('en')}
          className={i18n.language === 'en' ? 'active' : ''}>EN</button>
</div>
```

### Translation Key Structure

Keys use dot-separated groups matching the original `ui-strings.ts` categories, plus new groups for German-only strings:

```json
{
  "actions.accept": "ACCEPT",
  "actions.cancel": "CANCEL",
  "actions.jump": "JUMP",
  "actions.scan": "SCAN",
  "actions.mine": "MINE",
  "actions.stop": "STOP",
  "actions.undock": "UNDOCK",
  "actions.install": "INSTALL",
  "actions.craft": "CRAFT",
  "actions.sell": "SELL",
  "actions.close": "CLOSE",
  "actions.buy": "BUY",
  "actions.select": "SELECT",

  "tabs.resources": "RESOURCES",
  "tabs.modules": "MODULES",
  "tabs.blueprints": "BLUEPRINTS",
  "tabs.active": "ACTIVE",
  "tabs.available": "AVAILABLE",
  "tabs.story": "STORY",
  "tabs.market": "MARKET",
  "tabs.journal": "JOURNAL",
  "tabs.settings": "SETTINGS",
  "tabs.community": "COMMUNITY",

  "status.loading": "LOADING...",
  "status.active": "ACTIVE",
  "status.idle": "IDLE",
  "status.completed": "COMPLETED",
  "status.autopilotActive": "AUTOPILOT ACTIVE",
  "status.miningLocked": "⚠ MINING ACTIVE — NAV LOCKED",
  "status.tracked": "TRACKED",
  "status.target": "TARGET",
  "status.noShip": "NO SHIP",

  "empty.noQuests": "NO QUESTS (FILTER ACTIVE)",
  "empty.noModules": "NO MODULES IN INVENTORY",
  "empty.noResources": "NO RESOURCES IN THIS SECTOR. NAVIGATE TO AN ASTEROID FIELD OR NEBULA.",

  "reasons.noAp": "NO AP",
  "reasons.cargoFull": "CARGO FULL",
  "reasons.notAtStation": "NOT AT STATION",
  "reasons.apCost": "COSTS {{n}} AP",

  "ship.noShip": "NO SHIP",
  "ship.hoverForDetails": "Hover module for details",
  "ship.traits": "TRAITS",
  "ship.noTraits": "No traits yet",
  "ship.traitsHint": "Traits emerge from XP distribution across 4 paths.",
  "ship.budget": "BUDGET: {{current}}/{{max}} XP",
  "ship.shipEffect": "EFFECT ON SHIP",
  "ship.noStatChanges": "No direct stat changes",
  "ship.replaces": "Replaces",
  "ship.installsIn": "Installs in",
  "ship.hp": "HP",

  "stats.drive": "Drive",
  "stats.cargo": "Cargo",
  "stats.scanner": "Scanner",
  "stats.damage": "Damage",
  "stats.shield": "Shield",
  "stats.hull": "Hull",
  "stats.jumpRange": "Jump Range",

  "repair.repairPerRound": "Repair +{{hp}} HP/round",
  "repair.repairPerSecond": "Repair +{{hp}} HP/s",

  "settings.language": "LANGUAGE",

  "nav.onlyAtStation": "Only at station",
  "nav.bookmark": "BOOKMARK",
  "nav.bookmarked": "BOOKMARKED",

  "programs.navCom": "NAV-COM",
  "programs.mining": "MINING",
  "programs.cargo": "CARGO",
  "programs.quests": "QUESTS",
  "programs.faction": "FACTION",
  "programs.comms": "COMMS",
  "programs.tech": "TECH",
  "programs.quadMap": "QUAD-MAP",
  "programs.tv": "TV",
  "programs.tradingPost": "TRADING POST"
}
```

The German `de/ui.json` has the same keys with German values:
```json
{
  "actions.accept": "ANNEHMEN",
  "actions.cancel": "ABBRECHEN",
  "actions.jump": "SPRINGEN",
  "actions.scan": "SCANNEN",
  "actions.mine": "ABBAUEN",
  "actions.stop": "STOPP",
  "actions.buy": "KAUFEN",
  "actions.select": "AUSWÄHLEN",

  "ship.noShip": "KEIN SCHIFF",
  "ship.hoverForDetails": "Modul hovern für Details",
  "ship.traits": "TRAITS",
  "ship.noTraits": "Noch keine Traits",
  "ship.traitsHint": "Traits entstehen durch XP-Verteilung auf die 4 Pfade.",
  "ship.budget": "BUDGET: {{current}}/{{max}} XP",
  "ship.shipEffect": "AUSWIRKUNG AUF SCHIFF",
  "ship.noStatChanges": "Keine direkten Stat-Änderungen",
  "ship.replaces": "Ersetzt",
  "ship.installsIn": "Installiert in",

  "stats.drive": "Antrieb",
  "stats.cargo": "Cargo",
  "stats.scanner": "Scanner",
  "stats.damage": "Schaden",
  "stats.shield": "Schild",
  "stats.hull": "Rumpf",
  "stats.jumpRange": "Sprungweite",

  "settings.language": "SPRACHE",
  "..."
}
```

(The above is illustrative. Full JSON files will be created during implementation by systematically extracting every string from `ui-strings.ts` (~90 keys) plus all hardcoded German strings from the ~31 components (~40 keys). The implementer must grep for all German text and `UI.` references to ensure completeness.)

### Component Migration Pattern

**Before** (hardcoded German):
```tsx
<div>KEIN SCHIFF</div>
```

**After:**
```tsx
const { t } = useTranslation('ui');
<div>{t('ship.noShip')}</div>
```

**Before** (ui-strings.ts):
```tsx
import { btn, UI } from '../ui-strings';
<button>{btn(UI.actions.JUMP)}</button>
```

**After:**
```tsx
import { btn } from '../ui-helpers';
const { t } = useTranslation('ui');
<button>{btn(t('actions.jump'))}</button>
```

**Interpolation:**
```tsx
// Before: `BUDGET: ${xp.total}/100 XP`
// After:
t('ship.budget', { current: xp.total, max: 100 })
// JSON: "ship.budget": "BUDGET: {{current}}/{{max}} XP"
```

## Acceptance Criteria

- [ ] `react-i18next` + `i18next` + `i18next-browser-languagedetector` installed
- [ ] `i18n.ts` initialized before App render in `main.tsx`
- [ ] `de/ui.json` contains all extracted strings in German
- [ ] `en/ui.json` contains English translations for all keys
- [ ] Both JSON files have identical key sets
- [ ] `ui-strings.ts` removed, `ui-helpers.ts` created with `btn()`/`btnDisabled()`
- [ ] Language auto-detected from browser (`load: 'languageOnly'`)
- [ ] Language toggle in Settings panel switches between DE/EN
- [ ] Language persisted in `localStorage` as `vs_language`
- [ ] Missing keys show the key string (not fallback language)
- [ ] All components use `t()` instead of hardcoded strings
- [ ] `react-i18next` mocked in test setup — all existing tests pass
- [ ] No visual regressions when language is German

## Testing Strategy

- `react-i18next` mocked globally in `src/test/setup.ts` — `t(key)` returns the key
- Existing test assertions updated from German strings to key names
- New test: SettingsPanel language toggle renders DE/EN buttons
- New test: `ui-helpers.ts` — `btn()` and `btnDisabled()` wrap correctly

## Non-Goals (Phase A)

- Module names/displayNames in `constants.ts` (Phase B)
- Server error messages (Phase C)
- Quest/story/NPC text (Phase C)
- TypeScript typed keys (deferred, add in Phase B when keys stabilize)
- Pluralization rules (not needed for Phase A strings)
- RTL support
- Date/number formatting (already using `toLocaleString()`)
