import { useCallback, useEffect, useRef, useState } from 'react';
import Board from './components/Board';
import FxLayer from './components/FxLayer';
import { CenterPiece, DeedList, LogPanel, PlayerCard } from './components/Hud';
import LobbyOverlay from './components/LobbyOverlay';
import OnboardingOverlay from './components/OnboardingOverlay';
import {
  AuctionOverlay,
  BuyOverlay,
  CardOverlay,
  BotReportOverlay,
  ChannelGate,
  GameOverOverlay,
  InspectOverlay,
  PauseOverlay,
  StartScreen,
} from './components/Overlays';
import ReactionBar from './components/ReactionBar';
import TradeOverlay from './components/TradeOverlay';
import {
  evaluateGameAchievements,
  titleLabel,
  unlockAchievement,
} from './game/achievements';
import { GROUP_MEMBERS, SPACES } from './game/data';
import { hasMonopoly, money, netWorth } from './game/engine';
import { fx } from './game/fx';
import { loadPlayerProfile, type PlayerAppearance } from './game/playerProfile';
import { settings, todayDailyBest, type HudTab } from './game/settings';
import { renderShareCard, shareOrDownloadCard } from './game/shareCard';
import { sfx } from './game/sfx';
import { useGame } from './game/useGame';
import { useMultiplayerGame } from './game/useMultiplayerGame';
import { fetchAccess, fetchReport, type BotReport, type ChannelLink } from './telegram/api';
import { hapticImpact, hapticNotify } from './telegram/haptics';
import { bootstrapTelegram, getWebApp, isTelegram, openExternal, telegramDisplayName } from './telegram/webapp';

type PlayMode = 'menu' | 'solo' | 'mp';

type AccessState =
  | { status: 'skip' }
  | { status: 'loading' }
  | { status: 'ok'; admin: boolean }
  | { status: 'blocked'; welcome: string; comment: string; channels: ChannelLink[]; error: string | null; checking: boolean }
  | { status: 'error'; message: string };

