import { useStore } from '../../state/store';
import { network } from '../../network/client';

export function QuestTurnInOffer() {
  const offer = useStore((s) => s.questTurnInOffer);
  const setQuestTurnInOffer = useStore((s) => s.setQuestTurnInOffer);

  if (!offer) return null;

  const handleConfirm = () => {
    network.sendTurnInQuest(offer.questId);
    setQuestTurnInOffer(null);
  };

  const handleLater = () => {
    setQuestTurnInOffer(null);
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 320,
        border: '1px solid #00FF88',
        background: '#050505',
        padding: '16px 18px',
        fontFamily: 'var(--font-mono)',
        fontSize: '0.75rem',
        zIndex: 200,
        boxShadow: '0 0 24px rgba(0,255,136,0.25)',
      }}
    >
      <div
        style={{
          color: '#00FF88',
          fontSize: '0.6rem',
          letterSpacing: '0.2em',
          marginBottom: 8,
        }}
      >
        QUEST-ABGABE
      </div>
      <div style={{ color: 'var(--color-primary)', marginBottom: 6 }}>{offer.title}</div>
      <div style={{ color: 'rgba(255,255,255,0.7)', marginBottom: 6 }}>Quest abschließen?</div>
      {offer.rewardCredits != null && (
        <div style={{ color: 'rgba(255,176,0,0.7)', fontSize: '0.7rem', marginBottom: 10 }}>
          Belohnung: {offer.rewardCredits} Credits
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button className="vs-btn" onClick={handleConfirm} style={{ flex: 1 }}>
          [QUEST ABSCHLIESSEN]
        </button>
        <button className="vs-btn" onClick={handleLater} style={{ flex: 1 }}>
          [SPÄTER]
        </button>
      </div>
    </div>
  );
}
