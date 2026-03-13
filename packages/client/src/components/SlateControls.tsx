import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../state/store';
import { network } from '../network/client';
import {
  SLATE_AP_COST_SECTOR,
  CUSTOM_SLATE_AP_COST,
  CUSTOM_SLATE_CREDIT_COST,
  CUSTOM_SLATE_MAX_NOTES_LENGTH,
} from '@void-sector/shared';
import type { DataSlate } from '@void-sector/shared';

export function SlateControls() {
  const { t } = useTranslation('ui');
  const cargo = useStore((s) => s.cargo);
  const ship = useStore((s) => s.ship);
  const mySlates = useStore((s) => s.mySlates);
  const memory = ship?.stats?.memory ?? 2;
  const memoryFull = cargo.slates >= memory;

  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customLabel, setCustomLabel] = useState('');
  const [customNotes, setCustomNotes] = useState('');

  useEffect(() => {
    if (cargo.slates > 0 && mySlates.length === 0) {
      network.requestMySlates();
    }
  }, [cargo.slates, mySlates.length]);

  return (
    <div
      style={{
        borderTop: '1px solid var(--color-dim)',
        marginTop: 6,
        paddingTop: 4,
        fontFamily: 'var(--font-mono)',
        fontSize: '0.6rem',
      }}
    >
      <div style={{ opacity: 0.6, letterSpacing: '0.1em', marginBottom: 3 }}>
        ── {t('slates.karten')} ── {cargo.slates}/{memory}
        {cargo.slates > memory && <span style={{ color: '#FF3333' }}> !</span>}
      </div>

      {cargo.slates > 0 && (
        <div style={{ marginBottom: 4 }}>
          <div style={{ opacity: 0.6, marginBottom: 2 }}>{t('slates.dataSlates')}: {cargo.slates}</div>
          {mySlates.map((slate: DataSlate) => (
            <div
              key={slate.id}
              style={{
                marginBottom: 3,
                display: 'flex',
                gap: 3,
                alignItems: 'center',
                flexWrap: 'wrap',
              }}
            >
              <span style={{ opacity: 0.7 }}>
                [{slate.slateType === 'sector' ? 'S'
                  : slate.slateType === 'area' ? 'A'
                  : slate.slateType === 'scan' ? 'SC'
                  : slate.slateType === 'jumpgate' ? 'JG'
                  : 'C'}]
                {slate.slateType === 'custom' && slate.customData
                  ? ` ${slate.customData.label}`
                  : ` ${t('slates.sektoren', { n: slate.sectorData?.length ?? 0 })}`}
              </span>
              <button
                className="vs-btn"
                style={{ fontSize: '0.55rem', padding: '4px 8px' }}
                onClick={() => network.sendActivateSlate(slate.id)}
              >
                {t('slates.activate')}
              </button>
              <button
                className="vs-btn"
                style={{ fontSize: '0.55rem', padding: '4px 8px' }}
                onClick={() => network.sendNpcBuyback(slate.id)}
              >
                {t('slates.npcSell')}
              </button>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 3 }}>
        <button
          className="vs-btn"
          style={{ fontSize: '0.55rem', padding: '4px 8px' }}
          disabled={memoryFull}
          onClick={() => network.sendCreateSlate('sector')}
        >
          {t('slates.sektor', { cost: SLATE_AP_COST_SECTOR })}
        </button>
        <button
          className="vs-btn"
          style={{ fontSize: '0.55rem', padding: '4px 8px' }}
          disabled={memoryFull}
          onClick={() => network.sendCreateSlate('area')}
        >
          {t('slates.gebiet')}
        </button>
        <button
          className="vs-btn"
          style={{ fontSize: '0.55rem', padding: '4px 8px' }}
          disabled={memoryFull}
          onClick={() => setShowCustomForm(!showCustomForm)}
        >
          {t('slates.disk', { ap: CUSTOM_SLATE_AP_COST, cr: CUSTOM_SLATE_CREDIT_COST })}
        </button>
      </div>

      {showCustomForm && (
        <div
          style={{
            border: '1px solid rgba(255,176,0,0.3)',
            padding: 6,
            marginBottom: 4,
          }}
        >
          <div style={{ marginBottom: 3, opacity: 0.6 }}>{t('slates.newDataDisk')}</div>
          <input
            className="vs-input"
            placeholder={t('slates.label')}
            value={customLabel}
            onChange={(e) => setCustomLabel(e.target.value.slice(0, 32))}
            style={{ width: '100%', marginBottom: 3 }}
          />
          <textarea
            className="vs-input"
            placeholder={t('slates.notes')}
            value={customNotes}
            onChange={(e) => setCustomNotes(e.target.value.slice(0, CUSTOM_SLATE_MAX_NOTES_LENGTH))}
            style={{ width: '100%', height: 48, resize: 'vertical', marginBottom: 3 }}
          />
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              className="vs-btn"
              style={{ fontSize: '0.55rem', padding: '4px 8px' }}
              disabled={!customLabel.trim()}
              onClick={() => {
                network.sendCreateCustomSlate({
                  label: customLabel.trim(),
                  notes: customNotes || undefined,
                });
                setCustomLabel('');
                setCustomNotes('');
                setShowCustomForm(false);
              }}
            >
              {t('slates.create')}
            </button>
            <button
              className="vs-btn"
              style={{ fontSize: '0.55rem', padding: '4px 8px' }}
              onClick={() => setShowCustomForm(false)}
            >
              {t('slates.cancel')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
