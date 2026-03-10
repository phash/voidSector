import React from 'react';
import { useStore } from '../state/store';
import { COLOR_PROFILES } from '../styles/themes';
import type { ColorProfileName } from '../styles/themes';

const inlineInput: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid var(--color-dim)',
  color: 'var(--color-primary)',
  fontFamily: 'monospace',
  fontSize: '0.85rem',
  padding: '2px 4px',
};

export const SettingsPanel: React.FC = () => {
  const username = useStore((s) => s.username);
  const colorProfile = useStore((s) => s.colorProfile);
  const setColorProfile = useStore((s) => s.setColorProfile);
  const brightness = useStore((s) => s.brightness);
  const setBrightness = useStore((s) => s.setBrightness);
  const openCompendium = useStore((s) => s.openCompendium);

  const handleLogout = () => {
    try {
      localStorage.removeItem('vs_token');
    } catch {
      /* noop */
    }
    window.location.reload();
  };

  return (
    <div className="settings-panel">
      <div className="settings-header">EINSTELLUNGEN</div>

      <div className="settings-row">
        <span className="settings-label">PILOT</span>
        <span>{username ?? '—'}</span>
      </div>

      <div className="settings-row">
        <span className="settings-label">FARBE</span>
        <select
          value={colorProfile}
          onChange={(e) => setColorProfile(e.target.value as ColorProfileName)}
          style={inlineInput}
          data-testid="color-profile-select"
        >
          {Object.keys(COLOR_PROFILES).map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>

      <div className="settings-row">
        <span className="settings-label">HELLIGKEIT</span>
        <input
          type="range"
          className="settings-slider"
          min={0.3}
          max={1.5}
          step={0.1}
          value={brightness}
          onChange={(e) => setBrightness(parseFloat(e.target.value))}
          data-testid="brightness-slider"
        />
        <span>{brightness.toFixed(1)}</span>
      </div>

      <div className="settings-row">
        <button className="vs-btn-sm" onClick={() => openCompendium()} data-testid="kompendium-btn">
          ◈ KOMPENDIUM
        </button>
      </div>

      <div className="settings-row">
        <button className="vs-btn-sm vs-btn-danger" onClick={handleLogout}>
          LOGOUT
        </button>
      </div>
    </div>
  );
};
