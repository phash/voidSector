import { useState } from 'react';
import { useStore } from '../state/store';
import { network } from '../network/client';
import {
  innerCoord,
  JUMPGATE_UPGRADE_COSTS,
  JUMPGATE_CONNECTION_LIMITS,
  JUMPGATE_DISTANCE_LIMITS,
} from '@void-sector/shared';
import type { PlayerJumpGate, JumpGateDestination, DataSlate } from '@void-sector/shared';

function formatCost(cost: Record<string, number>): string {
  return Object.entries(cost)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => `${v} ${k.toUpperCase()}`)
    .join(', ');
}

interface OwnerViewProps {
  gate: PlayerJumpGate;
  destinations: JumpGateDestination[];
  gateSlates: DataSlate[];
}

function OwnerView({ gate, destinations, gateSlates }: OwnerViewProps) {
  const [showTollInput, setShowTollInput] = useState(false);
  const [tollValue, setTollValue] = useState(gate.tollCredits);
  const [confirmDismantle, setConfirmDismantle] = useState(false);

  const maxLinks = JUMPGATE_CONNECTION_LIMITS[gate.levelConnection] ?? 1;
  const distanceLimit = JUMPGATE_DISTANCE_LIMITS[gate.levelDistance] ?? 250;
  const currentLinks = gate.linkedGates.length;

  const connUpgradeKey = `connection_${gate.levelConnection + 1}`;
  const distUpgradeKey = `distance_${gate.levelDistance + 1}`;
  const connUpgradeCost = JUMPGATE_UPGRADE_COSTS[connUpgradeKey];
  const distUpgradeCost = JUMPGATE_UPGRADE_COSTS[distUpgradeKey];

  const handleSetToll = () => {
    network.sendSetJumpgateToll(gate.id, tollValue);
    setShowTollInput(false);
  };

  const handleDismantle = () => {
    if (!confirmDismantle) {
      setConfirmDismantle(true);
      return;
    }
    network.sendDismantleJumpgate(gate.id);
    setConfirmDismantle(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {/* Linked gates */}
      <div style={{ letterSpacing: '0.1em', opacity: 0.6, fontSize: '0.7rem' }}>
        VERBINDUNGEN: {currentLinks}/{maxLinks}
      </div>
      <div style={{ letterSpacing: '0.1em', opacity: 0.6, fontSize: '0.7rem' }}>
        DISTANZ-REICHWEITE: {distanceLimit}
      </div>

      {gate.linkedGates.length > 0 && (
        <div style={{ marginTop: 4 }}>
          <div style={{ fontSize: '0.7rem', opacity: 0.6, letterSpacing: '0.1em' }}>
            VERKNÜPFTE GATES:
          </div>
          {gate.linkedGates.map((link) => (
            <div
              key={link.gateId}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '0.75rem',
                padding: '2px 0',
              }}
            >
              <span style={{ color: '#00BFFF' }}>
                -&gt; ({innerCoord(link.sectorX)}, {innerCoord(link.sectorY)})
                {link.ownerName ? ` [${link.ownerName}]` : ''}
              </span>
              <button
                className="vs-btn"
                style={{ fontSize: '0.65rem', padding: '1px 6px' }}
                onClick={() => network.sendUnlinkJumpgate(gate.id, link.gateId)}
              >
                [TRENNEN]
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Toll */}
      <div style={{ marginTop: 4, fontSize: '0.75rem' }}>
        {showTollInput ? (
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <span>MAUT:</span>
            <input
              type="number"
              min={0}
              max={9999}
              value={tollValue}
              onChange={(e) => setTollValue(Math.max(0, Number(e.target.value)))}
              style={{
                background: 'transparent',
                border: '1px solid rgba(255, 176, 0, 0.3)',
                color: '#FFB000',
                fontFamily: 'inherit',
                fontSize: '0.75rem',
                padding: '2px 6px',
                width: '60px',
              }}
            />
            <span>CR</span>
            <button
              className="vs-btn"
              style={{ fontSize: '0.65rem', padding: '1px 6px' }}
              onClick={handleSetToll}
            >
              [OK]
            </button>
            <button
              className="vs-btn"
              style={{ fontSize: '0.65rem', padding: '1px 6px' }}
              onClick={() => setShowTollInput(false)}
            >
              [X]
            </button>
          </div>
        ) : (
          <div>
            MAUT: {gate.tollCredits} CR{' '}
            <button
              className="vs-btn"
              style={{ fontSize: '0.65rem', padding: '1px 6px' }}
              onClick={() => {
                setTollValue(gate.tollCredits);
                setShowTollInput(true);
              }}
            >
              [ÄNDERN]
            </button>
          </div>
        )}
      </div>

      {/* Gate slates in cargo */}
      {gateSlates.length > 0 && (
        <div
          style={{
            marginTop: 4,
            padding: '4px 6px',
            border: '1px solid rgba(0, 191, 255, 0.3)',
            background: 'rgba(0, 191, 255, 0.05)',
          }}
        >
          <div style={{ fontSize: '0.7rem', opacity: 0.6, letterSpacing: '0.1em' }}>
            GATE-SLATES IM CARGO:
          </div>
          {gateSlates.map((slate) => {
            const slateData = slate.sectorData[0] as any;
            const dist = slateData
              ? Math.abs(slateData.sectorX - gate.sectorX) +
                Math.abs(slateData.sectorY - gate.sectorY)
              : 0;
            const inRange = dist <= distanceLimit;
            const canLink = currentLinks < maxLinks;
            return (
              <div key={slate.id} style={{ fontSize: '0.75rem', padding: '2px 0' }}>
                <span style={{ color: '#00BFFF' }}>
                  Gate bei ({slateData?.sectorX ?? '?'}, {slateData?.sectorY ?? '?'})
                  {slateData?.ownerName ? ` von ${slateData.ownerName}` : ''}
                </span>
                <span style={{ color: inRange ? '#00FF88' : '#FF3333', marginLeft: 6 }}>
                  Dist: {dist} {inRange ? '\u2713' : '\u2717'}
                </span>
                {inRange && canLink && (
                  <button
                    className="vs-btn"
                    style={{ fontSize: '0.65rem', padding: '1px 6px', marginLeft: 6 }}
                    onClick={() => network.sendLinkJumpgate(slate.id)}
                  >
                    [VERKNÜPFEN]
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
        <button
          className="vs-btn"
          style={{ fontSize: '0.7rem' }}
          onClick={() => network.sendCreateSlate('jumpgate')}
        >
          [GATE-SLATE ERSTELLEN]
        </button>

        {connUpgradeCost && (
          <button
            className="vs-btn"
            style={{ fontSize: '0.7rem' }}
            onClick={() => network.sendUpgradeJumpgate(gate.id, 'connection')}
          >
            [VERBINDUNG UPGRADEN] — {formatCost(connUpgradeCost)}
          </button>
        )}

        {distUpgradeCost && (
          <button
            className="vs-btn"
            style={{ fontSize: '0.7rem' }}
            onClick={() => network.sendUpgradeJumpgate(gate.id, 'distance')}
          >
            [DISTANZ UPGRADEN] — {formatCost(distUpgradeCost)}
          </button>
        )}

        <button
          className="vs-btn"
          style={{
            fontSize: '0.7rem',
            borderColor: confirmDismantle ? '#FF3333' : undefined,
            color: confirmDismantle ? '#FF3333' : undefined,
          }}
          onClick={handleDismantle}
        >
          {confirmDismantle ? '[WIRKLICH ABBAUEN?]' : '[ABBAUEN]'}
        </button>
      </div>
    </div>
  );
}

interface VisitorViewProps {
  gate: PlayerJumpGate;
  destinations: JumpGateDestination[];
}

function VisitorView({ gate, destinations }: VisitorViewProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ fontSize: '0.75rem' }}>MAUT: {gate.tollCredits} CR</div>

      {destinations.length > 0 ? (
        <div>
          <div style={{ fontSize: '0.7rem', opacity: 0.6, letterSpacing: '0.1em' }}>ZIELE:</div>
          {destinations.map((dest) => (
            <div
              key={dest.gateId}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '0.75rem',
                padding: '2px 0',
              }}
            >
              <span style={{ color: '#00BFFF' }}>
                ({innerCoord(dest.sectorX)}, {innerCoord(dest.sectorY)}) — {dest.totalCost} CR
                {dest.hops > 1 ? ` (${dest.hops} Hops)` : ''}
              </span>
              <button
                className="vs-btn"
                style={{ fontSize: '0.65rem', padding: '1px 6px' }}
                onClick={() => network.sendUsePlayerGate(gate.id, dest.gateId)}
              >
                [SPRINGEN]
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: '0.7rem', opacity: 0.4 }}>KEINE ZIELE VERFÜGBAR</div>
      )}
    </div>
  );
}

export function PlayerGatePanel() {
  const playerGateInfo = useStore((s) => s.playerGateInfo);
  const playerId = useStore((s) => s.playerId);
  const mySlates = useStore((s) => s.mySlates);

  if (!playerGateInfo) return null;

  const { gate, destinations } = playerGateInfo;
  const isOwner = gate.ownerId === playerId;

  // Find jumpgate slates in cargo
  const gateSlates = mySlates.filter((s) => s.slateType === 'jumpgate' && s.status === 'available');

  return (
    <div
      style={{
        marginTop: 12,
        padding: 8,
        border: '1px solid rgba(0, 191, 255, 0.4)',
        background: 'rgba(0, 191, 255, 0.05)',
      }}
    >
      <div
        style={{ color: '#00BFFF', fontSize: '0.8rem', letterSpacing: '0.15em', marginBottom: 6 }}
      >
        JUMPGATE [L{gate.levelConnection}/L{gate.levelDistance}]
      </div>
      <div style={{ fontSize: '0.75rem', marginBottom: 6 }}>
        BESITZER: {gate.ownerName ?? 'Unbekannt'}
      </div>

      {isOwner ? (
        <OwnerView gate={gate} destinations={destinations} gateSlates={gateSlates} />
      ) : (
        <VisitorView gate={gate} destinations={destinations} />
      )}
    </div>
  );
}
