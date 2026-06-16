import { useState, useEffect, useRef } from 'react';
import { useStore } from '../state/store';
import { network } from '../network/client';
import { getShipComputerLevel, PROGRAM_TEMPLATES } from '@void-sector/shared';

/** DSL command reference grouped by minimum computer level */
const COMMAND_PALETTE: Array<{ label: string; snippet: string; requiredLevel: number }> = [
  // Level 1
  { label: 'fly X:Y', snippet: 'fly 5:5', requiredLevel: 1 },
  { label: 'scan', snippet: 'scan', requiredLevel: 1 },
  { label: 'mine until full', snippet: 'mine until full', requiredLevel: 1 },
  { label: 'mine N', snippet: 'mine 10', requiredLevel: 1 },
  { label: 'sell all', snippet: 'sell all', requiredLevel: 1 },
  { label: 'sell <res>', snippet: 'sell ore', requiredLevel: 1 },
  // Level 2
  { label: 'if <cond>:', snippet: 'if resources:\n  ', requiredLevel: 2 },
  { label: 'else:', snippet: 'else:\n  ', requiredLevel: 2 },
  { label: 'repeat:', snippet: 'repeat:\n  ', requiredLevel: 2 },
  { label: 'cond: resources', snippet: 'if resources:', requiredLevel: 2 },
  { label: 'cond: full', snippet: 'if full:', requiredLevel: 2 },
  { label: 'cond: empty', snippet: 'if empty:', requiredLevel: 2 },
  // Level 3
  { label: 'repeat N times:', snippet: 'repeat 5 times:\n  ', requiredLevel: 3 },
  { label: 'not', snippet: 'if not full:', requiredLevel: 3 },
  { label: 'fuel < N', snippet: 'if fuel < 500:', requiredLevel: 3 },
  { label: 'at X:Y', snippet: 'if at 0:0:', requiredLevel: 3 },
  { label: 'station', snippet: 'if station:', requiredLevel: 3 },
];

