import { useState } from 'react';
import { GROUP_COLORS, GROUP_MEMBERS, SPACES } from '../game/data';
import { Game, money, netWorth, rentFor } from '../game/engine';
import { HighScore } from '../game/useGame';

export function Modal({
  children,
  z = 40,
  dim = 0.72,
}: {
  children: React.ReactNode;
  z?: number;
  dim?: number;
}) {
  return (
    <div
      className="fadein fixed inset-0 flex items-center justify-center p-3"
      style={{ zIndex: z, background: `rgba(4,7,15,${dim})`, backdropFilter: 'blur(4px)' }}
    >
      {children}
    </div>
  );
}

export function TitleDeed({ g, i }: { g: Game; i: number }) {
  const sp = SPACES[i];
  const st = g.props[i];
  const color = sp.group ? GROUP_COLORS[sp.group] : '#8fa3c8';
  const owner = st?.owner !== null && st?.owner !== undefined ? g.players[st.owner] : null;
  return (
    <div className="w-full overflow-hidden rounded-xl bg-[#f3eddc] text-[#1a2033] shadow-2xl">
      <div className="px-3 py-2 text-center" style={{ background: color }}>
        <div className="text-[9px] font-bold uppercase tracking-[0.3em] text-black/60">Title Deed</div>
        <div className="deco text-lg font-bold uppercase leading-tight text-black/90">{sp.name}</div>
      </div>
      <div className="space-y-0.5 px-4 py-3 text-[12px]">
        {sp.type === 'prop' && (
          <>
            <Row l="Rent" r={money(sp.rents![0])} />
            <Row l="With colour set" r={money(sp.rents![0] * 2)} />
            {[1, 2, 3, 4].map((h) => (
              <Row key={h} l={`With ${h} house${h > 1 ? 's' : ''}`} r={money(sp.rents![h])} />
            ))}
            <Row l="With HOTEL" r={money(sp.rents![5])} bold />
            <div className="my-1 border-t border-black/20" />
            <Row l="House cost" r={`${money(sp.houseCost!)} each`} />
            <Row l="Hotel cost" r={`${money(sp.houseCost!)} + 4 houses`} />
          </>
        )}
        {sp.type === 'rr' && (
          <>
            <Row l="1 Railroad" r="$25" />
            <Row l="2 Railroads" r="$50" />
            <Row l="3 Railroads" r="$100" />
            <Row l="4 Railroads" r="$200" bold />
          </>
        )}
        {sp.type === 'util' && (
          <>
            <Row l="1 Utility" r="4 × dice roll" />
            <Row l="2 Utilities" r="10 × dice roll" bold />
          </>
        )}
        <div className="my-1 border-t border-black/20" />
        <Row l="Mortgage value" r={money(sp.price! / 2)} />
        <Row l="Price" r={money(sp.price!)} bold />
        {owner && (
          <div className="mt-2 rounded-md px-2 py-1 text-center text-[11px] font-bold" style={{ background: `${owner.color}33` }}>
            Owned by {owner.name}
            {st.houses > 0 && ` • ${st.houses === 5 ? 'HOTEL' : st.houses + ' house(s)'}`}
            {st.mortgaged && ' • MORTGAGED'}
            {!st.mortgaged && <> • current rent {money(rentFor(g, i, 7))}</>}
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ l, r, bold }: { l: string; r: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 ${bold ? 'font-extrabold' : ''}`}>
      <span className="opacity-75">{l}</span>
      <span className="tabular-nums">{r}</span>
    </div>
  );
}

export function StartScreen({
  scores,
  onStart,
  onMultiplayer,
  showTelegram,
}: {
  scores: HighScore[];
  onStart: (name: string, opponents: number) => void;
  onMultiplayer?: () => void;
  showTelegram?: boolean;
}) {
  const [name, setName] = useState(() => localStorage.getItem('deco-city-name') || '');
  const [opp, setOpp] = useState(3);
  const go = () => {
    localStorage.setItem('deco-city-name', name);
    onStart(name.trim() || 'You', opp);
  };
  return (
    <Modal dim={0.9}>
      <div className="popin panel scroll max-h-full w-full max-w-md overflow-y-auto rounded-2xl p-5">
        <div className="text-center">
          <div className="deco text-4xl font-bold leading-none gold-text sm:text-5xl">DECO CITY</div>
          <div className="deco mt-1 text-[10px] tracking-[0.5em] text-amber-200/60">MONOPOLY · TYCOON EDITION</div>
        </div>

        <div className="mt-5 space-y-3">
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-slate-400">Tycoon name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 14))}
              onKeyDown={(e) => e.key === 'Enter' && go()}
              placeholder="Your name"
              className="w-full rounded-lg border border-amber-300/20 bg-black/40 px-3 py-2 text-sm text-amber-50 outline-none focus:border-amber-300/60"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-slate-400">Rivals</label>
            <div className="flex gap-2">
              {[1, 2, 3].map((n) => (
                <button
                  key={n}
                  onClick={() => setOpp(n)}
                  className={`btn flex-1 py-2 text-sm ${opp === n ? 'btn-gold' : 'btn-dark'}`}
                >
                  {n} AI
                </button>
              ))}
            </div>
          </div>
          <button onClick={go} className="btn btn-gold pulse-glow w-full py-3 text-lg deco">
            ▶ PLAY SOLO
          </button>
          {showTelegram && onMultiplayer && (
            <button onClick={onMultiplayer} className="btn btn-dark w-full py-3 text-sm deco">
              ✈ PLAY IN TELEGRAM
            </button>
          )}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 text-[10px] text-slate-400">
          <div className="rounded-lg bg-white/5 p-2">
            <div className="mb-1 font-bold text-amber-200/80">KEYS</div>
            <div>SPACE — roll / continue</div>
            <div>B — buy · A — auction</div>
            <div>E — end turn · P — pause</div>
            <div>R — restart</div>
          </div>
          <div className="rounded-lg bg-white/5 p-2">
            <div className="mb-1 font-bold text-amber-200/80">GOAL</div>
            <div>Bankrupt every rival. Buy deeds, build the colour sets, charge brutal rent.</div>
          </div>
        </div>

        <div className="mt-4">
          <div className="deco mb-1 text-center text-[11px] tracking-[0.3em] text-amber-200/70">HALL OF FAME</div>
          {scores.length === 0 ? (
            <div className="rounded-lg bg-white/5 p-3 text-center text-[11px] text-slate-500">
              No records yet — be the first tycoon.
            </div>
          ) : (
            <div className="space-y-1">
              {scores.slice(0, 5).map((s, i) => (
                <div key={i} className="flex items-center gap-2 rounded-md bg-white/5 px-2 py-1 text-[11px]">
                  <span className="w-4 text-center font-bold text-amber-300">{i + 1}</span>
                  <span className="flex-1 truncate">{s.name}</span>
                  <span className="text-slate-400">{s.won ? '👑' : ''}</span>
                  <span className="font-bold tabular-nums text-emerald-300">{s.score.toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

export function PauseOverlay({ onResume, onRestart, onMenu }: { onResume: () => void; onRestart: () => void; onMenu: () => void }) {
  return (
    <Modal>
      <div className="popin panel w-full max-w-xs rounded-2xl p-5 text-center">
        <div className="deco text-3xl gold-text">PAUSED</div>
        <div className="mt-4 space-y-2">
          <button onClick={onResume} className="btn btn-gold w-full py-2.5">RESUME</button>
          <button onClick={onRestart} className="btn btn-dark w-full py-2.5">RESTART</button>
          <button onClick={onMenu} className="btn btn-dark w-full py-2.5">MAIN MENU</button>
        </div>
        <div className="mt-3 text-[10px] text-slate-500">P or ESC to resume</div>
      </div>
    </Modal>
  );
}

export function GameOverOverlay({
  g,
  last,
  scores,
  onRestart,
  onMenu,
}: {
  g: Game;
  last: HighScore | null;
  scores: HighScore[];
  onRestart: () => void;
  onMenu: () => void;
}) {
  const won = !!last?.won;
  const winner = g.winner !== null ? g.players[g.winner] : null;
  return (
    <Modal dim={0.85}>
      <div className="popin panel scroll max-h-full w-full max-w-sm overflow-y-auto rounded-2xl p-5 text-center">
        <div className={`deco text-4xl font-bold ${won ? 'gold-text' : 'text-rose-400'}`}>
          {won ? '👑 VICTORY' : '💀 BANKRUPT'}
        </div>
        <div className="mt-1 text-[12px] text-slate-300">
          {won ? 'You own Deco City.' : winner ? `${winner.name} rules Deco City.` : 'The bank wins.'}
        </div>

        {last && (
          <div className="mt-4 rounded-xl bg-black/40 p-3">
            <div className="deco text-[10px] tracking-[0.3em] text-amber-200/70">FINAL SCORE</div>
            <div className="deco text-5xl font-bold text-emerald-300 tabular-nums">{last.score.toLocaleString()}</div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-[10px] text-slate-400">
              <div>
                <div className="font-bold text-slate-200">{money(last.worth)}</div>net worth
              </div>
              <div>
                <div className="font-bold text-slate-200">{last.rounds}</div>rounds
              </div>
              <div>
                <div className="font-bold text-slate-200">{g.players.filter((p) => p.bankrupt && p.id !== 0).length}</div>busted
              </div>
            </div>
          </div>
        )}

        <div className="mt-3 space-y-1">
          {g.players.map((p) => (
            <div key={p.id} className="flex items-center gap-2 rounded-md bg-white/5 px-2 py-1 text-[11px]">
              <span>{p.token}</span>
              <span className="flex-1 truncate text-left" style={{ color: p.color }}>{p.name}</span>
              <span className={`tabular-nums ${p.bankrupt ? 'text-rose-400' : 'text-emerald-300'}`}>
                {p.bankrupt ? 'BANKRUPT' : money(netWorth(g, p.id))}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-4">
          <div className="deco mb-1 text-[11px] tracking-[0.3em] text-amber-200/70">HALL OF FAME</div>
          <div className="space-y-1">
            {scores.slice(0, 5).map((s, i) => (
              <div
                key={i}
                className={`flex items-center gap-2 rounded-md px-2 py-1 text-[11px] ${
                  last && s.score === last.score && s.date === last.date ? 'bg-amber-300/20' : 'bg-white/5'
                }`}
              >
                <span className="w-4 font-bold text-amber-300">{i + 1}</span>
                <span className="flex-1 truncate text-left">{s.name}</span>
                <span>{s.won ? '👑' : ''}</span>
                <span className="font-bold tabular-nums text-emerald-300">{s.score.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <button onClick={onRestart} className="btn btn-gold flex-1 py-2.5">PLAY AGAIN (R)</button>
          <button onClick={onMenu} className="btn btn-dark flex-1 py-2.5">MENU</button>
        </div>
      </div>
    </Modal>
  );
}

export function CardOverlay({ g, onAck }: { g: Game; onAck: () => void }) {
  if (!g.card) return null;
  const chance = g.card.deck === 'CHANCE';
  return (
    <Modal z={45} dim={0.6}>
      <div
        className="popin w-full max-w-xs rounded-2xl p-5 text-center shadow-2xl"
        style={{
          background: chance
            ? 'linear-gradient(160deg,#ffb347,#e8720c)'
            : 'linear-gradient(160deg,#8fd3f4,#2a76c7)',
          color: '#10131f',
        }}
        onClick={onAck}
      >
        <div className="deco text-xl font-bold tracking-widest">{chance ? '❓ CHANCE' : '🎁 COMMUNITY CHEST'}</div>
        <div className="my-4 text-[15px] font-semibold leading-snug">{g.card.text}</div>
        <button onClick={onAck} className="btn btn-dark w-full py-2 text-xs">CONTINUE (SPACE)</button>
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
          <button disabled={!afford} onClick={onBuy} className="btn btn-gold flex-1 py-2.5 text-sm">
            BUY {money(sp.price!)} <span className="opacity-60">(B)</span>
          </button>
          <button onClick={onAuction} className="btn btn-dark flex-1 py-2.5 text-sm">
            AUCTION <span className="opacity-60">(A)</span>
          </button>
        </div>
        {!afford && <div className="mt-2 text-center text-[11px] text-rose-300">Not enough cash — it must go to auction.</div>}
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
      <div className="popin panel w-full max-w-xs rounded-2xl p-4 text-center">
        <div className="deco text-sm tracking-[0.3em] text-amber-200/80">🔨 AUCTION</div>
        <div className="deco mt-1 text-xl font-bold" style={{ color: sp.group ? GROUP_COLORS[sp.group] : '#fff' }}>
          {sp.name}
        </div>
        <div className="mt-2 text-[11px] text-slate-400">List price {money(sp.price!)}</div>
        <div className="my-3 rounded-xl bg-black/40 py-3">
          <div className="text-[10px] uppercase tracking-widest text-slate-400">Current bid</div>
          <div className="deco text-3xl font-bold text-emerald-300 tabular-nums">
            {a.high === null ? '—' : money(a.price - 10)}
          </div>
          <div className="text-[11px]" style={{ color: a.high !== null ? g.players[a.high].color : '#64748b' }}>
            {a.high !== null ? `high bidder: ${g.players[a.high].name}` : 'no bids yet'}
          </div>
        </div>
        <div className="mb-2 text-[11px] text-amber-200/80">{a.message}</div>
        <div className="flex flex-wrap justify-center gap-1">
          {g.players.map((p, i) => (
            <span
              key={p.id}
              className="rounded-full px-2 py-0.5 text-[10px] font-bold"
              style={{
                background: a.active[i] ? `${p.color}33` : 'rgba(255,255,255,.05)',
                color: a.active[i] ? p.color : '#64748b',
                textDecoration: a.active[i] ? 'none' : 'line-through',
              }}
            >
              {p.token} {p.name}
            </span>
          ))}
        </div>
        {myTurn ? (
          <div className="mt-3 flex gap-2">
            <button disabled={!canBid} onClick={onBid} className="btn btn-gold flex-1 py-2.5 text-sm">
              BID {money(a.price)}
            </button>
            <button onClick={onPass} className="btn btn-dark flex-1 py-2.5 text-sm">PASS</button>
          </div>
        ) : (
          <div className="mt-3 text-[11px] text-slate-500">
            {a.active[meId] ? 'Rivals are bidding…' : 'You are out of this auction.'}
          </div>
        )}
      </div>
    </Modal>
  );
}

export function InspectOverlay({ g, i, onClose }: { g: Game; i: number; onClose: () => void }) {
  const sp = SPACES[i];
  if (!sp.price) {
    return (
      <Modal z={46} dim={0.6}>
        <div className="popin panel w-full max-w-[260px] rounded-2xl p-5 text-center" onClick={onClose}>
          <div className="deco text-xl gold-text">{sp.name}</div>
          <div className="mt-2 text-[12px] text-slate-300">
            {sp.type === 'tax' && `Pay ${money(sp.tax!)} to the Bank.`}
            {sp.type === 'go' && 'Collect $200 every time you pass.'}
            {sp.type === 'jail' && 'Just visiting — unless the law catches you.'}
            {sp.type === 'parking' && 'A free resting space. Nothing happens.'}
            {sp.type === 'gotojail' && 'Go directly to Jail. Do not pass GO.'}
            {sp.type === 'chance' && 'Draw a Chance card. Fortune favours the bold.'}
            {sp.type === 'chest' && 'Draw a Community Chest card.'}
          </div>
          <button onClick={onClose} className="btn btn-dark mt-4 w-full py-2 text-xs">CLOSE</button>
        </div>
      </Modal>
    );
  }
  const group = sp.group!;
  return (
    <Modal z={46} dim={0.6}>
      <div className="popin w-full max-w-[280px]" onClick={onClose}>
        <TitleDeed g={g} i={i} />
        <div className="mt-2 flex justify-center gap-1">
          {GROUP_MEMBERS[group].map((j) => (
            <span
              key={j}
              className="rounded px-1.5 py-0.5 text-[9px] font-bold"
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
        <button onClick={onClose} className="btn btn-dark mt-3 w-full py-2 text-xs">CLOSE</button>
      </div>
    </Modal>
  );
}

export function ChannelGate({
  welcome,
  comment,
  channels,
  checking,
  error,
  onRecheck,
  onOpen,
}: {
  welcome: string;
  comment: string;
  channels: { title: string; url: string }[];
  checking: boolean;
  error: string | null;
  onRecheck: () => void;
  onOpen: (url: string) => void;
}) {
  return (
    <Modal dim={0.92} z={80}>
      <div className="popin panel scroll max-h-full w-full max-w-md overflow-y-auto rounded-2xl p-5">
        <div className="text-center">
          <div className="deco text-4xl font-bold leading-none gold-text">WELCOME</div>
          <div className="deco mt-1 text-[10px] tracking-[0.45em] text-amber-200/60">DECO CITY</div>
        </div>
        <p className="mt-4 text-center text-sm leading-relaxed text-slate-200">
          {welcome || 'Build an empire, trade deeds, and play with friends inside Telegram.'}
        </p>
        <p className="mt-3 text-center text-[13px] italic text-amber-200/80">
          {comment || 'Play fair, trade bold, and may the best tycoon win.'}
        </p>
        <p className="mt-4 text-center text-[12px] font-semibold tracking-wide text-slate-300">
          {channels.length === 0 && checking
            ? 'Checking channel membership…'
            : 'Join every channel below to use the game.'}
        </p>
        <div className="mt-3 space-y-2">
          {channels.map((ch) => (
            <button
              key={ch.url || ch.title}
              disabled={!ch.url || checking}
              onClick={() => ch.url && onOpen(ch.url)}
              className="btn btn-dark w-full py-3 text-sm"
            >
              Join {ch.title}
            </button>
          ))}
        </div>
        {error && <div className="mt-3 rounded-lg bg-red-500/15 px-3 py-2 text-[12px] text-red-200">{error}</div>}
        <button disabled={checking} onClick={onRecheck} className="btn btn-gold mt-4 w-full py-3 deco">
          {checking ? 'CHECKING…' : "I'VE JOINED"}
        </button>
      </div>
    </Modal>
  );
}
