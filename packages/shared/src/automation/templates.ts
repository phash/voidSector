/** A pre-built ship script the player can load into the AUTOMAT editor. */
export interface ProgramTemplate {
  /** Display name (German) */
  name: string;
  /** Minimum ship computer level (MK.I=1 … MK.V=5) required to run this script. */
  minLevel: number;
  /** Short German description of what the script does. */
  description: string;
  /** DSL source code, ready to compile. */
  source: string;
}

/** Five ready-to-use AUTOMAT scripts covering common automation scenarios. */
export const PROGRAM_TEMPLATES: ProgramTemplate[] = [
  {
    name: 'Lieferlauf',
    minLevel: 1,
    description: 'Fliegt zu Sektor 5:5, scannt, baut ab bis voll und liefert alles an 0:0.',
    source: [
      'fly 5:5',
      'scan',
      'mine until full',
      'fly 0:0',
      'sell all',
    ].join('\n'),
  },
  {
    name: 'Bedingter Abbau',
    minLevel: 2,
    description: 'Scannt zuerst — abbaut nur wenn Ressourcen vorhanden, sonst erneuter Scan.',
    source: [
      'fly 5:5',
      'scan',
      'if resources:',
      '  mine until full',
      'else:',
      '  scan',
    ].join('\n'),
  },
  {
    name: 'Autonomer Loop',
    minLevel: 3,
    description: 'Endlosschleife: sucht Ressourcen in zwei Sektoren, liefert automatisch wenn voll.',
    source: [
      'repeat:',
      '  fly 3:5',
      '  scan',
      '  if resources:',
      '    mine until full',
      '  else:',
      '    fly 7:9',
      '    scan',
      '    mine until full',
      '  if full:',
      '    fly 0:0',
      '    sell all',
    ].join('\n'),
  },
  {
    name: 'Treibstoff-Wache',
    minLevel: 3,
    description: 'Wiederholt Abbaurunden, kehrt bei niedrigem Treibstoff zur Basis zurück.',
    source: [
      'repeat 5 times:',
      '  if fuel < 500:',
      '    fly 0:0',
      '  scan',
      '  if resources:',
      '    mine until full',
      '  if full:',
      '    fly 0:0',
      '    sell all',
    ].join('\n'),
  },
  {
    name: 'Verkaufsrunde',
    minLevel: 3,
    description: 'Füllt Frachtraum auf und verkauft — fliegt zur Basis wenn keine Station in Reichweite.',
    source: [
      'repeat:',
      '  if not full:',
      '    mine until full',
      '  if station:',
      '    sell all',
      '  else:',
      '    fly 0:0',
    ].join('\n'),
  },
];
