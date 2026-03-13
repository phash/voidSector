import { useTranslation } from 'react-i18next';
import { useStore } from '../state/store';
import { SectorArtwork } from './SectorArtwork';

const panelStyle: React.CSSProperties = {
  padding: '12px',
  fontFamily: 'var(--font-mono)',
  color: 'var(--color-primary)',
  fontSize: '0.7rem',
  height: '100%',
  overflow: 'auto',
};

export function TradeDetailPanel() {
  const { t } = useTranslation('ui');
  const currentSector = useStore((s) => s.currentSector);
  const npcStationData = useStore((s) => s.npcStationData);
  const cargo = useStore((s) => s.cargo);

  const isStation = currentSector?.type === 'station';

  if (!isStation || !npcStationData) {
    return (
      <div
        style={{
          ...panelStyle,
          color: 'var(--color-dim)',
          textAlign: 'center',
          marginTop: 24,
        }}
      >
        {t('trade.noTradeAvailable')}
      </div>
    );
  }

  return (
    <div style={panelStyle}>
      <SectorArtwork
        sectorType="station"
        stationVariant={(currentSector?.metadata as any)?.stationVariant}
      />
      <div
        style={{
          fontSize: '0.75rem',
          fontWeight: 'bold',
          marginBottom: 4,
          letterSpacing: '0.1em',
        }}
      >
        {npcStationData.name}
      </div>

      <div style={{ color: 'var(--color-dim)', marginBottom: 8 }}>LEVEL {npcStationData.level}</div>

      <div
        style={{
          fontSize: '0.6rem',
          letterSpacing: '0.1em',
          color: 'var(--color-dim)',
          marginBottom: 4,
        }}
      >
        {t('trade.angebot')}
      </div>

      {npcStationData.inventory.map((item) => (
        <div
          key={item.itemType}
          style={{
            marginBottom: 4,
            borderBottom: '1px solid var(--color-dim)',
            paddingBottom: 4,
          }}
        >
          <div>{item.itemType.toUpperCase()}</div>
          <div style={{ color: 'var(--color-dim)', fontSize: '0.6rem' }}>
            {t('trade.kauf')}: {item.buyPrice} CR | {t('trade.verkauf')}: {item.sellPrice} CR
          </div>
          <div style={{ color: 'var(--color-dim)', fontSize: '0.6rem' }}>
            {t('trade.lager')}: {item.stock}/{item.maxStock}
          </div>
          <div style={{ fontSize: '0.6rem' }}>
            {t('trade.fracht')}: {cargo[item.itemType as keyof typeof cargo] ?? 0}
          </div>
        </div>
      ))}
    </div>
  );
}
