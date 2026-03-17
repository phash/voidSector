import { useState } from 'react';
import { useStore } from '../state/store';
import { network } from '../network/client';
import { JUMPGATE_FUEL_PER_HOP, innerCoord } from '@void-sector/shared';
import type { JumpGateDestination, PlayerJumpGate } from '@void-sector/shared';

const CHAIN_COLORS = ['#00BFFF', '#33FF33', '#FF6644', '#FFDD22', '#FF44FF', '#44AAFF'];

interface NodeInfo {
  id: string;
  x: number;
  y: number;
  sectorX: number;
  sectorY: number;
  hops: number;
  totalCost: number;
  fuelCost: number;
  ownerName?: string;
  isDirect: boolean;
}

function layoutNodes(
  gate: PlayerJumpGate,
  destinations: JumpGateDestination[],
  width: number,
  height: number,
): NodeInfo[] {
  const cx = width / 2;
  const cy = height / 2 - 10;
  const maxRadius = Math.min(cx, cy) - 40;
  const directIds = new Set(gate.linkedGates.map((l) => l.gateId));

  return destinations.map((dest, i) => {
    // Angle based on sector position relative to current gate
    const dx = dest.sectorX - gate.sectorX;
    const dy = dest.sectorY - gate.sectorY;
    const angle = Math.atan2(dy, dx);

    // Radius based on hop count
    const hopFraction = dest.hops <= 1 ? 0.35 : dest.hops <= 2 ? 0.6 : 0.85;
    const jitter = (i % 3 - 1) * 12; // slight offset to avoid overlaps
    const r = maxRadius * hopFraction + jitter;

    return {
      id: dest.gateId,
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
      sectorX: dest.sectorX,
      sectorY: dest.sectorY,
      hops: dest.hops,
      totalCost: dest.totalCost,
      fuelCost: dest.hops * JUMPGATE_FUEL_PER_HOP,
      ownerName: gate.linkedGates.find((l) => l.gateId === dest.gateId)?.ownerName,
      isDirect: directIds.has(dest.gateId),
    };
  });
}

