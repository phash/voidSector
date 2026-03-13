import { useTranslation } from 'react-i18next';
import { useStore } from '../state/store';
import { network } from '../network/client';

type MineResource = 'ore' | 'gas' | 'crystal';

const RESOURCE_LABELS: Record<MineResource, string> = {
  ore: 'ORE',
  gas: 'GAS',
  crystal: 'CRYSTAL',
};

interface ResourceCardProps {
  resource: MineResource;
  current: number;
  max: number;
  miningActive: boolean;
  miningResource: string | null;
}

function ResourceCard({ resource, current, max, miningActive, miningResource }: ResourceCardProps) {
  const isThisResourceMining = miningActive && miningResource === resource;
  const pct = max > 0 ? current / max : 0;
  const depleted = current <= 0;

  return (
    <div className="mobile-mine-card">
      <div className="mobile-dashboard-card-row">
        <span className="mobile-card-title">{RESOURCE_LABELS[resource]}</span>
        <span className="mobile-card-value">
          {current} / {max}
        </span>
        {isThisResourceMining ? (
          <button
            className="mobile-card-stop-btn"
            onClick={() => network.sendStopMine()}
            aria-label="Stop"
          >
            STOP
          </button>
        ) : (
          !depleted && !miningActive && (
            <button
              className="mobile-card-action-btn"
              onClick={() => network.sendMine(resource, false)}
              aria-label="MINE"
            >
              MINE
            </button>
          )
        )}
      </div>
      <div className="mobile-progress-bar">
        <div className="mobile-progress-fill" style={{ width: `${Math.round(pct * 100)}%` }} />
      </div>
    </div>
  );
}

export function MobileMineTab() {
  const { t } = useTranslation('ui');
  const currentSector = useStore((s) => s.currentSector);
  const mining = useStore((s) => s.mining);
  const cargo = useStore((s) => s.cargo);
  const ship = useStore((s) => s.ship);

  const resources = (currentSector as any)?.resources;
  const isMineable = currentSector?.type === 'asteroid_field' || currentSector?.type === 'nebula';

  const used = (cargo?.ore ?? 0) + (cargo?.gas ?? 0) + (cargo?.crystal ?? 0);
  const cap = (ship as any)?.stats?.cargoCap ?? 5;

  if (!isMineable || !resources) {
    return (
      <div className="mobile-mine-tab">
        <div className="mobile-mine-no-sector">
          {t('mobile.noMiningInSector')}
        </div>
      </div>
    );
  }

  const resourceList: MineResource[] = ['ore', 'gas', 'crystal'];
  const maxMap: Record<MineResource, number> = {
    ore: resources.maxOre ?? resources.ore,
    gas: resources.maxGas ?? resources.gas,
    crystal: resources.maxCrystal ?? resources.crystal,
  };
  const currentMap: Record<MineResource, number> = {
    ore: resources.ore,
    gas: resources.gas,
    crystal: resources.crystal,
  };

  // First available resource for Mine-All
  const firstAvailable = resourceList.find((r) => currentMap[r] > 0);

  return (
    <div className="mobile-mine-tab">
      {/* Sector header */}
      <div className="mobile-mine-header">
        {currentSector?.type?.toUpperCase()} ({(currentSector as any)?.x}/{(currentSector as any)?.y})
      </div>

      {/* Resource cards */}
      {resourceList.map((r) => (
        <ResourceCard
          key={r}
          resource={r}
          current={currentMap[r]}
          max={maxMap[r]}
          miningActive={!!mining?.active}
          miningResource={(mining as any)?.resource ?? null}
        />
      ))}

      {/* Cargo inline */}
      <div className="mobile-mine-cargo-row">
        <span>{t('mobile.cargo')} {used} / {cap}</span>
      </div>

      {/* Mine-All */}
      {firstAvailable && !mining?.active && (
        <div className="mobile-mine-all-row">
          <button
            className="mobile-mine-all-btn"
            onClick={() => network.sendMine(firstAvailable, true)}
            aria-label={t('mobile.mineAll')}
          >
            {t('mobile.mineAll')}
          </button>
        </div>
      )}
    </div>
  );
}
