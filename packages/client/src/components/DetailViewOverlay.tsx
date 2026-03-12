import { useStore } from '../state/store';
import { getStationArtwork } from '../assets/stations';
import { getAlienArtwork } from '../assets/aliens';

const SECTOR_ART: Record<string, string[]> = {
  ancient_station: [
    '  ≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋  ',
    ' ≋ ⟨════════════════⟩ ≋ ',
    '≋≋ ║  ◈  ANCIENT  ◈  ║ ≋≋',
    ' ≋ ║   XENOSTATION   ║ ≋ ',
    '≋≋ ╠═══════╦═════════╣ ≋≋',
    ' ≋ ║ ◆◇◆◇◆ ║ ●○●○●○● ║ ≋ ',
    '≋≋ ║ ◇◆◇◆◇ ║ ○●○●○●○ ║ ≋≋',
    ' ≋ ╠═══════╩═════════╣ ≋ ',
    '≋≋ ║   CORE: ACTIVE   ║ ≋≋',
    ' ≋ ║  ORIGIN: UNKNOWN  ║ ≋ ',
    '≋≋ ⟨════════════════⟩ ≋≋',
    '  ≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋  ',
  ],
  station: [
    '          ╔════╗          ',
    '  ════════╬════╬════════  ',
    '  ║  ╔════╩════╩════╗  ║  ',
    '  ║  ║   COMMAND    ║  ║  ',
    '════╬══╣  CORE  ╠══╬════  ',
    '  ║  ║   DECK   ║  ║  ║  ',
    '  ║  ╚════╦════╦╝  ║  ║  ',
    '  ════════╬════╬════════  ',
    '          ║    ║          ',
    '        ╔═╩════╩═╗        ',
    '        ║ DOCKING ║        ',
    '        ╚═════════╝        ',
  ],
  asteroid_field: [
    '                           ',
    '   ╱▓▓╲       ╱▓▓▓╲       ',
    '  ╱▓░░▓▓╲   ╱▓▓░░▓▓╲      ',
    ' │▓░░░░▓▓│ │▓▓░░░░▓▓│     ',
    ' │▓▓░░░▓▓│  ╲▓▓░░▓▓╱      ',
    '  ╲▓░░▓▓╱    ╲▓▓▓▓╱       ',
    '   ╲▓▓╱                   ',
    '        ╱▓▓▓▓╲            ',
    '       ╱▓░░░░▓╲           ',
    '      │▓░░▓▓░░▓│          ',
    '       ╲▓░░░░▓╱           ',
    '        ╲▓▓▓▓╱            ',
  ],
  nebula: [
    '   ·  .  ·    ·  .     ',
    '  . ·░░░░░·  ·  .  ·   ',
    ' ·░░░▒▒▒░░░░·    .     ',
    '░░▒▒▒▓▓▓▒▒░░░  ·   ·  ',
    '░▒▓▓▓████▓▒▒░░░  .     ',
    '░░▒▒▓▓▓▓▒▒░░░  ·   .  ',
    '  ·░░░▒▒░░░·    ·      ',
    '   · .░░░·  .  ·   ·   ',
    '    ·   .   ·     .    ',
  ],
  anomaly: [
    '   .   *   .   *   .   ',
    ' *  ╱───────────╲  *  ',
    '   │  ~ ~ ~ ~ ~  │     ',
    ' . │  ╔═══════╗  │ .   ',
    '   │  ║ ANOMALY║  │    ',
    ' * │  ║ [~~~] ║  │ *   ',
    '   │  ║ ACTIVE║  │     ',
    ' . │  ╚═══════╝  │ .   ',
    '   │  ~ ~ ~ ~ ~  │     ',
    ' *  ╲───────────╱  *  ',
    '   .   *   .   *   .   ',
  ],
  pirate: [
    '  ╔═════════════════╗  ',
    '  ║  /\\/\\/\\/\\/\\  ║  ',
    '  ╠═════════════════╣  ',
    '  ║   X  DANGER  X  ║  ',
    '  ╠═════════════════╣  ',
    '  ║  PIRATE SECTOR  ║  ',
    '  ║  UNAUTHORIZED   ║  ',
    '  ║  ENTRY RISK:    ║  ',
    '  ║  >> EXTREME <<  ║  ',
    '  ╠═════════════════╣  ',
    '  ║  \\/\\/\\/\\/\\/  ║  ',
    '  ╚═════════════════╝  ',
  ],
  planet: [
    '        ╭──────╮        ',
    '      ╭─┤░░░░░░├─╮      ',
    '    ╭─┤░░▒▒▒▒░░░░├─╮    ',
    '    │░░░▒▒████▒▒░░░│    ',
    '    │░░▒▒████████▒░│    ',
    '    │░░░▒▒████▒▒░░░│    ',
    '    ╰─┤░░▒▒▒▒░░░░├─╯    ',
    '      ╰─┤░░░░░░├─╯      ',
    '        ╰──────╯        ',
  ],
  empty: [
    '                         ',
    '   ·         ·     ·    ',
    '       ·          ·     ',
    '  ·         ·           ',
    '      ·   VOID  ·       ',
    '   ·         ·      ·   ',
    '       ·         ·      ',
    '  ·         ·     ·     ',
    '                         ',
  ],
  ship: [
    '          ╱▲╲           ',
    '         ╱   ╲          ',
    '        ╱     ╲         ',
    '       ╱  [S]  ╲        ',
    '   ═══╡  SHIP   ╞═══    ',
    '      │  SYS    │       ',
    '   ═══╡  ACTIVE ╞═══    ',
    '      │        │        ',
    '      └──┬┬───┘         ',
    '         ╲╱             ',
  ],
};