export function JumpGateNetworkView() {
  const playerGateInfo = useStore((s) => s.playerGateInfo);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (!playerGateInfo) return null;
  const { gate, destinations } = playerGateInfo;

  const W = 600;
  const H = 380;
  const cx = W / 2;
  const cy = H / 2 - 10;
  const nodes = layoutNodes(gate, destinations, W, H);
  const selected = nodes.find((n) => n.id === selectedId);

  // Build direct-link set for line drawing
  const directLinks = new Set(gate.linkedGates.map((l) => l.gateId));

  function handleJump() {
    if (!selected) return;
    network.sendUsePlayerGate(gate.id, selected.id);
    useStore.setState({ gateNetworkOpen: false });
  }

  function handleClose() {
    useStore.setState({ gateNetworkOpen: false });
  }

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: '#0a0a0a',
        fontFamily: 'var(--font-mono)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '6px 12px',
          borderBottom: '1px solid #333',
          fontSize: '0.75rem',
          color: '#00BFFF',
          letterSpacing: '0.15em',
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <span>GATE-NETZWERK — ({innerCoord(gate.sectorX)}, {innerCoord(gate.sectorY)})</span>
        <span
          style={{ cursor: 'pointer', color: '#666' }}
          onClick={handleClose}
        >
          [ESC]
        </span>
      </div>

      {/* SVG Network */}
      <div style={{ flex: 1, position: 'relative' }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          style={{ width: '100%', height: '100%' }}
        >
          <defs>
            <filter id="glow">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Lines from center to each node */}
          {nodes.map((node) => (
            <line
              key={`line-${node.id}`}
              x1={cx}
              y1={cy}
              x2={node.x}
              y2={node.y}
              stroke={node.isDirect ? CHAIN_COLORS[node.hops % CHAIN_COLORS.length] : '#333'}
              strokeWidth={node.id === selectedId ? 2.5 : 1.5}
              strokeDasharray={node.isDirect ? 'none' : '4 4'}
              opacity={node.id === selectedId ? 1 : 0.5}
            />
          ))}

          {/* Center node (YOU) */}
          <circle cx={cx} cy={cy} r={14} fill="#FFB000" filter="url(#glow)" />
          <text
            x={cx}
            y={cy + 4}
            fill="#111"
            fontSize="9"
            textAnchor="middle"
            fontWeight="bold"
            fontFamily="var(--font-mono)"
          >
            YOU
          </text>
          <text
            x={cx}
            y={cy - 20}
            fill="#FFB000"
            fontSize="8"
            textAnchor="middle"
            fontFamily="var(--font-mono)"
          >
            ({innerCoord(gate.sectorX)}, {innerCoord(gate.sectorY)})
          </text>

          {/* Destination nodes */}
          {nodes.map((node) => {
            const isSelected = node.id === selectedId;
            const color = CHAIN_COLORS[node.hops % CHAIN_COLORS.length];
            return (
              <g
                key={node.id}
                style={{ cursor: 'pointer' }}
                onClick={() => setSelectedId(isSelected ? null : node.id)}
              >
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={isSelected ? 12 : 9}
                  fill={isSelected ? color : 'none'}
                  stroke={color}
                  strokeWidth={isSelected ? 2.5 : 1.5}
                  filter={isSelected ? 'url(#glow)' : undefined}
                />
                {isSelected && (
                  <text
                    x={node.x}
                    y={node.y + 3}
                    fill="#111"
                    fontSize="7"
                    textAnchor="middle"
                    fontWeight="bold"
                    fontFamily="var(--font-mono)"
                  >
                    GO
                  </text>
                )}
                <text
                  x={node.x}
                  y={node.y - 14}
                  fill={color}
                  fontSize="8"
                  textAnchor="middle"
                  fontFamily="var(--font-mono)"
                >
                  ({innerCoord(node.sectorX)}, {innerCoord(node.sectorY)})
                </text>
                <text
                  x={node.x}
                  y={node.y + (isSelected ? 22 : 20)}
                  fill="#555"
                  fontSize="7"
                  textAnchor="middle"
                  fontFamily="var(--font-mono)"
                >
                  {node.hops}H · {node.fuelCost}F
                  {node.totalCost > 0 ? ` · ${node.totalCost}CR` : ''}
                </text>
              </g>
            );
          })}

          {/* Empty state */}
          {nodes.length === 0 && (
            <text x={cx} y={cy + 40} fill="#444" fontSize="11" textAnchor="middle" fontFamily="var(--font-mono)">
              KEINE VERBINDUNGEN
            </text>
          )}
        </svg>
      </div>

      {/* Info bar */}
      <div
        style={{
          padding: '8px 12px',
          borderTop: '1px solid #333',
          fontSize: '0.7rem',
          minHeight: 40,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        {selected ? (
          <>
            <div>
              <span style={{ color: CHAIN_COLORS[selected.hops % CHAIN_COLORS.length] }}>
                ▸ GATE ({innerCoord(selected.sectorX)}, {innerCoord(selected.sectorY)})
              </span>
              {selected.ownerName && (
                <span style={{ color: '#666', marginLeft: 6 }}>— {selected.ownerName}</span>
              )}
              <div style={{ color: '#888', fontSize: '0.65rem', marginTop: 2 }}>
                ROUTE: {selected.hops} Hop{selected.hops > 1 ? 's' : ''} · {selected.fuelCost} FUEL
                {selected.totalCost > 0 ? ` · ${selected.totalCost} CR Maut` : ' · 0 CR'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                className="vs-btn"
                style={{ fontSize: '0.65rem', borderColor: '#00BFFF', color: '#00BFFF' }}
                onClick={handleJump}
              >
                [SPRINGEN]
              </button>
              <button
                className="vs-btn"
                style={{ fontSize: '0.65rem' }}
                onClick={handleClose}
              >
                [ZURÜCK]
              </button>
            </div>
          </>
        ) : (
          <span style={{ color: '#555' }}>Klicke ein Gate zum Reisen</span>
        )}
      </div>
    </div>
  );
}