export function AutomatScreen() {
  const ship = useStore((s) => s.ship);
  const shipPrograms = useStore((s) => s.shipPrograms);
  const activeShipProgramId = useStore((s) => s.activeShipProgramId);
  const shipProgramRun = useStore((s) => s.shipProgramRun);
  const showTip = useStore((s) => s.showTip);

  const level = getShipComputerLevel(ship?.modules ?? []);

  const [editorName, setEditorName] = useState('');
  const [editorSource, setEditorSource] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    network.sendListPrograms();
  }, []);

  const handleNew = () => {
    setEditorName('');
    setEditorSource('');
  };

  const handleSave = () => {
    if (!editorName.trim()) return;
    network.sendSaveProgram(editorName.trim(), editorSource, 'loop');
  };

  const handleStart = () => {
    if (!activeShipProgramId) return;
    network.sendStartProgram(activeShipProgramId);
  };

  const handleStop = () => {
    network.sendStopProgram();
  };

  const handleLoadProgram = (id: string, name: string, source: string) => {
    setEditorName(name);
    setEditorSource(source);
    network.sendSetActiveProgram(id);
  };

  const handleDeleteProgram = (id: string) => {
    network.sendDeleteProgram(id);
  };

  const handleLoadTemplate = (name: string, source: string) => {
    setEditorName(name);
    setEditorSource(source);
  };

  const handleInsertCommand = (snippet: string) => {
    setEditorSource((prev) => {
      const trimmed = prev.trimEnd();
      return trimmed ? trimmed + '\n' + snippet : snippet;
    });
    textareaRef.current?.focus();
  };

  const isRunning = shipProgramRun?.status === 'running';

  // Empty state — no computer installed
  if (level === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '8px 12px' }}>
        <div
          style={{ fontSize: '0.8rem', letterSpacing: '0.2em', opacity: 0.6, marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
        >
          AUTOMAT
          <button
            className="vs-btn"
            style={{ fontSize: '0.7rem', padding: '0 6px', flexShrink: 0 }}
            title="Hilfe"
            onClick={() => showTip('first_automat')}
          >
            [?]
          </button>
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            gap: '8px',
            color: '#555',
            textAlign: 'center',
            fontSize: '0.85rem',
          }}
        >
          <div style={{ fontSize: '1.2rem', opacity: 0.4 }}>[ BORDCOMPUTER FEHLT ]</div>
          <div style={{ maxWidth: 280, lineHeight: 1.5 }}>
            Kein Bordcomputer installiert — baue einen Bordcomputer MK.I in der FABRIK, um Programme auszuführen.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        overflow: 'auto',
        padding: '8px 12px',
        gap: '8px',
      }}
    >
      {/* Header */}
      <div
        style={{
          fontSize: '0.8rem',
          letterSpacing: '0.2em',
          opacity: 0.6,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        AUTOMAT — MK.{level}
        <button
          className="vs-btn"
          style={{ fontSize: '0.7rem', padding: '0 6px', flexShrink: 0 }}
          title="Hilfe"
          onClick={() => showTip('first_automat')}
        >
          [?]
        </button>
      </div>

      {/* Editor section */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
        <input
          type="text"
          value={editorName}
          onChange={(e) => setEditorName(e.target.value)}
          placeholder="Programmname…"
          style={{
            background: '#050505',
            border: '1px solid var(--color-dim)',
            color: 'var(--color-primary)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.85rem',
            padding: '4px 6px',
            width: '100%',
            boxSizing: 'border-box',
          }}
        />
        <textarea
          ref={textareaRef}
          value={editorSource}
          onChange={(e) => setEditorSource(e.target.value)}
          rows={6}
          placeholder={'fly 5:5\nscan\nmine until full\nfly 0:0\nsell all'}
          style={{
            background: '#050505',
            border: '1px solid var(--color-dim)',
            color: 'var(--color-primary)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.82rem',
            padding: '4px 6px',
            width: '100%',
            boxSizing: 'border-box',
            resize: 'vertical',
            lineHeight: 1.5,
          }}
        />
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', flexShrink: 0 }}>
        <button className="vs-btn" onClick={handleNew} style={{ fontSize: '0.78rem' }}>
          [NEU]
        </button>
        <button
          className="vs-btn"
          onClick={handleSave}
          disabled={!editorName.trim()}
          style={{ fontSize: '0.78rem' }}
        >
          [SPEICHERN]
        </button>
        <button
          className="vs-btn"
          onClick={handleStart}
          disabled={!activeShipProgramId || isRunning}
          style={{ fontSize: '0.78rem' }}
        >
          [START]
        </button>
        <button
          className="vs-btn"
          onClick={handleStop}
          disabled={!isRunning}
          style={{ fontSize: '0.78rem' }}
        >
          [STOP]
        </button>
        {shipProgramRun && (
          <span style={{ fontSize: '0.75rem', opacity: 0.7, alignSelf: 'center' }}>
            STATUS: {shipProgramRun.status.toUpperCase()}
          </span>
        )}
      </div>

      {/* Saved programs list */}
      {shipPrograms.length > 0 && (
        <div style={{ flexShrink: 0 }}>
          <div style={{ fontSize: '0.7rem', opacity: 0.5, letterSpacing: '0.15em', marginBottom: '4px' }}>
            GESPEICHERTE PROGRAMME
          </div>
          {shipPrograms.map((prog) => (
            <div
              key={prog.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                marginBottom: '3px',
                padding: '3px 4px',
                background: prog.id === activeShipProgramId ? 'rgba(255,176,0,0.08)' : 'transparent',
                border: prog.id === activeShipProgramId ? '1px solid rgba(255,176,0,0.2)' : '1px solid transparent',
                cursor: 'pointer',
              }}
              onClick={() => handleLoadProgram(prog.id, prog.name, prog.source)}
            >
              <span style={{ flex: 1, fontSize: '0.82rem', fontFamily: 'var(--font-mono)' }}>
                {prog.is_active ? '▶ ' : '  '}{prog.name}
              </span>
              <span style={{ fontSize: '0.7rem', opacity: 0.5 }}>{prog.mode}</span>
              <button
                className="vs-btn"
                style={{ fontSize: '0.7rem', padding: '1px 5px' }}
                title="Löschen"
                onClick={(e) => { e.stopPropagation(); handleDeleteProgram(prog.id); }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Template picker */}
      <div style={{ flexShrink: 0 }}>
        <div style={{ fontSize: '0.7rem', opacity: 0.5, letterSpacing: '0.15em', marginBottom: '4px' }}>
          VORLAGEN
        </div>
        {PROGRAM_TEMPLATES.map((tpl) => {
          const available = tpl.minLevel <= level;
          return (
            <div
              key={tpl.name}
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: '6px',
                marginBottom: '4px',
                opacity: available ? 1 : 0.35,
                cursor: available ? 'pointer' : 'default',
                fontSize: '0.82rem',
              }}
              onClick={() => available && handleLoadTemplate(tpl.name, tpl.source)}
            >
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-primary)' }}>
                {tpl.name}
              </span>
              <span style={{ fontSize: '0.7rem', opacity: 0.5 }}>ab MK.{tpl.minLevel}</span>
              <span style={{ opacity: 0.6, fontSize: '0.75rem' }}>{tpl.description}</span>
            </div>
          );
        })}
      </div>

      {/* Command palette */}
      <div style={{ flexShrink: 0, marginBottom: '4px' }}>
        <div style={{ fontSize: '0.7rem', opacity: 0.5, letterSpacing: '0.15em', marginBottom: '4px' }}>
          BEFEHLE (klicken zum Einfügen)
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          {COMMAND_PALETTE.map((cmd) => {
            const available = cmd.requiredLevel <= level;
            return (
              <button
                key={cmd.label}
                className="vs-btn"
                disabled={!available}
                title={available ? cmd.snippet : `ab MK.${cmd.requiredLevel}`}
                style={{
                  fontSize: '0.72rem',
                  padding: '2px 6px',
                  opacity: available ? 1 : 0.3,
                  cursor: available ? 'pointer' : 'default',
                }}
                onClick={() => available && handleInsertCommand(cmd.snippet)}
              >
                {cmd.label}
                {!available && <span style={{ opacity: 0.6 }}> ab MK.{cmd.requiredLevel}</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
