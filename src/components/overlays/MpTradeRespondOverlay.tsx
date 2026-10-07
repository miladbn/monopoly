import { SPACES } from '../../game/data';
import { money } from '../../game/engine';
import { Modal } from './Modal';

export function MpTradeRespondOverlay({
  fromName,
  give,
  get,
  cash,
  onAccept,
  onDecline,
}: {
  fromName: string;
  give: number[];
  get: number[];
  cash: number;
  onAccept: () => void;
  onDecline: () => void;
}) {
  return (
    <Modal z={48} sheet label="Trade offer" onClose={onDecline}>
      <div className="panel sheet-panel w-full max-w-sm rounded-xl p-4 sm:rounded-xl">
        <h3 className="deco text-center text-xl gold-text">Trade offer</h3>
        <p className="mt-2 text-center text-[13px] text-[var(--mist)]">{fromName} offers:</p>
        <div className="mt-3 space-y-2 rounded-lg bg-black/30 px-3 py-2.5 text-[12px]">
          <div>
            <div className="text-[10px] font-medium uppercase text-[var(--mist)]">You receive</div>
            <div className="mt-0.5 font-semibold text-[var(--champagne)]">
              {(give || []).map((i) => SPACES[i]?.short).filter(Boolean).join(', ') || '—'}
              {cash > 0 ? ` + ${money(cash)}` : ''}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-medium uppercase text-[var(--mist)]">You give</div>
            <div className="mt-0.5 font-semibold text-[var(--ivory)]">
              {(get || []).map((i) => SPACES[i]?.short).filter(Boolean).join(', ') || '—'}
              {cash < 0 ? ` + ${money(-cash)}` : ''}
            </div>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <button type="button" className="btn btn-gold flex-1 py-3" onClick={onAccept}>
            Accept
          </button>
          <button type="button" className="btn btn-dark flex-1 py-3" onClick={onDecline}>
            Decline
          </button>
        </div>
      </div>
    </Modal>
  );
}