export function DetailViewOverlay() {
  const detailView = useStore((s) => s.detailView);
  const setDetailView = useStore((s) => s.setDetailView);

  if (!detailView) return null;

  const isAncient = detailView.type === 'station' && detailView.data?.stationVariant === 'ancient';
  const artKey = isAncient ? 'ancient_station' : detailView.type;
  const art = SECTOR_ART[artKey] ?? SECTOR_ART.empty;
  const sectorType = isAncient
    ? 'ANCIENT XENOSTATION'
    : detailView.type.toUpperCase().replace('_', ' ');

  // Resolve SVG artwork for stations and aliens
  const svgUrl =
    detailView.type === 'station'
      ? (getStationArtwork(detailView.data?.stationVariant ?? 'trading_post') ??
        getStationArtwork(detailView.data?.faction ?? 'independent'))
      : (getAlienArtwork(detailView.type) ?? undefined);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(5, 5, 5, 0.95)',
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
        padding: '16px',
        overflow: 'auto',
      }}
    >
      <button
        className="vs-btn"
        style={{
          position: 'absolute',
          top: 8,
          right: 8,
          fontSize: '1rem',
          padding: '2px 8px',
          zIndex: 11,
        }}
        onClick={() => setDetailView(null)}
      >
        [X]
      </button>

      <div
        style={{
          fontSize: '0.9rem',
          letterSpacing: '0.2em',
          marginBottom: 16,
          borderBottom: '1px solid var(--color-dim)',
          paddingBottom: 8,
        }}
      >
        DETAIL VIEW — {sectorType}
      </div>

      {svgUrl ? (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            marginBottom: 16,
          }}
        >
          <img
            src={svgUrl}
            alt={sectorType}
            style={{
              width: '100%',
              maxWidth: 280,
              height: 'auto',
              filter: 'drop-shadow(0 0 8px var(--color-primary))',
            }}
          />
        </div>
      ) : (
        <div
          style={{
            fontFamily: "'Share Tech Mono', 'Courier New', monospace",
            fontSize: '1.1rem',
            lineHeight: 1.4,
            color: 'var(--color-primary)',
            textAlign: 'center',
            marginBottom: 16,
            textShadow: '0 0 8px var(--color-primary)',
          }}
        >
          {art.map((line, i) => (
            <div key={i} style={{ whiteSpace: 'pre' }}>
              {line}
            </div>
          ))}
        </div>
      )}

      <div
        style={{
          fontSize: '0.8rem',
          letterSpacing: '0.1em',
          color: 'var(--color-dim)',
          lineHeight: 1.6,
        }}
      >
        {detailView.data?.name && (
          <div>
            NAME: <span style={{ color: 'var(--color-primary)' }}>{detailView.data.name}</span>
          </div>
        )}
        {detailView.data?.position && (
          <div>
            POSITION:{' '}
            <span style={{ color: 'var(--color-primary)' }}>{detailView.data.position}</span>
          </div>
        )}
        {detailView.data?.faction && (
          <div>
            FACTION:{' '}
            <span style={{ color: 'var(--color-primary)' }}>{detailView.data.faction}</span>
          </div>
        )}
        {detailView.data?.resources && (
          <div>
            RESOURCES:{' '}
            <span style={{ color: 'var(--color-primary)' }}>{detailView.data.resources}</span>
          </div>
        )}
        {detailView.data?.description && (
          <div style={{ marginTop: 8 }}>{detailView.data.description}</div>
        )}
      </div>
    </div>
  );
}
