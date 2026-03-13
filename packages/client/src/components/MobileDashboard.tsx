import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../state/store';
import { network } from '../network/client';
import { MONITORS } from '@void-sector/shared';

function MiningCard() {
  const { t } = useTranslation('ui');
  const mining = useStore((s) => s.mining);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!mining?.active || mining.startedAt === null) {
      setElapsed(0);
      return;
    }
    const startedAt = mining.startedAt;
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [mining?.active, mining?.startedAt]);

  const progress =
    mining?.active && mining.sectorYield > 0
      ? Math.min(1, (elapsed * (mining.rate ?? 1)) / mining.sectorYield)
      : 0;

  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');

  return (
    <div
      className="mobile-dashboard-card"
      style={mining?.active ? { borderColor: 'var(--color-primary)' } : undefined}
    >
      <div className="mobile-dashboard-card-row">
        <span className="mobile-card-title">{t('mobile.mining')}</span>
        {mining?.active ? (
          <span className="mobile-card-status-active">
            {t('mobile.miningActive', { mm, ss })}
          </span>
        ) : (
          <span className="mobile-card-status-dim">{t('mobile.miningInactive')}</span>
        )}
        {mining?.active && (
          <button
            className="mobile-card-stop-btn"
            onClick={() => network.sendStopMine()}
            aria-label="Stop mining"
          >
            STOP
          </button>
        )}
      </div>
      {mining?.active && mining.resource && (
        <div className="mobile-card-subtitle">{mining.resource.toUpperCase()}</div>
      )}
      <div className="mobile-progress-bar">
        <div
          className="mobile-progress-fill"
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </div>
    </div>
  );
}

function CargoCard() {
  const { t } = useTranslation('ui');
  const cargo = useStore((s) => s.cargo);
  const ship = useStore((s) => s.ship);
  const currentSector = useStore((s) => s.currentSector);

  const used = (cargo?.ore ?? 0) + (cargo?.gas ?? 0) + (cargo?.crystal ?? 0);
  const cap = (ship as any)?.stats?.cargoCap ?? 5;
  const pct = cap > 0 ? used / cap : 0;
  const atStation = (currentSector as any)?.contents?.includes('station') ?? false;

  return (
    <div className="mobile-dashboard-card">
      <div className="mobile-dashboard-card-row">
        <span className="mobile-card-title">{t('mobile.cargo')}</span>
        <span>
          {used} / {cap}
        </span>
        {atStation && (
          <button
            className="mobile-card-action-btn"
            onClick={() => useStore.getState().setActiveMonitor(MONITORS.TRADE)}
          >
            {t('mobile.sell')}
          </button>
        )}
      </div>
      <div className="mobile-progress-bar">
        <div
          className="mobile-progress-fill"
          style={{
            width: `${Math.round(pct * 100)}%`,
            background: pct > 0.8 ? '#ff4444' : 'var(--color-primary)',
          }}
        />
      </div>
    </div>
  );
}

function NextDestCard() {
  const { t } = useTranslation('ui');
  const bookmarks = useStore((s) => s.bookmarks);
  const setActiveMonitor = useStore((s) => s.setActiveMonitor);

  if (!bookmarks || bookmarks.length === 0) return null;

  const first = bookmarks[0];

  return (
    <div className="mobile-dashboard-card">
      <div className="mobile-dashboard-card-row">
        <span className="mobile-card-title">{t('mobile.nextDest')}</span>
      </div>
      <div className="mobile-dashboard-card-row">
        <span className="mobile-card-subtitle">
          ⭐ {first.label} ({first.sectorX}/{first.sectorY})
        </span>
        <button
          className="mobile-card-action-btn"
          onClick={() => setActiveMonitor(MONITORS.NAV_COM)}
        >
          {t('mobile.fly')}
        </button>
      </div>
    </div>
  );
}

function SlowFlightCard() {
  const { t } = useTranslation('ui');
  const slowFlightActive = useStore((s) => s.slowFlightActive);
  const autopilot = useStore((s) => s.autopilot);

  if (!slowFlightActive || !autopilot?.active) return null;

  return (
    <div className="mobile-dashboard-card" style={{ borderColor: 'var(--color-primary)' }}>
      <div className="mobile-dashboard-card-row">
        <span className="mobile-card-title">{t('mobile.slowFlight')}</span>
        <button
          className="mobile-card-stop-btn"
          onClick={() => network.sendCancelAutopilot()}
        >
          STOP
        </button>
      </div>
      <div className="mobile-card-subtitle">
        → ({autopilot.targetX}/{autopilot.targetY}) · {t('mobile.sectors', { n: autopilot.remaining })}
      </div>
    </div>
  );
}

function ApBar() {
  const ap = useStore((s) => s.ap);
  const current = ap?.current ?? 0;
  const max = ap?.max ?? 100;
  const pct = max > 0 ? current / max : 0;

  return (
    <div className="mobile-dashboard-card mobile-ap-bar">
      <div className="mobile-dashboard-card-row">
        <span className="mobile-card-title">AP</span>
        <span>
          {Math.round(current)} / {max}
        </span>
      </div>
      <div className="mobile-progress-bar">
        <div className="mobile-progress-fill" style={{ width: `${Math.round(pct * 100)}%` }} />
      </div>
    </div>
  );
}

export function MobileDashboard() {
  return (
    <div className="mobile-dashboard">
      <SlowFlightCard />
      <MiningCard />
      <CargoCard />
      <NextDestCard />
      <ApBar />
    </div>
  );
}