export default function App() {
  const boot = useRef(bootstrapTelegram());
  const inTelegram = isTelegram();
  const [access, setAccess] = useState<AccessState>(inTelegram ? { status: 'loading' } : { status: 'skip' });
  const reconnectId = settings.getReconnectRoom();
  const [mode, setMode] = useState<PlayMode>(() =>
    boot.current.roomFromStart || reconnectId || inTelegram ? 'mp' : 'menu',
  );
  const [mpRoomHint] = useState(boot.current.roomFromStart || reconnectId || undefined);
  const [wantMp, setWantMp] = useState(!!boot.current.roomFromStart || !!reconnectId);

  const solo = useGame();
  const mp = useMultiplayerGame(wantMp ? mpRoomHint : undefined);

  const active = mode === 'mp' || wantMp ? mp : solo;
  const g = active.g;
  const respond = active.respond;
  const meId =
    mode === 'mp' || (wantMp && mp.room)
      ? mp.mySeat !== undefined
        ? mp.mySeat
        : mp.isSpectator
          ? -1
          : 0
      : 0;

  const shakeRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [boardSize, setBoardSize] = useState(420);
  const [hudTab, setHudTab] = useState<HudTab>('play');
  const [inspect, setInspect] = useState<number | null>(null);
  const [trade, setTrade] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(() => !settings.onboarded());
  const [colorblind, setColorblind] = useState(() => settings.colorblind());
  const [musicMuted, setMusicMuted] = useState(sfx.musicMuted);
  const cfg = useRef<{ name: string; opp: number; look: PlayerAppearance; daily?: boolean }>({
    name: telegramDisplayName(),
    opp: 3,
    look: loadPlayerProfile(),
  });
  const [muted, setMuted] = useState(sfx.muted);
  const [reportOpen, setReportOpen] = useState(false);
  const [report, setReport] = useState<BotReport | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [newTitles, setNewTitles] = useState<string[]>([]);
  const achievementsDone = useRef<string | null>(null);
  const onTile = useCallback((i: number) => setInspect(i), []);

  const loadReport = useCallback(async () => {
    setReportLoading(true);
    setReportError(null);
    try {
      setReport(await fetchReport());
    } catch (e) {
      setReportError(e instanceof Error ? e.message : 'Could not load the report');
    } finally {
      setReportLoading(false);
    }
  }, []);

  const recheckAccess = useCallback(async (manual = false) => {
    if (!inTelegram) return;
    setAccess((prev) =>
      prev.status === 'blocked' ? { ...prev, checking: true, error: null } : { status: 'loading' },
    );
    try {
      const result = await fetchAccess();
      if (result.ok) {
        setAccess({ status: 'ok', admin: result.admin });
        if (result.admin) {
          setReportOpen(true);
          void loadReport();
        }
      }
      else {
        setAccess({
          status: 'blocked',
          welcome: result.welcome,
          comment: result.comment,
          channels: result.channels,
          checking: false,
          error: manual ? 'Join every channel, then tap again.' : null,
        });
      }
    } catch (e) {
      setAccess({ status: 'error', message: e instanceof Error ? e.message : 'Could not check channels' });
    }
  }, [inTelegram, loadReport]);

  useEffect(() => {
    if (!inTelegram) return;
    void recheckAccess(false);
  }, [inTelegram, recheckAccess]);

  useEffect(() => {
    if (access.status !== 'ok' || !inTelegram) return;
    setWantMp(true);
    setMode('mp');
  }, [access.status, inTelegram]);

  useEffect(() => {
    fx.setShakeTarget(shakeRef.current);
    return () => fx.setShakeTarget(null);
  }, []);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      const minSide = Math.min(r.width, r.height);
      // Never force the board larger than its stage — that overflowed on phones.
      setBoardSize(Math.max(180, Math.floor(minSide)));
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, [g.started]);

  // Enter mp mode when room is created/joined
  useEffect(() => {
    if (wantMp && mp.room) setMode('mp');
  }, [wantMp, mp.room]);

  const me = g.players[meId];
  const watching = mode === 'mp' && !!mp.watching;
  const myTurn =
    !!me &&
    !g.paused &&
    !watching &&
    (mode === 'mp' ? mp.isMyTurn : !!g.players[g.turn]?.human && g.turn === meId);

  useEffect(() => {
    if (g.phase !== 'over') {
      achievementsDone.current = null;
      return;
    }
    const key = `${mode}-${mp.room?.id || 'solo'}-${g.round}-${g.winner}`;
    if (achievementsDone.current === key) return;
    achievementsDone.current = key;
    const pid = mode === 'mp' ? (mp.mySeat ?? -1) : 0;
    const won = g.winner === pid;
    const hadMono =
      pid >= 0 &&
      Object.keys(GROUP_MEMBERS).some(
        (gr) => gr !== 'rr' && gr !== 'util' && hasMonopoly(g, gr, pid),
      );
    const builtHotel =
      pid >= 0 && SPACES.some((s) => s.price && g.props[s.i]?.owner === pid && g.props[s.i].houses === 5);
    const seriesWins =
      mode === 'mp' && mp.room?.series && getWebApp()?.initDataUnsafe?.user?.id
        ? mp.room.series.wins[String(getWebApp()!.initDataUnsafe!.user!.id)] || 0
        : 0;
    const earned = evaluateGameAchievements({
      won,
      hadMonopoly: hadMono,
      builtHotel,
      escapedJail: !!g.escapedJail,
      wonAuction: !!g.wonAuction,
      seriesWins,
      wasQuickMatch: mode === 'mp' && mp.room?.inviteOnly === false,
    });
    if (mode === 'mp' && mp.isSpectator) unlockAchievement('spectate');
    const labels = earned
      .map((id) => titleLabel(id))
      .filter((t): t is string => !!t);
    if (labels.length) setNewTitles(labels);
  }, [g.phase, g.winner, g.round, mode, mp.room?.id, mp.room?.series, mp.room?.inviteOnly, mp.mySeat, mp.isSpectator, g]);

  const primary = useCallback(() => {
    if (!g.started || g.paused || g.phase === 'over') return;
    switch (g.phase) {
      case 'card':
        if (mode === 'mp' ? myTurn || g.turn === meId : true) respond('ack', true);
        break;
      case 'roll':
        if (myTurn) respond(g.jailChoice ? 'jail' : 'roll', g.jailChoice ? 'roll' : true);
        break;
      case 'manage':
        if (myTurn || g.turn === meId) respond('endturn', true);
        break;
      case 'buy':
        if (me && me.cash >= (SPACES[g.buySpace ?? 0].price || 0)) respond('buy', 'buy');
        else respond('buy', 'auction');
        break;
      case 'auction':
        if (g.auction && g.auction.current === meId && me && me.cash >= g.auction.price) respond('auction', 'bid');
        break;
    }
  }, [g, myTurn, respond, mode, meId, me]);

  const restart = useCallback(() => {
    if (mode === 'mp') return;
    solo.start(cfg.current.name, cfg.current.opp, cfg.current.look, { daily: cfg.current.daily });
  }, [mode, solo]);

  useEffect(() => {
    if (g.started && !sfx.musicMuted) sfx.startMusic();
    return () => sfx.stopMusic();
  }, [g.started]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (!g.started) return;
      if (k === ' ' || k === 'enter') {
        e.preventDefault();
        primary();
      } else if (k === 'p' || k === 'escape') {
        e.preventDefault();
        if (g.phase !== 'over' && mode !== 'mp') solo.togglePause();
      } else if (k === 'r') {
        if (mode !== 'mp' && (g.phase === 'over' || g.paused)) restart();
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
  }, [g, primary, respond, solo, restart, mode]);

  const score = me ? netWorth(g, meId) : 0;
  const inLobby = wantMp && (!mp.room || mp.room.status === 'lobby');
  const showStart = mode === 'menu' && !wantMp && !g.started;

  useEffect(() => {
    if (myTurn) hapticImpact('medium');
  }, [myTurn, g.turn, g.phase]);

  const actionBar = () => {
    if (g.phase === 'roll' && myTurn && g.jailChoice) {
      return (
        <div className="grid grid-cols-3 gap-2">
          <button type="button" className="btn btn-gold min-h-[44px] py-2.5 text-xs" disabled={!me || me.cash < 50} onClick={() => respond('jail', 'pay')}>
            Pay $50
          </button>
          <button type="button" className="btn btn-dark min-h-[44px] py-2.5 text-xs" disabled={!me || me.getOut < 1} onClick={() => respond('jail', 'card')}>
            Use card
          </button>
          <button type="button" className="btn btn-green min-h-[44px] py-2.5 text-xs" onClick={() => respond('jail', 'roll')}>
            Roll doubles
          </button>
        </div>
      );
    }
    if (g.phase === 'roll' && myTurn) {
      return (
        <div className="flex gap-2">
          <button
            type="button"
            className="btn btn-gold pulse-glow min-h-[48px] flex-1 py-2.5 text-base sm:min-h-[52px] sm:py-4 sm:text-lg"
            onClick={() => {
              hapticImpact('heavy');
              respond('roll', true);
            }}
          >
            Roll dice
          </button>
          <button type="button" className="btn btn-dark min-h-[48px] px-3 py-2.5 text-xs sm:min-h-[52px] sm:py-4" onClick={() => setTrade(true)} aria-label="Trade">
            Trade
          </button>
        </div>
      );
    }
    if (g.phase === 'manage' && (myTurn || g.turn === meId)) {
      return (
        <div className="flex gap-2">
          <button type="button" className="btn btn-gold min-h-[48px] flex-1 py-2.5 text-base sm:min-h-[52px] sm:py-4" onClick={() => respond('endturn', true)}>
            End turn
          </button>
          <button type="button" className="btn btn-dark min-h-[48px] px-3 py-2.5 text-xs sm:min-h-[52px] sm:py-4" onClick={() => setHudTab('deeds')} aria-label="Open deeds">
            Deeds
          </button>
          <button type="button" className="btn btn-dark min-h-[48px] px-3 py-2.5 text-xs sm:min-h-[52px] sm:py-4" onClick={() => setTrade(true)} aria-label="Trade">
            Trade
          </button>
        </div>
      );
    }
    if (g.phase === 'card' && (mode !== 'mp' || g.turn === meId)) {
      return (
        <button type="button" className="btn btn-gold min-h-[48px] w-full py-2.5 sm:min-h-[52px] sm:py-4" onClick={() => respond('ack', true)}>
          Continue
        </button>
      );
    }
    if (watching) {
      return (
        <div className="flex min-h-[44px] items-center justify-center rounded-lg bg-black/25 px-2 text-[12px] font-medium text-[var(--champagne)] sm:min-h-[48px] sm:text-[13px]">
          {mp.isSpectator ? 'Spectating' : 'You’re out — watching'} · {g.players[g.turn]?.name ?? ''}’s turn
        </div>
      );
    }
    const label =
      g.phase === 'moving'
        ? 'Moving…'
        : g.phase === 'buy'
          ? 'Choose buy or auction'
          : g.phase === 'auction'
            ? 'Auction in progress'
            : `${g.players[g.turn]?.name ?? ''} is playing…`;
    return (
      <div className="flex min-h-[44px] items-center justify-center rounded-lg bg-black/25 px-2 text-[12px] font-medium text-[var(--mist)] sm:min-h-[48px] sm:text-[13px]">
        {label}
      </div>
    );
  };

  const seriesLabel = (() => {
    const s = mp.room?.series;
    if (!s || mode !== 'mp') return null;
    const parts = mp.room!.players.map((p) => {
      const w = s.wins[String(p.telegramId)] || 0;
      return `${p.name.split(' ')[0]} ${w}`;
    });
    return `${parts.join(' · ')} (first to ${s.target})`;
  })();

  const goSoloMenu = () => {
    setWantMp(false);
    setMode('menu');
    mp.leaveLobby();
    solo.toMenu();
  };

  return (
    <div
      className="fixed inset-0 overflow-hidden"
      style={{
        background:
          'radial-gradient(ellipse at 50% -10%, #1f4a3d 0%, #0f2a24 42%, #0a1412 78%)',
      }}
    >
      <div ref={shakeRef} className="h-full w-full will-change-transform">
        <div
          className="app-shell flex h-full w-full flex-col gap-1.5 p-1.5 sm:gap-2 sm:p-2 landscape:flex-row lg:flex-row"
          style={{
            paddingTop: 'max(0.375rem, env(safe-area-inset-top))',
            paddingBottom: 'max(0.375rem, env(safe-area-inset-bottom))',
            paddingLeft: 'max(0.375rem, env(safe-area-inset-left))',
            paddingRight: 'max(0.375rem, env(safe-area-inset-right))',
          }}
        >
          <div className="flex min-h-0 flex-1 flex-col gap-1.5 sm:gap-2">
            <div className="flex items-center justify-between gap-1.5 px-0.5 sm:gap-2 sm:px-1">
              <div className="flex min-w-0 items-baseline gap-1.5 sm:gap-2">
                <span className="deco shrink-0 text-base font-bold leading-none gold-text sm:text-2xl">Deco City</span>
                {mode === 'mp' && mp.room && (
                  <span className="truncate rounded-md bg-[var(--brass)]/15 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-[var(--champagne)]">
                    {mp.room.id}
                  </span>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
                <div className="rounded-lg bg-black/35 px-1.5 py-0.5 text-right leading-tight sm:px-2.5 sm:py-1">
                  <div className="text-[9px] font-medium text-[var(--mist)] sm:text-[10px]">Score</div>
                  <div className="text-[12px] font-extrabold tabular-nums text-emerald-300/90 sm:text-[13px]">{money(score)}</div>
                </div>
                {mode !== 'mp' && (
                  <button
                    type="button"
                    className="btn btn-dark min-h-[36px] px-2 py-1.5 text-[11px] sm:min-h-[40px] sm:px-2.5 sm:py-2"
                    onClick={() => solo.setSpeed(solo.speed === 1 ? 2 : 1)}
                    title="Toggle game speed"
                  >
                    {solo.speed === 1 ? '1×' : '2×'}
                  </button>
                )}
                {access.status === 'ok' && access.admin && (
                  <button
                    type="button"
                    className="btn btn-dark hidden min-h-[40px] px-2.5 py-2 text-[11px] sm:inline-flex"
                    onClick={() => {
                      setReportOpen(true);
                      void loadReport();
                    }}
                    title="Bot report"
                  >
                    Report
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-dark min-h-[36px] px-2 py-1.5 text-[11px] sm:min-h-[40px] sm:px-2.5 sm:py-2"
                  onClick={() => {
                    sfx.unlock();
                    setMuted(sfx.toggle());
                  }}
                  title={muted ? 'Unmute SFX' : 'Mute SFX'}
                  aria-label={muted ? 'Unmute sound effects' : 'Mute sound effects'}
                >
                  SFX
                </button>
                <button
                  type="button"
                  className="btn btn-dark min-h-[36px] px-2 py-1.5 text-[11px] sm:min-h-[40px]"
                  onClick={() => {
                    sfx.unlock();
                    setMusicMuted(sfx.toggleMusic());
                  }}
                  title={musicMuted ? 'Unmute music' : 'Mute music'}
                >
                  {musicMuted ? '♪' : '♫'}
                </button>
                <button
                  type="button"
                  className="btn btn-dark min-h-[36px] px-2 py-1.5 text-[11px] sm:min-h-[40px]"
                  onClick={() => {
                    const next = !colorblind;
                    settings.setColorblind(next);
                    setColorblind(next);
                  }}
                  title="Colorblind ownership marks"
                >
                  CB
                </button>
                {mode !== 'mp' && (
                  <button
                    type="button"
                    className="btn btn-dark min-h-[36px] px-2 py-1.5 text-[11px] sm:min-h-[40px] sm:px-3 sm:py-2"
                    onClick={solo.togglePause}
                    aria-label="Pause"
                  >
                    II
                  </button>
                )}
              </div>
            </div>
            <div ref={boxRef} className="board-stage flex min-h-0 flex-1 items-center justify-center">
              <div style={{ width: boardSize, height: boardSize }}>
                <Board g={g} onTile={onTile} onCenter={primary} colorblind={colorblind}>
                  <CenterPiece g={g} meId={meId} />
                </Board>
              </div>
            </div>
          </div>

          <aside className="panel hud-panel flex w-full shrink-0 flex-col gap-1 rounded-xl p-1.5 sm:gap-2 sm:p-2.5 landscape:h-auto landscape:w-[300px] lg:h-auto lg:w-[330px]">
            <div className="grid shrink-0 grid-cols-2 gap-1 landscape:grid-cols-1 lg:grid-cols-1">
              {g.players.map((p) => {
                const mpPlayer = mp.room?.players.find((rp) => rp.seat === p.id);
                return (
                  <PlayerCard
                    key={p.id}
                    g={g}
                    pid={p.id}
                    active={g.turn === p.id}
                    disconnected={mode === 'mp' && p.human && mpPlayer?.connected === false}
                    title={mode === 'mp' ? titleLabel(mpPlayer?.title) : undefined}
                  />
                );
              })}
            </div>

            {g.started && <div className="action-dock shrink-0">{actionBar()}</div>}

            {mode === 'mp' && g.started && g.phase !== 'over' && (
              <ReactionBar
                reactions={mp.room?.reactions || []}
                disabled={mp.busy}
                onReact={(emoji) => void mp.react(emoji)}
              />
            )}

            {mode === 'solo' && solo.canUndoBuy && (
              <button
                type="button"
                className="btn btn-dark shrink-0 py-2 text-xs"
                onClick={() => {
                  if (solo.undoBuy()) hapticNotify('warning');
                }}
              >
                Undo last buy
              </button>
            )}

            <div className="flex shrink-0 gap-1">
              {(
                [
                  ['play', 'Play'],
                  ['feed', 'Feed'],
                  [
                    'deeds',
                    `Deeds (${SPACES.filter((s) => s.price && g.props[s.i].owner === meId).length})`,
                  ],
                ] as const
              ).map(([t, label]) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setHudTab(t)}
                  className={`min-h-[36px] flex-1 rounded-md py-1 text-[11px] font-semibold transition-colors sm:min-h-[40px] sm:py-1.5 ${
                    hudTab === t
                      ? 'bg-[var(--brass)]/20 text-[var(--champagne)]'
                      : 'bg-black/20 text-[var(--mist)]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="hud-scroll flex min-h-0 flex-1 flex-col overflow-hidden">
              {hudTab === 'feed' ? (
                <LogPanel g={g} />
              ) : hudTab === 'deeds' ? (
                meId < 0 ? (
                  <p className="py-4 text-center text-[12px] text-[var(--mist)]">Spectating — no deeds to manage.</p>
                ) : (
                  <DeedList
                    g={g}
                    meId={meId}
                    onBuild={watching ? () => undefined : active.build}
                    onSell={watching ? () => undefined : active.sellHouse}
                    onMortgage={watching ? () => undefined : active.mortgage}
                    onUnmortgage={watching ? () => undefined : active.unmortgage}
                    onInspect={setInspect}
                  />
                )
              ) : (
                <p className="px-1 py-2 text-center text-[12px] text-[var(--mist)]">
                  {watching
                    ? 'Watching the table — send a reaction anytime.'
                    : myTurn
                      ? 'Your turn — use the button above.'
                      : `${g.players[g.turn]?.name ?? 'Rival'} is playing.`}
                </p>
              )}
            </div>

            {mode === 'mp' && mp.error && (
              <div className="rounded-md bg-[var(--wine)]/25 px-2 py-1.5 text-[11px] text-[#f0b4bb]">{mp.error}</div>
            )}
          </aside>
        </div>
      </div>

      <FxLayer />

      {reportOpen && access.status === 'ok' && access.admin && (
        <BotReportOverlay
          report={report}
          loading={reportLoading}
          error={reportError}
          onRefresh={() => void loadReport()}
          onClose={() => setReportOpen(false)}
        />
      )}

      {access.status === 'ok' && access.admin && !reportOpen && inLobby && (
        <button
          type="button"
          className="btn btn-gold fixed bottom-4 right-4 px-3 py-2 text-[12px]"
          style={{ zIndex: 55 }}
          onClick={() => {
            setReportOpen(true);
            void loadReport();
          }}
        >
          Bot report
        </button>
      )}

      {inTelegram && access.status !== 'ok' && access.status !== 'skip' && (
        <ChannelGate
          welcome={access.status === 'blocked' ? access.welcome : ''}
          comment={access.status === 'blocked' ? access.comment : ''}
          channels={access.status === 'blocked' ? access.channels : []}
          checking={access.status === 'loading' || (access.status === 'blocked' && access.checking)}
          error={access.status === 'error' ? access.message : access.status === 'blocked' ? access.error : null}
          onRecheck={() => void recheckAccess(true)}
          onOpen={openExternal}
        />
      )}

      {showOnboarding && <OnboardingOverlay onDone={() => setShowOnboarding(false)} />}

      {showStart && (
        <StartScreen
          scores={solo.scores}
          showTelegram
          dailyBest={todayDailyBest()}
          onMultiplayer={() => {
            setWantMp(true);
            setMode('mp');
          }}
          onStart={(name, opp, look, opts) => {
            cfg.current = { name, opp, look, daily: opts?.daily };
            sfx.unlock();
            setMode('solo');
            solo.start(name, opp, look, opts);
          }}
        />
      )}

      {inLobby && (
        <LobbyOverlay
          room={mp.room}
          busy={mp.busy}
          error={mp.error}
          isHost={!!mp.room && getWebApp()?.initDataUnsafe?.user?.id === mp.room.hostTelegramId}
          meReady={
            !!mp.room?.players.find((p) => p.telegramId === getWebApp()?.initDataUnsafe?.user?.id)?.ready
          }
          onReady={(v) => void mp.ready(v)}
          onStart={() => void mp.startMatch()}
          onLeave={goSoloMenu}
          onCreate={(m) => void mp.hostCreate(m)}
          onQuickMatch={() => void mp.findQuickMatch()}
          onJoin={(code) => void mp.join(code)}
          onSpectate={(code) => void mp.spectate(code)}
          onAppearance={(look) => void mp.syncAppearance(look)}
          onKick={(id) => void mp.kick(id)}
          onLock={(locked) => void mp.setLocked(locked)}
        />
      )}

      {mode === 'solo' && g.started && g.paused && g.phase !== 'over' && (
        <PauseOverlay onResume={solo.togglePause} onRestart={restart} onMenu={goSoloMenu} />
      )}
      {g.phase === 'over' && (
        <GameOverOverlay
          g={g}
          meId={meId}
          last={
            mode === 'solo'
              ? solo.lastScore
              : {
                  name: me?.name || 'You',
                  score: me ? netWorth(g, meId) : 0,
                  worth: me ? netWorth(g, meId) : 0,
                  rounds: g.round,
                  won: g.winner === meId,
                  date: new Date().toISOString(),
                }
          }
          scores={mode === 'solo' ? solo.scores : []}
          onRestart={mode === 'solo' ? restart : goSoloMenu}
          onMenu={goSoloMenu}
          onRematch={mode === 'mp' ? () => void mp.rematch() : undefined}
          rematchBusy={mp.busy}
          seriesLabel={seriesLabel}
          newTitles={newTitles}
          isHost={mode === 'mp' && !!mp.room && getWebApp()?.initDataUnsafe?.user?.id === mp.room.hostTelegramId}
          isSpectator={mode === 'mp' && !!mp.isSpectator}
          onShare={() => {
            const url = renderShareCard({
              g,
              meId,
              won: !!(mode === 'solo' ? solo.lastScore?.won : g.winner === meId),
              score: mode === 'solo' ? solo.lastScore?.score : undefined,
            });
            void shareOrDownloadCard(url);
            hapticNotify('success');
          }}
        />
      )}
      {!g.paused && g.phase === 'card' && (mode !== 'mp' || g.turn === meId) && (
        <CardOverlay g={g} onAck={() => respond('ack', true)} />
      )}
      {!g.paused && g.phase === 'buy' && g.buySpace !== null && (mode !== 'mp' || g.turn === meId) && (
        <BuyOverlay
          g={g}
          i={g.buySpace}
          meId={meId}
          onBuy={() => {
            hapticImpact('medium');
            respond('buy', 'buy');
          }}
          onAuction={() => respond('buy', 'auction')}
        />
      )}
      {!g.paused && g.phase === 'auction' && g.auction && (
        <AuctionOverlay
          g={g}
          meId={meId}
          onBid={() => respond('auction', 'bid')}
          onPass={() => respond('auction', 'pass')}
        />
      )}
      {inspect !== null && (
        <InspectOverlay g={g} i={inspect} onClose={() => setInspect(null)} />
      )}
      {trade && g.started && g.phase !== 'over' && (
        <TradeOverlay
          g={g}
          meId={meId}
          onClose={() => setTrade(false)}
          onOffer={mode === 'mp' ? mp.proposeTrade : solo.proposeTrade}
        />
      )}
      {mode === 'mp' && mp.pendingTrade && mp.pendingTrade.to === meId && (
        <div className="fadein fixed inset-0 z-[48] flex items-end justify-center bg-black/60 p-3 sm:items-center">
          <div className="panel sheet-panel w-full max-w-sm rounded-xl p-4 sm:rounded-xl">
            <h3 className="deco text-center text-xl gold-text">Trade offer</h3>
            <p className="mt-2 text-center text-[13px] text-[var(--mist)]">
              {g.players[mp.pendingTrade.from]?.name} wants to trade with you.
            </p>
            <div className="mt-4 flex gap-2">
              <button type="button" className="btn btn-gold flex-1 py-3" onClick={() => mp.respondTrade(true)}>
                Accept
              </button>
              <button type="button" className="btn btn-dark flex-1 py-3" onClick={() => mp.respondTrade(false)}>
                Decline
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
