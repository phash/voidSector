import { useStore } from '../state/store';

const SECTOR_ART: Record<string, string[]> = {
  station: [
    '         ╔═══╗         ',
    '    ═════╣   ╠═════    ',
    '    ║    ║   ║    ║    ',
    '    ║  ╔═╩═══╩═╗  ║    ',
    '    ╚══╣ DOCK  ╠══╝    ',
    '       ║  BAY  ║       ',
    '    ╔══╣       ╠══╗    ',
    '    ║  ╚═╦═══╦═╝  ║    ',
    '    ║    ║   ║    ║    ',
    '    ═════╣   ╠═════    ',
    '         ╚═══╝         ',
  ],
  asteroid: [
    '                        ',
    '       ╱▓▓▓▓╲          ',
    '     ╱▓▓░░▓▓▓╲         ',
    '    │▓▓░░░░▓▓▓│        ',
    '    │▓░░▓▓░░▓▓│        ',
    '    │▓▓░░░░▓▓│         ',
    '     ╲▓▓▓▓▓▓╱          ',
    '       ╲▓▓╱            ',
    '                        ',
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
    '                        ',
    '    ·       ·     ·     ',
    '        ·        ·      ',
    '   ·        ·           ',
    '       · VOID ·         ',
    '    ·        ·      ·   ',
    '        ·       ·       ',
    '   ·        ·     ·     ',
    '                        ',
  ],
  home_base: [
    '         ╔═╗            ',
    '       ╔═╝ ╚═╗          ',
    '     ╔═╝ H B ╚═╗        ',
    '   ══╣  HOME   ╠══      ',
    '     ║  BASE   ║        ',
    '   ══╣         ╠══      ',
    '     ╚═╗     ╔═╝        ',
    '       ╚═╗ ╔═╝          ',
    '         ╚═╝            ',
  ],
  ship: [
    '          ╱╲            ',
    '         ╱  ╲           ',
    '        ╱ ◊◊ ╲          ',
    '       ┌──────┐         ',
    '     ══╡ SHIP ╞══       ',
    '       │      │         ',
    '       └──┬┬──┘         ',
    '          ╲╱            ',
    '                        ',
  ],
};

export function DetailViewOverlay() {
  const detailView = useStore((s) => s.detailView);
  const setDetailView = useStore((s) => s.setDetailView);

  if (!detailView) return null;

  const art = SECTOR_ART[detailView.type] ?? SECTOR_ART.empty;
  const sectorType = detailView.type.toUpperCase().replace('_', ' ');

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      background: 'rgba(5, 5, 5, 0.95)',
      zIndex: 10,
      display: 'flex',
      flexDirection: 'column',
      padding: '16px',
      overflow: 'auto',
    }}>
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

      <div style={{
        fontSize: '0.9rem',
        letterSpacing: '0.2em',
        marginBottom: 16,
        borderBottom: '1px solid var(--color-dim)',
        paddingBottom: 8,
      }}>
        DETAIL VIEW — {sectorType}
      </div>

      <div style={{
        fontFamily: "'Share Tech Mono', 'Courier New', monospace",
        fontSize: '1.1rem',
        lineHeight: 1.4,
        color: 'var(--color-primary)',
        textAlign: 'center',
        marginBottom: 16,
        textShadow: '0 0 8px var(--color-primary)',
      }}>
        {art.map((line, i) => (
          <div key={i} style={{ whiteSpace: 'pre' }}>{line}</div>
        ))}
      </div>

      <div style={{
        fontSize: '0.8rem',
        letterSpacing: '0.1em',
        color: 'var(--color-dim)',
        lineHeight: 1.6,
      }}>
        {detailView.data?.name && (
          <div>NAME: <span style={{ color: 'var(--color-primary)' }}>{detailView.data.name}</span></div>
        )}
        {detailView.data?.position && (
          <div>POSITION: <span style={{ color: 'var(--color-primary)' }}>{detailView.data.position}</span></div>
        )}
        {detailView.data?.faction && (
          <div>FACTION: <span style={{ color: 'var(--color-primary)' }}>{detailView.data.faction}</span></div>
        )}
        {detailView.data?.resources && (
          <div>RESOURCES: <span style={{ color: 'var(--color-primary)' }}>{detailView.data.resources}</span></div>
        )}
        {detailView.data?.description && (
          <div style={{ marginTop: 8 }}>{detailView.data.description}</div>
        )}
      </div>
    </div>
  );
}
