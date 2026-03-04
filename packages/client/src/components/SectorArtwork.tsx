import { getStationArtwork } from '../assets/stations';
import { getAlienArtwork } from '../assets/aliens';

const SECTOR_ASCII: Record<string, string[]> = {
  asteroid_field: [
    '    .  *  .',
    '  *  ___  .',
    ' . /   \\  *',
    '  | * * | .',
    '   \\___/',
    '  *  .  *',
  ],
  nebula: [
    '  . ~ ~ ~ .',
    ' ~ . * . ~ ~',
    '~ * . ~ . * ~',
    ' ~ ~ . ~ ~ ~',
    '  . ~ * ~ .',
  ],
  station: [
    '   [===]',
    '  /|   |\\',
    ' / | H | \\',
    '|  |___|  |',
    ' \\_______/',
  ],
  anomaly: [
    '   / \\ / \\',
    '  | ? ? ? |',
    '   \\ | / ',
    '    \\|/',
    '     *',
  ],
  pirate: [
    '    _____',
    '   / x x \\',
    '  |  ___  |',
    '   \\/ | \\/',
    '      |',
  ],
};

interface SectorArtworkProps {
  sectorType: string;
  stationVariant?: string;
  faction?: string;
}

export function SectorArtwork({ sectorType, stationVariant, faction }: SectorArtworkProps) {
  let svgUrl: string | undefined;
  if (sectorType === 'station') {
    svgUrl = getStationArtwork(stationVariant ?? 'trading_post')
      ?? getStationArtwork(faction ?? 'independent')
      ?? undefined;
  } else {
    svgUrl = getAlienArtwork(sectorType) ?? undefined;
  }

  if (svgUrl) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        padding: '8px 0',
      }}>
        <img
          src={svgUrl}
          alt={sectorType}
          style={{
            width: '100%',
            maxWidth: 180,
            maxHeight: 120,
            height: 'auto',
            filter: 'drop-shadow(0 0 6px var(--color-primary))',
            opacity: 0.85,
          }}
        />
      </div>
    );
  }

  const ascii = SECTOR_ASCII[sectorType];
  if (!ascii) return null;

  return (
    <div style={{
      fontFamily: "'Share Tech Mono', monospace",
      fontSize: '0.6rem',
      lineHeight: 1.3,
      color: 'var(--color-primary)',
      textAlign: 'center',
      opacity: 0.7,
      padding: '4px 0',
    }}>
      {ascii.map((line, i) => (
        <div key={i} style={{ whiteSpace: 'pre' }}>{line}</div>
      ))}
    </div>
  );
}
