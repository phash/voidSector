import { useMemo } from 'react';
import { useStore } from '../state/store';
import { MONITORS } from '@void-sector/shared';

export const MOBILE_HOME_ID = '__HOME__';

export interface MobileTab {
  id: string;
  icon: string;
  label: string;
  isMehr?: boolean;
}

const TAB_HOME: MobileTab = { id: MOBILE_HOME_ID, icon: '\u2302', label: 'HOME' };
const TAB_NAV: MobileTab = { id: MONITORS.NAV_COM, icon: '\u25C9', label: 'NAV' };
const TAB_MINE: MobileTab = { id: MONITORS.MINING, icon: '\u26CF', label: 'MINE' };
const TAB_QUESTS: MobileTab = { id: MONITORS.QUESTS, icon: '\u2605', label: 'QUESTS' };
const TAB_MEHR: MobileTab = { id: '__MEHR__', icon: '\u2630', label: 'MEHR', isMehr: true };

const FIXED_TABS: MobileTab[] = [TAB_HOME, TAB_NAV, TAB_MINE, TAB_QUESTS, TAB_MEHR];

/** All monitors shown in the MEHR overflow grid. */
export const MEHR_MONITORS: Array<{ id: string; icon: string; label: string }> = [
  { id: MONITORS.SHIP_SYS, icon: '\u2699', label: 'SHIP-SYS' },
  { id: MONITORS.COMMS, icon: '\u2318', label: 'COMMS' },
  { id: MONITORS.TRADE, icon: '\u25A4', label: 'HANDEL' },
  { id: MONITORS.BASE_LINK, icon: '\u2302', label: 'BASE' },
  { id: MONITORS.FACTION, icon: '\u2694', label: 'FRAKTION' },
  { id: MONITORS.TECH, icon: '\u2697', label: 'TECH' },
  { id: MONITORS.QUAD_MAP, icon: '\u25A6', label: 'QUAD-MAP' },
  { id: MONITORS.LOG, icon: '\u25B6', label: 'LOG' },
  { id: MONITORS.NEWS, icon: '\u2261', label: 'NEWS' },
  { id: MONITORS.ACEP, icon: '\u26C9', label: 'ACEP' },
];

/**
 * Mobile tabs hook — returns the fixed 5-tab structure for the new mobile layout:
 *   HOME · NAV · MINE · QUESTS · MEHR
 *
 * SHIP-SYS and COMMS moved to MEHR grid.
 * CARGO is shown inline in the MINE tab.
 */
export function useMobileTabs() {
  const alerts = useStore((s) => s.alerts);

  const mehrAlertCount = useMemo(
    () => MEHR_MONITORS.filter((m) => alerts[m.id]).length,
    [alerts],
  );

  return { tabs: FIXED_TABS, mehrMonitors: MEHR_MONITORS, mehrAlertCount };
}
