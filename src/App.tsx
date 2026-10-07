import { useCallback, useEffect, useRef, useState } from 'react';
import Board from './components/Board';
import FxLayer from './components/FxLayer';
import { CenterPiece, DeedList, LogPanel, PlayerCard } from './components/Hud';
import {
  AuctionOverlay,
  BuyOverlay,
  CardOverlay,
  GameOverOverlay,
  InspectOverlay,
  PauseOverlay,
  StartScreen,
} from './components/Overlays';
import TradeOverlay from './components/TradeOverlay';
import { SPACES } from './game/data';
import { money, netWorth } from './game/engine';
import { fx } from './game/fx';
import { sfx } from './game/sfx';
import { useGame } from './game/useGame';

export default function App() {
  const game = useGame();
  const { g, respond } = game;
  const shakeRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [boardSize, setBoardSize] = useState(420);
  const [tab, setTab] = useState<'log' | 'deeds'>('log');
  const [inspect, setInspect] = useState<number | null>(null);
  const [trade, setTrade] = useState(false);
  const cfg = useRef({ name: 'You', opp: 3 });
  const [muted, setMuted] = useState(sfx.muted);
  const onTile = useCallback((i: number) => setInspect(i), []);

  useEffect(() => {
    fx.setShakeTarget(shakeRef.current);
    return () => fx.setShakeTarget(null);
  }, []);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setBoardSize(Math.max(240, Math.floor(Math.min(r.width, r.height))));
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, [g.started]);

  const myTurn = g.players[g.turn]?.human && !g.paused;

  const primary = useCallback(() => {
    if (!g.started || g.paused || g.phase === 'over') return;
    switch (g.phase) {
      case 'card':
        respond('ack', true);
        break;
      case 'roll':
        if (myTurn) respond(g.jailChoice ? 'jail' : 'roll', g.jailChoice ? 'roll' : true);
        break;
      case 'manage':
        respond('endturn', true);
        break;
      case 'buy':
        if (g.players[0].cash >= (SPACES[g.buySpace ?? 0].price || 0)) respond('buy', 'buy');
        else respond('buy', 'auction');
        break;
      case 'auction':
        if (g.auction && g.auction.current === 0 && g.players[0].cash >= g.auction.price) respond('auction', 'bid');
        break;
    }
  }, [g, myTurn, respond]);

  const restart = useCallback(() => game.start(cfg.current.name, cfg.current.opp), [game]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (!g.started) return;
      if (k === ' ' || k === 'enter') {
        e.preventDefault();
        primary();
      } else if (k === 'p' || k === 'escape') {
        e.preventDefault();
        if (g.phase !== 'over') game.togglePause();
      } else if (k === 'r') {
        if (g.phase === 'over' || g.paused) restart();
      } else if (k === 'b') {
        if (g.phase === 'buy') respond('buy', 'buy');
      } else if (k === 'a') {
        if (g.phase === 'buy') respond('buy', 'auction');
        else if (g.phase === 'auction') respond('auction', 'pass');
      } else if (k === 'e') {
        if (g.phase === 'manage') respond('endturn', true);
      } else if (k === 'j') {
        if (g.jailChoice) respond('jail', 'pay');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [g, primary, respond, game, restart]);

  const me = g.players[0];
  const score = me ? netWorth(g, 0) : 0;

  /* ---------- action bar (plain function: keeps DOM stable across renders) ---------- */
  const actionBar = () => {
    if (g.phase === 'roll' && myTurn && g.jailChoice) {
      return (
        <div className="grid grid-cols-3 gap-2">
          <button className="btn btn-gold py-3 text-xs" disabled={me.cash < 50} onClick={() => respond('jail', 'pay')}>
            PAY $50
          </button>
          <button className="btn btn-dark py-3 text-xs" disabled={me.getOut < 1} onClick={() => respond('jail', 'card')}>
            USE CARD
          </button>
          <button className="btn btn-green py-3 text-xs" onClick={() => respond('jail', 'roll')}>
            ROLL DOUBLES
          </button>
        </div>
      );
    }
    if (g.phase === 'roll' && myTurn) {
      return (
        <div className="flex gap-2">
          <button className="btn btn-gold pulse-glow flex-1 py-4 text-lg deco" onClick={() => respond('roll', true)}>
            🎲 ROLL <span className="text-xs opacity-60">(SPACE)</span>
          </button>
          <button className="btn btn-dark px-3 py-4 text-xs" onClick={() => setTrade(true)}>
            🤝
          </button>
        </div>
      );
    }
    if (g.phase === 'manage') {
      return (
        <div className="flex gap-2">
          <button className="btn btn-gold flex-1 py-4 text-base deco" onClick={() => respond('endturn', true)}>
            END TURN <span className="text-xs opacity-60">(E)</span>
          </button>
          <button className="btn btn-dark px-3 py-4 text-xs" onClick={() => setTab('deeds')}>
            🏗️
          </button>
          <button className="btn btn-dark px-3 py-4 text-xs" onClick={() => setTrade(true)}>
            🤝
          </button>
        </div>
      );
    }
    if (g.phase === 'card') {
      return (
        <button className="btn btn-gold w-full py-4 deco" onClick={() => respond('ack', true)}>
          CONTINUE
        </button>
      );
    }
    const label =
      g.phase === 'moving'
        ? 'Moving…'
        : g.phase === 'buy'
          ? 'Decide: buy or auction'
          : g.phase === 'auction'
            ? 'Auction in progress'
            : `${g.players[g.turn]?.name ?? ''} is playing…`;
    return (
      <div className="flex h-[58px] items-center justify-center rounded-lg bg-white/5 text-[12px] font-semibold tracking-wide text-slate-400">
        {label}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 overflow-hidden" style={{ background: 'radial-gradient(circle at 50% 0%, #121c35 0%, #070b16 70%)' }}>
      <div ref={shakeRef} className="h-full w-full will-change-transform">
        <div className="flex h-full w-full flex-col gap-2 p-2 landscape:flex-row lg:flex-row">
          {/* board column */}
          <div className="flex min-h-0 flex-1 flex-col gap-2">
            <div className="flex items-center justify-between gap-2 px-1">
              <div className="flex items-baseline gap-2">
                <span className="deco text-lg font-bold leading-none gold-text sm:text-2xl">DECO CITY</span>
                <span className="hidden text-[10px] tracking-[0.35em] text-amber-200/40 sm:inline">TYCOON</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="rounded-lg bg-black/40 px-2.5 py-1 text-right leading-tight">
                  <div className="text-[8px] uppercase tracking-widest text-slate-400">Score</div>
                  <div className="text-[13px] font-extrabold tabular-nums text-emerald-300">{money(score)}</div>
                </div>
                <button
                  className="btn btn-dark px-2.5 py-2 text-[11px]"
                  onClick={() => game.setSpeed(game.speed === 1 ? 0.45 : 1)}
                  title="Toggle game speed"
                >
                  {game.speed === 1 ? '⏩ 1×' : '⏩ 2×'}
                </button>
                <button
                  className="btn btn-dark px-2.5 py-2 text-[11px]"
                  onClick={() => {
                    sfx.unlock();
                    setMuted(sfx.toggle());
                  }}
                  title="Sound"
                >
                  {muted ? '🔇' : '🔊'}
                </button>
                <button className="btn btn-dark px-3 py-2 text-[11px]" onClick={game.togglePause}>
                  ⏸
                </button>
              </div>
            </div>
            <div ref={boxRef} className="flex min-h-0 flex-1 items-center justify-center">
              <div style={{ width: boardSize, height: boardSize }}>
                <Board g={g} onTile={onTile} onCenter={primary}>
                  <CenterPiece g={g} />
                </Board>
              </div>
            </div>
          </div>

          {/* side panel */}
          <aside className="panel flex h-[38vh] w-full shrink-0 flex-col gap-2 rounded-xl p-2 landscape:h-auto landscape:w-[300px] lg:h-auto lg:w-[330px]">
            <div className="grid grid-cols-2 gap-1 landscape:grid-cols-1 lg:grid-cols-1">
              {g.players.map((p) => (
                <PlayerCard key={p.id} g={g} pid={p.id} active={g.turn === p.id} />
              ))}
            </div>

            <div className="flex gap-1">
              {(['log', 'deeds'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`flex-1 rounded-md py-1 text-[10px] font-bold uppercase tracking-widest transition-colors ${
                    tab === t ? 'bg-amber-300/20 text-amber-200' : 'bg-white/5 text-slate-500'
                  }`}
                >
                  {t === 'log' ? 'Ticker' : `My Deeds (${SPACES.filter((s) => s.price && g.props[s.i].owner === 0).length})`}
                </button>
              ))}
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              {tab === 'log' ? (
                <LogPanel g={g} />
              ) : (
                <DeedList
                  g={g}
                  onBuild={game.build}
                  onSell={game.sellHouse}
                  onMortgage={game.mortgage}
                  onUnmortgage={game.unmortgage}
                  onInspect={setInspect}
                />
              )}
            </div>

            {actionBar()}
          </aside>
        </div>
      </div>

      <FxLayer />

      {!g.started && (
        <StartScreen
          scores={game.scores}
          onStart={(name, opp) => {
            cfg.current = { name, opp };
            sfx.unlock();
            game.start(name, opp);
          }}
        />
      )}
      {g.started && g.paused && g.phase !== 'over' && (
        <PauseOverlay onResume={game.togglePause} onRestart={restart} onMenu={game.toMenu} />
      )}
      {g.phase === 'over' && (
        <GameOverOverlay g={g} last={game.lastScore} scores={game.scores} onRestart={restart} onMenu={game.toMenu} />
      )}
      {!g.paused && g.phase === 'card' && <CardOverlay g={g} onAck={() => respond('ack', true)} />}
      {!g.paused && g.phase === 'buy' && g.buySpace !== null && (
        <BuyOverlay
          g={g}
          i={g.buySpace}
          onBuy={() => respond('buy', 'buy')}
          onAuction={() => respond('buy', 'auction')}
        />
      )}
      {!g.paused && g.phase === 'auction' && g.auction && (
        <AuctionOverlay g={g} onBid={() => respond('auction', 'bid')} onPass={() => respond('auction', 'pass')} />
      )}
      {inspect !== null && <InspectOverlay g={g} i={inspect} onClose={() => setInspect(null)} />}
      {trade && g.started && g.phase !== 'over' && (
        <TradeOverlay g={g} onClose={() => setTrade(false)} onOffer={game.proposeTrade} />
      )}
    </div>
  );
}
