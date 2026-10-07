import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createRoom,
  fetchRoom,
  joinRoom,
  kickPlayer,
  quickMatch,
  rematchRoom,
  roomCodeFromInput,
  sendAction,
  sendHeartbeat,
  sendReaction,
  setLobbyLock,
  setPlayerAppearance,
  setReady,
  spectateRoom,
  startRoom,
  type PlayerAppearance,
  type PublicRoom,
} from '../telegram/api';
import { getInitData, isTelegram } from '../telegram/webapp';
import { getEquippedTitle } from './achievements';
import { settings } from './settings';
import { Game, newGame } from './engine';
import { loadPlayerProfile, savePlayerProfile } from './playerProfile';
import type { MpActionType } from './mpEngine';
import type { HighScore } from './useGame';

function emptyGame(): Game {
  const g = newGame('You', 3);
  g.started = false;
  g.phase = 'menu';
  return g;
}

function ensureAuth() {
  if (!getInitData() && isTelegram()) throw new Error('Telegram initData missing — open via the bot');
  if (!getInitData()) throw new Error('Open this game from the Telegram bot to play multiplayer');
}

export function useMultiplayerGame(initialRoomId?: string) {
  const [room, setRoom] = useState<PublicRoom | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [scores] = useState<HighScore[]>([]);
  const [lastScore] = useState<HighScore | null>(null);
  const [optimisticRolling, setOptimisticRolling] = useState(false);
  const roomIdRef = useRef<string | null>(initialRoomId || settings.getReconnectRoom() || null);
  const versionRef = useRef(0);
  const acting = useRef(false);
  const profileRef = useRef<PlayerAppearance>(loadPlayerProfile());

  const baseGame: Game =
    room?.game && (room.status === 'playing' || room.status === 'ended') ? room.game : emptyGame();
  const g: Game =
    room?.status === 'playing' || room?.status === 'ended'
      ? {
          ...baseGame,
          started: true,
          rolling: optimisticRolling ? true : baseGame.rolling,
        }
      : baseGame;

  const applyRoom = useCallback((r: PublicRoom) => {
    setRoom(r);
    roomIdRef.current = r.id;
    versionRef.current = r.version;
    settings.setReconnectRoom(r.id);
    setError(null);
    setOptimisticRolling(false);
  }, []);

  const polling = useRef(false);
  const refresh = useCallback(async () => {
    const id = roomIdRef.current;
    if (!id || polling.current) return;
    polling.current = true;
    try {
      const r = await fetchRoom(id);
      if (r.version >= versionRef.current) applyRoom(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not refresh the room. Check your connection.');
    } finally {
      polling.current = false;
    }
  }, [applyRoom]);

  // Reconnect / deep-link join
  useEffect(() => {
    const id = initialRoomId || settings.getReconnectRoom();
    if (!id) return;
    let cancelled = false;
    (async () => {
      setBusy(true);
      try {
        if (getInitData()) {
          const r = await joinRoom(id, profileRef.current);
          if (!cancelled) applyRoom(r);
        } else {
          const r = await fetchRoom(id);
          if (!cancelled) applyRoom(r);
        }
      } catch (e) {
        if (!cancelled) {
          settings.setReconnectRoom(null);
          setError(e instanceof Error ? e.message : 'Could not rejoin room');
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialRoomId, applyRoom]);

  // Adaptive poll: faster on your turn / auction / lobby
  useEffect(() => {
    if (!room?.id) return;
    const mySeat = room.mySeat;
    const urgent =
      room.status === 'lobby' ||
      (room.game &&
        mySeat !== undefined &&
        (room.game.turn === mySeat ||
          room.game.phase === 'auction' ||
          (room.game as { pendingTrade?: { to: number } | null }).pendingTrade?.to === mySeat));
    const ms = urgent ? 500 : 1600;
    const t = setInterval(() => {
      void refresh();
    }, ms);
    return () => clearInterval(t);
  }, [room?.id, room?.status, room?.mySeat, room?.game?.turn, room?.game?.phase, room?.version, refresh]);

  // Heartbeat presence
  useEffect(() => {
    if (!room?.id || !getInitData()) return;
    const beat = async () => {
      try {
        applyRoom(await sendHeartbeat(room.id));
      } catch {
        /* ignore transient */
      }
    };
    void beat();
    const t = setInterval(() => void beat(), 12000);
    return () => clearInterval(t);
  }, [room?.id, applyRoom]);

  const hostCreate = useCallback(async (mode: 'invite' | 'public' = 'invite') => {
    setBusy(true);
    setError(null);
    try {
      ensureAuth();
      applyRoom(await createRoom(profileRef.current, { mode, title: getEquippedTitle() }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create room');
    } finally {
      setBusy(false);
    }
  }, [applyRoom]);

  const findQuickMatch = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      ensureAuth();
      applyRoom(await quickMatch(profileRef.current, getEquippedTitle()));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Quick match failed');
    } finally {
      setBusy(false);
    }
  }, [applyRoom]);

  const join = useCallback(
    async (id: string) => {
      setBusy(true);
      setError(null);
      try {
        ensureAuth();
        applyRoom(await joinRoom(roomCodeFromInput(id), profileRef.current, getEquippedTitle()));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not join room');
      } finally {
        setBusy(false);
      }
    },
    [applyRoom],
  );

  const spectate = useCallback(
    async (id: string) => {
      setBusy(true);
      setError(null);
      try {
        ensureAuth();
        applyRoom(await spectateRoom(roomCodeFromInput(id), profileRef.current, getEquippedTitle()));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not spectate');
      } finally {
        setBusy(false);
      }
    },
    [applyRoom],
  );

  const ready = useCallback(
    async (value: boolean) => {
      const id = roomIdRef.current || room?.id;
      if (!id) {
        setError('Create or join a room first');
        return;
      }
      roomIdRef.current = id;
      try {
        ensureAuth();
        applyRoom(await setReady(id, value));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Ready failed');
      }
    },
    [applyRoom, room?.id],
  );

  const startMatch = useCallback(async () => {
    const id = roomIdRef.current || room?.id;
    if (!id) {
      setError('Create or join a room first');
      return;
    }
    roomIdRef.current = id;
    setBusy(true);
    setError(null);
    try {
      ensureAuth();
      applyRoom(await startRoom(id, true));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start the game');
    } finally {
      setBusy(false);
    }
  }, [applyRoom, room?.id]);

  const leaveLobby = useCallback(() => {
    roomIdRef.current = null;
    versionRef.current = 0;
    settings.setReconnectRoom(null);
    setRoom(null);
    setError(null);
  }, []);

  const syncAppearance = useCallback(
    async (appearance: PlayerAppearance) => {
      profileRef.current = appearance;
      savePlayerProfile(appearance);
      const id = roomIdRef.current || room?.id;
      if (!id || room?.status !== 'lobby') return;
      try {
        ensureAuth();
        applyRoom(await setPlayerAppearance(id, appearance, getEquippedTitle()));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not save look');
      }
    },
    [applyRoom, room?.id, room?.status],
  );

  const kick = useCallback(
    async (targetId: number) => {
      const id = roomIdRef.current || room?.id;
      if (!id) return;
      try {
        ensureAuth();
        applyRoom(await kickPlayer(id, targetId));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Kick failed');
      }
    },
    [applyRoom, room?.id],
  );

  const setLocked = useCallback(
    async (locked: boolean) => {
      const id = roomIdRef.current || room?.id;
      if (!id) return;
      try {
        ensureAuth();
        applyRoom(await setLobbyLock(id, locked));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not update lock');
      }
    },
    [applyRoom, room?.id],
  );

  const act = useCallback(
    async (type: MpActionType, payload?: unknown) => {
      if (!roomIdRef.current || acting.current) return;
      acting.current = true;
      if (type === 'roll' || (type === 'jail' && payload === 'roll')) setOptimisticRolling(true);
      try {
        ensureAuth();
        applyRoom(await sendAction(roomIdRef.current, type, payload));
      } catch (e) {
        setOptimisticRolling(false);
        setError(e instanceof Error ? e.message : 'Action failed — try again');
        await refresh();
      } finally {
        acting.current = false;
      }
    },
    [applyRoom, refresh],
  );

  const respond = useCallback(
    (type: string, value: unknown) => {
      void act(type as MpActionType, value === true ? undefined : value);
    },
    [act],
  );

  const seatIndex = room?.mySeat;
  const isMyTurn = !!room?.game && seatIndex !== undefined && room.game.turn === seatIndex && !room.game.paused;

  const build = useCallback((i: number) => void act('build', i), [act]);
  const sellHouse = useCallback((i: number) => void act('sellHouse', i), [act]);
  const mortgage = useCallback((i: number) => void act('mortgage', i), [act]);
  const unmortgage = useCallback((i: number) => void act('unmortgage', i), [act]);

  const proposeTrade = useCallback(
    (rival: number, give: number[], get: number[], cash: number) => {
      void act('tradeOffer', { to: rival, give, get, cash });
      return { ok: true as const, msg: 'Offer sent — waiting for reply…' };
    },
    [act],
  );

  const respondTrade = useCallback(
    (accept: boolean) => void act('tradeRespond', { accept }),
    [act],
  );

  const react = useCallback(
    async (emoji: string) => {
      const id = roomIdRef.current || room?.id;
      if (!id) return;
      try {
        ensureAuth();
        applyRoom(await sendReaction(id, emoji));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Reaction failed');
      }
    },
    [applyRoom, room?.id],
  );

  const rematch = useCallback(async () => {
    const id = roomIdRef.current || room?.id;
    if (!id) return;
    setBusy(true);
    setError(null);
    try {
      ensureAuth();
      applyRoom(await rematchRoom(id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Rematch failed');
    } finally {
      setBusy(false);
    }
  }, [applyRoom, room?.id]);

  const noop = useCallback(() => undefined, []);
  const setSpeed = useCallback((_v: number) => undefined, []);
  const startSolo = useCallback((_name: string, _opp: number, _look?: PlayerAppearance) => undefined, []);

  const isSpectator = !!room?.isSpectator;
  const meBankrupt =
    seatIndex !== undefined && !!room?.game?.players?.[seatIndex]?.bankrupt;
  const watching = isSpectator || meBankrupt;

  return {
    room,
    error,
    busy,
    g,
    mySeat: seatIndex,
    isMyTurn: isMyTurn && !watching,
    isSpectator,
    watching,
    respond,
    hostCreate,
    findQuickMatch,
    join,
    spectate,
    ready,
    startMatch,
    leaveLobby,
    syncAppearance,
    kick,
    setLocked,
    build,
    sellHouse,
    mortgage,
    unmortgage,
    proposeTrade,
    respondTrade,
    react,
    rematch,
    scores,
    lastScore,
    toMenu: leaveLobby,
    togglePause: noop,
    setSpeed,
    speed: 1,
    paused: false,
    sync: noop,
    start: startSolo,
    isMultiplayer: true as const,
    pendingTrade: room?.game && 'pendingTrade' in room.game ? room.game.pendingTrade : null,
  };
}
