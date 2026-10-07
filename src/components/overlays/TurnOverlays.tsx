import { GROUP_COLORS, GROUP_MEMBERS, SPACES } from '../../game/data';
import { Game, money } from '../../game/engine';
import { Modal } from './Modal';
import { TitleDeed } from './TitleDeed';

export function CardOverlay({ g, onAck }: { g: Game; onAck: () => void }) {
  if (!g.card) return null;
  const chance = g.card.deck === 'CHANCE';
  return (
    <Modal z={45} dim={0.6}>
      <div
        className="popin w-full max-w-xs rounded-xl p-6 text-center shadow-2xl"
        style={{
          background: chance
            ? 'linear-gradient(160deg,#f0c56e,#c97820)'
            : 'linear-gradient(160deg,#7ec8b8,#2a6b5c)',
          color: '#101814',
        }}
        role="dialog"
        aria-label={chance ? 'Chance card' : 'Community Chest card'}
      >
        <div className="deco text-lg font-bold">{chance ? 'Chance' : 'Community Chest'}</div>
        <p className="my-4 text-[15px] font-semibold leading-snug">{g.card.text}</p>
        <button type="button" onClick={onAck} className="btn btn-dark w-full py-2.5 text-sm">Continue</button>
      </div>
    </Modal>
  );
}

export function BuyOverlay({
  g,
  i,
  onBuy,
  onAuction,
  meId = 0,
}: {
  g: Game;
  i: number;
  onBuy: () => void;
  onAuction: () => void;
  meId?: number;
}) {
  const sp = SPACES[i];
  const afford = g.players[meId].cash >= sp.price!;
  return (
    <Modal z={45} dim={0.6}>
      <div className="popin w-full max-w-[280px]">
        <TitleDeed g={g} i={i} />
        <div className="mt-3 flex gap-2">
          <button type="button" disabled={!afford} onClick={onBuy} className="btn btn-gold flex-1 py-2.5 text-sm">
            Buy {money(sp.price!)}
          </button>
          <button type="button" onClick={onAuction} className="btn btn-dark flex-1 py-2.5 text-sm">
            Auction
          </button>
        </div>
        {!afford && (
          <p className="mt-2 text-center text-[12px] text-[#e07a88]">Not enough cash — send it to auction.</p>
        )}
      </div>
    </Modal>
  );
}

export function AuctionOverlay({
  g,
  onBid,
  onPass,
  meId = 0,
}: {
  g: Game;
  onBid: () => void;
  onPass: () => void;
  meId?: number;
}) {
  const a = g.auction!;
  const sp = SPACES[a.space];
  const myTurn = a.current === meId && a.active[meId];
  const canBid = g.players[meId].cash >= a.price;
  return (
    <Modal z={45} dim={0.6}>
      <div className="popin panel w-full max-w-xs rounded-xl p-5 text-center">
        <div className="text-[12px] font-medium text-[var(--mist)]">Auction</div>
        <div className="deco mt-1 text-xl font-bold" style={{ color: sp.group ? GROUP_COLORS[sp.group] : 'var(--ivory)' }}>
          {sp.name}
        </div>
        <p className="mt-1 text-[12px] text-[var(--mist)]">List price {money(sp.price!)}</p>
        <div className="my-4 rounded-lg bg-black/35 py-3">
          <div className="text-[12px] text-[var(--mist)]">Current bid</div>
          <div className="deco text-3xl font-bold tabular-nums text-emerald-300/95">
            {a.high === null ? '—' : money(Math.max(0, a.price - 10))}
          </div>
          <div className="text-[11px] text-[var(--mist)]">Next bid {money(a.price)}</div>
          <div className="text-[12px]" style={{ color: a.high !== null ? g.players[a.high].color : 'var(--mist)' }}>
            {a.high !== null ? `High bidder: ${g.players[a.high].name}` : 'No bids yet'}
          </div>
        </div>
        <p className="mb-3 text-[12px] text-[var(--champagne)]/85">{a.message}</p>
        <div className="flex flex-wrap justify-center gap-1.5">
          {g.players.map((p, i) => (
            <span
              key={p.id}
              className="rounded-md px-2 py-0.5 text-[11px] font-semibold"
              style={{
                background: a.active[i] ? `${p.color}33` : 'rgba(255,255,255,.05)',
                color: a.active[i] ? p.color : 'var(--mist)',
                textDecoration: a.active[i] ? 'none' : 'line-through',
              }}
            >
              {p.token} {p.name}
            </span>
          ))}
        </div>
        {myTurn ? (
          <div className="mt-4 flex gap-2">
            <button type="button" disabled={!canBid} onClick={onBid} className="btn btn-gold flex-1 py-2.5 text-sm">
              Bid {money(a.price)}
            </button>
            <button type="button" onClick={onPass} className="btn btn-dark flex-1 py-2.5 text-sm">Pass</button>
          </div>
        ) : (
          <p className="mt-4 text-[12px] text-[var(--mist)]">
            {a.active[meId] ? 'Waiting for rivals…' : 'You are out of this auction.'}
          </p>
        )}
      </div>
    </Modal>
  );
}

export function InspectOverlay({ g, i, onClose }: { g: Game; i: number; onClose: () => void }) {
  const sp = SPACES[i];
  if (!sp.price) {
    return (
      <Modal z={46} dim={0.6} sheet onClose={onClose} label={sp.name}>
        <div className="popin panel sheet-panel w-full max-w-md rounded-t-2xl p-5 text-center sm:max-w-[280px] sm:rounded-xl">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[var(--brass)]/35 sm:hidden" aria-hidden />
          <div className="deco text-xl gold-text">{sp.name}</div>
          <p className="mt-3 text-[13px] leading-relaxed text-[var(--mist)]">
            {sp.type === 'tax' && `Pay ${money(sp.tax!)} to the bank.`}
            {sp.type === 'go' && 'Collect $200 every time you pass.'}
            {sp.type === 'jail' && 'Just visiting — unless the law catches you.'}
            {sp.type === 'parking' && 'A free resting space. Nothing happens.'}
            {sp.type === 'gotojail' && 'Go directly to Jail. Do not pass Go.'}
            {sp.type === 'chance' && 'Draw a Chance card.'}
            {sp.type === 'chest' && 'Draw a Community Chest card.'}
          </p>
          <button type="button" onClick={onClose} className="btn btn-dark mt-4 w-full py-2.5 text-sm">Close</button>
        </div>
      </Modal>
    );
  }
  const group = sp.group!;
  return (
    <Modal z={46} dim={0.6} sheet onClose={onClose} label={sp.name}>
      <div className="popin sheet-panel w-full max-w-md sm:max-w-[280px]">
        <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-[var(--brass)]/35 sm:hidden" aria-hidden />
        <TitleDeed g={g} i={i} />
        <div className="mt-2 flex justify-center gap-1">
          {GROUP_MEMBERS[group].map((j) => (
            <span
              key={j}
              className="rounded px-1.5 py-0.5 text-[10px] font-bold"
              style={{
                background: GROUP_COLORS[group],
                opacity: g.props[j].owner === null ? 0.35 : 1,
                color: '#111',
              }}
            >
              {SPACES[j].short}
            </span>
          ))}
        </div>
        <button type="button" onClick={onClose} className="btn btn-dark mt-3 w-full py-2.5 text-sm">Close</button>
      </div>
    </Modal>
  );
}
