import React from 'react';
import { useTranslation } from 'react-i18next';
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

const hdrStyle: React.CSSProperties = {
  color: 'var(--color-dim)',
  fontSize: '0.75rem',
  marginBottom: 4,
};

export const SettingsPanel: React.FC = () => {
  const { t, i18n } = useTranslation('ui');
  const username = useStore((s) => s.username);
  const colorProfile = useStore((s) => s.colorProfile);
  const setColorProfile = useStore((s) => s.setColorProfile);
  const brightness = useStore((s) => s.brightness);
  const setBrightness = useStore((s) => s.setBrightness);
  const fontScale = useStore((s) => s.fontScale);
  const setFontScale = useStore((s) => s.setFontScale);
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
      <div className="settings-header">{t('settings.settings')}</div>

      <div className="settings-row">
        <span className="settings-label">{t('settings.pilot')}</span>
        <span>{username ?? '—'}</span>
      </div>

      <div className="settings-row">
        <span className="settings-label">{t('settings.color')}</span>
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
        <span className="settings-label">{t('settings.brightness')}</span>
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
        <span className="settings-label">{t('settings.fontSize')}</span>
        <div style={{ display: 'flex', gap: 6 }} data-testid="font-size-control">
          {([
            ['S', 0.92],
            ['M', 1.0],
            ['L', 1.16],
          ] as const).map(([lbl, val]) => (
            <button
              key={lbl}
              onClick={() => setFontScale(val)}
              data-testid={`font-size-${lbl}`}
              style={{
                background: Math.abs(fontScale - val) < 0.01 ? 'rgba(255,176,0,0.15)' : 'transparent',
                color: Math.abs(fontScale - val) < 0.01 ? 'var(--color-primary)' : '#666',
                border: '1px solid #333',
                padding: '2px 10px',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.8rem',
                cursor: 'pointer',
              }}
            >
              {lbl}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <div style={hdrStyle}>{t('settings.language')}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => i18n.changeLanguage('de')}
            style={{
              background: i18n.language === 'de' ? 'rgba(255,176,0,0.15)' : 'transparent',
              color: i18n.language === 'de' ? 'var(--color-primary)' : '#666',
              border: '1px solid #333',
              padding: '4px 12px',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.85rem',
              cursor: 'pointer',
            }}
          >DE</button>
          <button
            onClick={() => i18n.changeLanguage('en')}
            style={{
              background: i18n.language === 'en' ? 'rgba(255,176,0,0.15)' : 'transparent',
              color: i18n.language === 'en' ? 'var(--color-primary)' : '#666',
              border: '1px solid #333',
              padding: '4px 12px',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.85rem',
              cursor: 'pointer',
            }}
          >EN</button>
        </div>
      </div>

      <div className="settings-row">
        <button className="vs-btn-sm" onClick={() => openCompendium()} data-testid="kompendium-btn">
          {t('settings.compendium')}
        </button>
      </div>

      <div className="settings-row">
        <button className="vs-btn-sm vs-btn-danger" onClick={handleLogout}>
          {t('settings.logout')}
        </button>
      </div>
    </div>
  );
};
