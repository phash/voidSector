import { useMemo } from 'react';
import { useStore } from '../state/store';
import { MONITORS } from '@void-sector/shared';

export interface MobileTab {
  id: string;
  icon: string;
  label: string;
  isMehr?: boolean;
}

/** Fixed tab positions (always visible in mobile tab bar). */
const TAB_NAV: MobileTab = { id: MONITORS.NAV_COM, icon: '\u25C9', label: 'NAV' };
const TAB_SHIP: MobileTab = { id: MONITORS.SHIP_SYS, icon: '\u2699', label: 'SHIP' };
const TAB_CARGO: MobileTab = { id: MONITORS.CARGO, icon: '\u25A4', label: 'CARGO' };
const TAB_TRADE: MobileTab = { id: MONITORS.TRADE, icon: '\u25A4', label: 'TRADE' };
const TAB_COMMS: MobileTab = { id: MONITORS.COMMS, icon: '\u2318', label: 'COMMS' };
const TAB_MEHR: MobileTab = { id: '__MEHR__', icon: '\u2630', label: 'MEHR', isMehr: true };

/** All monitors that can appear in the MEHR overflow grid. */
export const MEHR_MONITORS: Array<{ id: string; icon: string; label: string }> = [
  { id: MONITORS.MINING, icon: '\u26CF', label: 'MINING' },
  { id: MONITORS.BASE_LINK, icon: '\u2302', label: 'BASE' },
  { id: MONITORS.FACTION, icon: '\u2694', label: 'FRAKTION' },
  { id: MONITORS.QUESTS, icon: '\u2605', label: 'AUFTR\u00C4GE' },
  { id: MONITORS.TECH, icon: '\u2697', label: 'TECH' },
  { id: MONITORS.QUAD_MAP, icon: '\u25A6', label: 'QUAD-MAP' },
  { id: MONITORS.LOG, icon: '\u25B6', label: 'LOG' },
  { id: MONITORS.CARGO, icon: '\u25A4', label: 'CARGO' },
  { id: MONITORS.TRADE, icon: '\u25A4', label: 'HANDEL' },
];

/**
 * Context-aware mobile tabs hook.
 *
 * Returns 5 tabs:
 *  1. NAV (always NAV-COM)
 *  2. SHIP (always SHIP-SYS)
 *  3. Contextual: CARGO normally, TRADE when at a station
 *  4. COMMS (always COMMS)
 *  5. MEHR (opens overlay with remaining monitors)
 *
 * Also returns:
 *  - `mehrAlertCount`: number of monitors in the MEHR list with active alerts
 *  - `mehrMonitors`: the list of monitors shown in the MEHR overlay
 *    (excludes whichever monitor is shown in the contextual tab 3 slot)
 */
export function useMobileTabs() {
  const currentSector = useStore((s) => s.currentSector);
  const alerts = useStore((s) => s.alerts);

  const atStation = currentSector?.contents?.includes('station') ?? false;

  const tabs: MobileTab[] = useMemo(() => {
    const contextualTab = atStation ? TAB_TRADE : TAB_CARGO;
    return [TAB_NAV, TAB_SHIP, contextualTab, TAB_COMMS, TAB_MEHR];
  }, [atStation]);

  // Monitors in the MEHR overlay: all overflow monitors except
  // the one that's already shown in the contextual slot
  const mehrMonitors = useMemo(() => {
    const contextualId = atStation ? MONITORS.TRADE : MONITORS.CARGO;
    return MEHR_MONITORS.filter((m) => m.id !== contextualId);
  }, [atStation]);

  // Count alerts on monitors that are in the MEHR overflow list
  const mehrAlertCount = useMemo(() => {
    return mehrMonitors.filter((m) => alerts[m.id]).length;
  }, [mehrMonitors, alerts]);

  return { tabs, mehrMonitors, mehrAlertCount, atStation };
}
