import { useState } from 'react';
import PlayerAppearancePicker from './PlayerAppearancePicker';
import { GROUP_COLORS, GROUP_MEMBERS, SPACES } from '../game/data';
import { Game, money, netWorth, rentFor } from '../game/engine';
import {
  loadPlayerName,
  loadPlayerProfile,
  savePlayerName,
  savePlayerProfile,
  type PlayerAppearance,
} from '../game/playerProfile';
import { HighScore } from '../game/useGame';
import type { BotReport } from '../telegram/api';

export function Modal({
  children,
  z = 40,
  dim = 0.72,
  sheet = false,
}: {
  children: React.ReactNode;
  z?: number;
  dim?: number;
  /** Bottom sheet on narrow screens; centered on sm+ */
  sheet?: boolean;
}) {
  return (
    <div
      className={`fadein fixed inset-0 flex p-2 sm:items-center sm:justify-center sm:p-3 ${
        sheet ? 'items-end justify-center' : 'items-center justify-center'
      }`}
      style={{
        zIndex: z,
        background: `rgba(6,14,12,${dim})`,
        backdropFilter: 'blur(6px)',
        paddingTop: 'max(0.5rem, env(safe-area-inset-top))',
        paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))',
      }}
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
    <div className="w-full overflow-hidden rounded-lg bg-[#f4efe4] text-[#1a2018] shadow-2xl">
      <div className="px-3 py-2.5 text-center" style={{ background: color }}>
        <div className="text-[10px] font-semibold tracking-wide text-black/55">Title deed</div>
        <div className="deco text-lg font-bold leading-tight text-black/90">{sp.name}</div>
      </div>
      <div className="space-y-0.5 px-4 py-3 text-[12px]">
        {sp.type === 'prop' && (
          <>
            <Row l="Rent" r={money(sp.rents![0])} />
            <Row l="With colour set" r={money(sp.rents![0] * 2)} />
            {[1, 2, 3, 4].map((h) => (
              <Row key={h} l={`With ${h} house${h > 1 ? 's' : ''}`} r={money(sp.rents![h])} />
            ))}
            <Row l="With hotel" r={money(sp.rents![5])} bold />
            <div className="my-1 border-t border-black/15" />
            <Row l="House cost" r={`${money(sp.houseCost!)} each`} />
            <Row l="Hotel cost" r={`${money(sp.houseCost!)} + 4 houses`} />
          </>
        )}
        {sp.type === 'rr' && (
          <>
            <Row l="1 railroad" r="$25" />
            <Row l="2 railroads" r="$50" />
            <Row l="3 railroads" r="$100" />
            <Row l="4 railroads" r="$200" bold />
          </>
        )}
        {sp.type === 'util' && (
          <>
            <Row l="1 utility" r="4 × dice roll" />
            <Row l="2 utilities" r="10 × dice roll" bold />
          </>
        )}
        <div className="my-1 border-t border-black/15" />
        <Row l="Mortgage value" r={money(sp.price! / 2)} />
        <Row l="Price" r={money(sp.price!)} bold />
        {owner && (
          <div className="mt-2 rounded-md px-2 py-1 text-center text-[11px] font-semibold" style={{ background: `${owner.color}33` }}>
            Owned by {owner.name}
            {st.houses > 0 && ` · ${st.houses === 5 ? 'hotel' : `${st.houses} house${st.houses > 1 ? 's' : ''}`}`}
            {st.mortgaged && ' · mortgaged'}
            {!st.mortgaged && <> · rent {money(rentFor(g, i, 7))}</>}
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
  dailyBest,
}: {
  scores: HighScore[];
  onStart: (name: string, opponents: number, appearance: PlayerAppearance, opts?: { daily?: boolean }) => void;
  onMultiplayer?: () => void;
  showTelegram?: boolean;
  dailyBest?: { score: number; won: boolean } | null;
}) {
  const [name, setName] = useState(() => loadPlayerName());
  const [opp, setOpp] = useState(3);
  const [appearance, setAppearance] = useState(loadPlayerProfile);
  const go = (daily = false) => {
    savePlayerName(name);
    savePlayerProfile(appearance);
    onStart(name.trim() || 'You', daily ? 3 : opp, appearance, { daily });
  };
  return (
    <Modal dim={0.88}>
      <div className="popin panel step-frame scroll relative max-h-[min(92dvh,720px)] w-full max-w-md overflow-y-auto rounded-xl p-3.5 sm:p-6">
        <div className="sunburst" aria-hidden />
        <div className="relative text-center">
          <h1 className="deco brand-in text-[2rem] font-bold leading-none gold-text sm:text-5xl">Deco City</h1>
          <p className="mt-1.5 text-[12px] leading-snug text-[var(--mist)] sm:mt-2 sm:text-[13px]">
            Buy the board. Build the sets. Bankrupt the table.
          </p>
        </div>

        <div className="relative mt-4 space-y-2.5 sm:mt-6 sm:space-y-3">
          <div>
            <label className="mb-1 block text-[12px] font-medium text-[var(--mist)]" htmlFor="tycoon-name">
              Your name
            </label>
            <input
              id="tycoon-name"
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 14))}
              onKeyDown={(e) => e.key === 'Enter' && go(false)}
              placeholder="Tycoon"
              className="field"
              autoComplete="nickname"
            />
          </div>
          <div>
            <div className="mb-1 block text-[12px] font-medium text-[var(--mist)]">Rivals</div>
            <div className="flex gap-2" role="group" aria-label="Number of AI rivals">
              {[1, 2, 3].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setOpp(n)}
                  className={`btn flex-1 py-2 text-sm sm:py-2.5 ${opp === n ? 'btn-gold' : 'btn-dark'}`}
                  aria-pressed={opp === n}
                >
                  {n} AI
                </button>
              ))}
            </div>
          </div>
          <PlayerAppearancePicker
            value={appearance}
            onChange={(next) => {
              setAppearance(next);
              savePlayerProfile(next);
            }}
            compact
          />
          <button type="button" onClick={() => go(false)} className="btn btn-gold pulse-glow w-full py-3 text-base sm:py-3.5">
            Play solo
          </button>
          <button type="button" onClick={() => go(true)} className="btn btn-dark w-full py-2.5 text-sm sm:py-3">
            Daily challenge
            {dailyBest ? ` · best ${dailyBest.score.toLocaleString()}` : ''}
          </button>
          {showTelegram && onMultiplayer && (
            <button type="button" onClick={onMultiplayer} className="btn btn-dark w-full py-2.5 text-sm sm:py-3">
              Play with friends
            </button>
          )}
        </div>

        <p className="relative mt-3 hidden text-center text-[11px] leading-relaxed text-[var(--mist)]/80 sm:mt-5 sm:block">
          Space rolls · B buys · A auctions · E ends turn · P pauses
        </p>

        <div className="relative mt-3 border-t border-[var(--brass)]/15 pt-3 sm:mt-5 sm:pt-4">
          <div className="deco mb-1.5 text-center text-[12px] text-[var(--brass)] sm:mb-2">Hall of fame</div>
          {scores.length === 0 ? (
            <p className="py-1.5 text-center text-[12px] text-[var(--mist)]/70 sm:py-2">No scores yet. Claim the first seat.</p>
          ) : (
            <div className="space-y-1">
              {scores.slice(0, 5).map((s, i) => (
                <div key={i} className="flex items-center gap-2 rounded-md bg-black/25 px-2.5 py-1.5 text-[12px]">
                  <span className="w-4 text-center font-bold text-[var(--brass)]">{i + 1}</span>
                  <span className="flex-1 truncate">{s.name}</span>
                  {s.won && <span className="text-[10px] text-[var(--brass)]">won</span>}
                  <span className="font-bold tabular-nums text-emerald-300/90">{s.score.toLocaleString()}</span>
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
      <div className="popin panel w-full max-w-xs rounded-xl p-6 text-center">
        <div className="deco text-3xl gold-text">Paused</div>
        <div className="mt-5 space-y-2">
          <button type="button" onClick={onResume} className="btn btn-gold w-full py-2.5">Resume</button>
          <button type="button" onClick={onRestart} className="btn btn-dark w-full py-2.5">Restart</button>
          <button type="button" onClick={onMenu} className="btn btn-dark w-full py-2.5">Main menu</button>
        </div>
        <p className="mt-4 text-[11px] text-[var(--mist)]">Press P or Esc to resume</p>
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
  onShare,
  onRematch,
  rematchBusy,
  seriesLabel,
  newTitles,
  isHost,
  isSpectator,
}: {
  g: Game;
  last: HighScore | null;
  scores: HighScore[];
  onRestart: () => void;
  onMenu: () => void;
  onShare?: () => void;
  onRematch?: () => void;
  rematchBusy?: boolean;
  seriesLabel?: string | null;
  newTitles?: string[];
  isHost?: boolean;
  isSpectator?: boolean;
}) {
  const winner = g.winner !== null ? g.players[g.winner] : null;
  const won = last ? !!last.won : false;
  return (
    <Modal dim={0.85}>
      <div className="popin panel scroll max-h-full w-full max-w-sm overflow-y-auto rounded-xl p-6 text-center">
        <div className={`deco text-3xl font-bold sm:text-4xl ${isSpectator ? 'gold-text' : won ? 'gold-text' : 'text-[#e07a88]'}`}>
          {isSpectator ? 'Match over' : won ? 'Victory' : 'Bankrupt'}
        </div>
        <p className="mt-2 text-[13px] text-[var(--mist)]">
          {isSpectator
            ? winner
              ? `${winner.name} rules Deco City.`
              : 'The match has ended.'
            : won
              ? 'You own Deco City.'
              : winner
                ? `${winner.name} rules Deco City.`
                : 'The bank wins.'}
        </p>
        {seriesLabel && (
          <p className="mt-2 text-[13px] font-semibold text-[var(--brass)]">Series · {seriesLabel}</p>
        )}
        {newTitles && newTitles.length > 0 && (
          <div className="mt-3 rounded-lg bg-[var(--brass)]/15 px-3 py-2 text-[12px] text-[var(--champagne)]">
            New title{newTitles.length > 1 ? 's' : ''}: {newTitles.join(', ')}
          </div>
        )}

        {last && (
          <div className="mt-5 rounded-lg bg-black/35 p-4">
            <div className="text-[12px] font-medium text-[var(--mist)]">Final score</div>
            <div className="deco mt-1 text-5xl font-bold tabular-nums text-emerald-300/95">{last.score.toLocaleString()}</div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-[11px] text-[var(--mist)]">
              <div>
                <div className="font-bold text-[var(--ivory)]">{money(last.worth)}</div>net worth
              </div>
              <div>
                <div className="font-bold text-[var(--ivory)]">{last.rounds}</div>rounds
              </div>
              <div>
                <div className="font-bold text-[var(--ivory)]">{g.players.filter((p) => p.bankrupt && p.id !== 0).length}</div>busted
              </div>
            </div>
          </div>
        )}

        <div className="mt-4 space-y-1">
          {g.players.map((p) => (
            <div key={p.id} className="flex items-center gap-2 rounded-md bg-black/25 px-2.5 py-1.5 text-[12px]">
              <span aria-hidden>{p.token}</span>
              <span className="flex-1 truncate text-left" style={{ color: p.color }}>{p.name}</span>
              <span className={`tabular-nums ${p.bankrupt ? 'text-[#e07a88]' : 'text-emerald-300/90'}`}>
                {p.bankrupt ? 'Out' : money(netWorth(g, p.id))}
              </span>
            </div>
          ))}
        </div>

        {scores.length > 0 && (
          <div className="mt-5 border-t border-[var(--brass)]/15 pt-4">
            <div className="deco mb-2 text-[12px] text-[var(--brass)]">Hall of fame</div>
            <div className="space-y-1">
              {scores.slice(0, 5).map((s, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[12px] ${
                    last && s.score === last.score && s.date === last.date ? 'bg-[var(--brass)]/20' : 'bg-black/25'
                  }`}
                >
                  <span className="w-4 font-bold text-[var(--brass)]">{i + 1}</span>
                  <span className="flex-1 truncate text-left">{s.name}</span>
                  {s.won && <span className="text-[10px] text-[var(--brass)]">won</span>}
                  <span className="font-bold tabular-nums text-emerald-300/90">{s.score.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-5 flex flex-col gap-2">
          {onShare && (
            <button type="button" onClick={onShare} className="btn btn-dark w-full py-2.5">
              Share result
            </button>
          )}
          {onRematch && isHost && (
            <button
              type="button"
              disabled={rematchBusy}
              onClick={onRematch}
              className="btn btn-gold w-full py-2.5"
            >
              {rematchBusy ? 'Starting rematch…' : 'Rematch (best of 3)'}
            </button>
          )}
          {onRematch && !isHost && (
            <p className="text-[12px] text-[var(--mist)]">Waiting for host to rematch…</p>
          )}
          <div className="flex gap-2">
            <button type="button" onClick={onRestart} className="btn btn-gold flex-1 py-2.5">
              {onRematch ? 'Leave' : 'Play again'}
            </button>
            <button type="button" onClick={onMenu} className="btn btn-dark flex-1 py-2.5">Menu</button>
          </div>
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
        className="popin w-full max-w-xs rounded-xl p-6 text-center shadow-2xl"
        style={{
          background: chance
            ? 'linear-gradient(160deg,#f0c56e,#c97820)'
            : 'linear-gradient(160deg,#7ec8b8,#2a6b5c)',
          color: '#101814',
        }}
        onClick={onAck}
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
            {a.high === null ? '—' : money(a.price - 10)}
          </div>
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
      <Modal z={46} dim={0.6} sheet>
        <div className="popin panel sheet-panel w-full max-w-md rounded-t-2xl p-5 text-center sm:max-w-[280px] sm:rounded-xl" onClick={onClose}>
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
    <Modal z={46} dim={0.6} sheet>
      <div className="popin sheet-panel w-full max-w-md sm:max-w-[280px]" onClick={onClose}>
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
      <div className="popin panel step-frame scroll relative max-h-full w-full max-w-md overflow-y-auto rounded-xl p-6">
        <div className="sunburst" aria-hidden />
        <div className="relative text-center">
          <h1 className="deco brand-in text-4xl font-bold leading-none gold-text">Deco City</h1>
          <p className="mt-3 text-sm leading-relaxed text-[var(--ivory)]/90">
            {welcome || 'Build an empire, trade deeds, and play with friends in Telegram.'}
          </p>
          {comment && (
            <p className="mt-2 text-[13px] text-[var(--champagne)]/80">{comment}</p>
          )}
        </div>
        <p className="relative mt-5 text-center text-[13px] font-medium text-[var(--mist)]">
          {channels.length === 0 && checking
            ? 'Checking channel membership…'
            : 'Join each channel below, then continue.'}
        </p>
        <div className="relative mt-3 space-y-2">
          {channels.map((ch) => (
            <button
              key={ch.url || ch.title}
              type="button"
              disabled={!ch.url || checking}
              onClick={() => ch.url && onOpen(ch.url)}
              className="btn btn-dark w-full py-3 text-sm"
            >
              Join {ch.title}
            </button>
          ))}
        </div>
        {error && (
          <div className="relative mt-3 rounded-lg bg-[var(--wine)]/25 px-3 py-2 text-[12px] text-[#f0b4bb]">{error}</div>
        )}
        <button type="button" disabled={checking} onClick={onRecheck} className="btn btn-gold relative mt-4 w-full py-3">
          {checking ? 'Checking…' : "I've joined — continue"}
        </button>
      </div>
    </Modal>
  );
}

function ago(at: number): string {
  const min = Math.round((Date.now() - at) / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 48) return `${hr}h ago`;
  return new Date(at).toLocaleDateString();
}

export function BotReportOverlay({
  report,
  loading,
  error,
  onClose,
  onRefresh,
}: {
  report: BotReport | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const counts = report?.counts;
  const tiles = [
    { label: 'Players', value: counts?.users },
    { label: 'Bot starts', value: counts?.starts },
    { label: 'App opens', value: counts?.opens },
    { label: 'Rooms', value: counts?.rooms },
    { label: 'Games', value: counts?.games },
  ];
  return (
    <Modal dim={0.92} z={70}>
      <div className="popin panel scroll max-h-full w-full max-w-md overflow-y-auto rounded-xl p-6">
        <div className="text-center">
          <h2 className="deco text-3xl font-bold leading-none gold-text">Bot report</h2>
          <p className="mt-1 text-[12px] text-[var(--mist)]">
            {report?.bot.username ? `@${report.bot.username}` : 'Deco City'}
          </p>
        </div>

        {loading && !report && (
          <p className="mt-6 text-center text-sm text-[var(--mist)]">Loading the report…</p>
        )}
        {error && (
          <div className="mt-4 rounded-lg bg-[var(--wine)]/25 px-3 py-2 text-[12px] text-[#f0b4bb]">{error}</div>
        )}

        {report && (
          <>
            <div className="mt-5 grid grid-cols-2 gap-2">
              {tiles.map((tile) => (
                <div key={tile.label} className="rounded-lg bg-black/30 px-3 py-2.5">
                  <div className="text-[12px] font-medium text-[var(--mist)]">{tile.label}</div>
                  <div className="text-xl font-extrabold tabular-nums text-[var(--champagne)]">
                    {(tile.value ?? 0).toLocaleString()}
                  </div>
                </div>
              ))}
              <div className="rounded-lg bg-black/30 px-3 py-2.5">
                <div className="text-[12px] font-medium text-[var(--mist)]">Webhook</div>
                <div className="text-sm font-extrabold text-[var(--champagne)]">
                  {report.webhook.set ? 'Connected' : 'Not set'}
                </div>
                <div className="text-[11px] text-[var(--mist)]">{report.webhook.pending.toLocaleString()} pending</div>
              </div>
            </div>
            {report.webhook.lastError && (
              <p className="mt-2 text-[12px] text-[#f0b4bb]">Last webhook error: {report.webhook.lastError}</p>
            )}

            {report.channels.length > 0 && (
              <div className="mt-5">
                <div className="text-[12px] font-medium text-[var(--mist)]">Channels</div>
                <div className="mt-1.5 space-y-1">
                  {report.channels.map((ch) => (
                    <div key={ch.title} className="flex items-center justify-between rounded-md bg-black/25 px-2.5 py-1.5 text-[12px]">
                      <span>{ch.title}</span>
                      <span className="tabular-nums text-[var(--mist)]">
                        {ch.members === null ? '—' : `${ch.members.toLocaleString()} members`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-5">
              <div className="text-[12px] font-medium text-[var(--mist)]">Recent players</div>
              {report.recent.length === 0 ? (
                <p className="mt-1.5 text-[12px] text-[var(--mist)]">No players recorded yet.</p>
              ) : (
                <div className="mt-1.5 space-y-1">
                  {report.recent.map((row, i) => (
                    <div key={`${row.id}-${row.at}-${i}`} className="flex items-center justify-between gap-2 rounded-md bg-black/25 px-2.5 py-1.5 text-[12px]">
                      <span className="min-w-0 truncate">
                        {row.name}
                        {row.username ? <span className="text-[var(--mist)]"> @{row.username}</span> : null}
                      </span>
                      <span className="shrink-0 text-[11px] text-[var(--mist)]">
                        {row.event === 'start' ? 'start' : 'app'} · {ago(row.at)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        <div className="mt-5 flex gap-2">
          <button type="button" disabled={loading} onClick={onRefresh} className="btn btn-dark flex-1 py-3 text-sm">
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
          <button type="button" onClick={onClose} className="btn btn-gold flex-1 py-3">
            Play
          </button>
        </div>
      </div>
    </Modal>
  );
}
