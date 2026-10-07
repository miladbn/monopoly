import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createRoom,
  fetchRoom,
  joinRoom,
  sendAction,
  setReady,
  startRoom,
  type PublicRoom,
} from '../telegram/api';
import { getInitData, isTelegram } from '../telegram/webapp';
import { Game, newGame } from './engine';
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
  const roomIdRef = useRef<string | null>(initialRoomId || null);
  const versionRef = useRef(0);
  const acting = useRef(false);

  const g: Game = room?.game && (room.status === 'playing' || room.status === 'ended') ? room.game : emptyGame();
  if (room?.status === 'playing' || room?.status === 'ended') {
    g.started = true;
  }

  const applyRoom = useCallback((r: PublicRoom) => {
    setRoom(r);
    roomIdRef.current = r.id;
    versionRef.current = r.version;
    setError(null);
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
      setError(e instanceof Error ? e.message : 'Poll failed');
    } finally {
      polling.current = false;
    }
  }, [applyRoom]);

  useEffect(() => {
    if (!initialRoomId) return;
    let cancelled = false;
    (async () => {
      setBusy(true);
      try {
        if (getInitData()) {
          const r = await joinRoom(initialRoomId);
          if (!cancelled) applyRoom(r);
        } else {
          const r = await fetchRoom(initialRoomId);
          if (!cancelled) applyRoom(r);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Join failed');
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialRoomId, applyRoom]);

  useEffect(() => {
    if (!room?.id) return;
    const t = setInterval(() => {
      void refresh();
    }, 1500);
    return () => clearInterval(t);
  }, [room?.id, refresh]);

  const hostCreate = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      ensureAuth();
      applyRoom(await createRoom());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Create failed');
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
        applyRoom(await joinRoom(id.trim().toUpperCase()));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Join failed');
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
        setError('Room id required — create or join a room first');
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
      setError('Room id required — create or join a room first');
      return;
    }
    roomIdRef.current = id;
    setBusy(true);
    setError(null);
    try {
      ensureAuth();
      applyRoom(await startRoom(id, true));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Start failed');
    } finally {
      setBusy(false);
    }
  }, [applyRoom, room?.id]);

  const leaveLobby = useCallback(() => {
    roomIdRef.current = null;
    versionRef.current = 0;
    setRoom(null);
    setError(null);
  }, []);

  const act = useCallback(
    async (type: MpActionType, payload?: unknown) => {
      if (!roomIdRef.current || acting.current) return;
      acting.current = true;
      try {
        ensureAuth();
        applyRoom(await sendAction(roomIdRef.current, type, payload));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Action failed');
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
  const proposeTrade = useCallback(() => ({ ok: false as const, msg: 'Trades coming soon in multiplayer.' }), []);
  const noop = useCallback(() => undefined, []);
  const setSpeed = useCallback((_v: number) => undefined, []);
  const startSolo = useCallback((_name: string, _opp: number) => undefined, []);

  return {
    room,
    error,
    busy,
    g,
    mySeat: seatIndex,
    isMyTurn,
    respond,
    hostCreate,
    join,
    ready,
    startMatch,
    leaveLobby,
    build,
    sellHouse,
    mortgage,
    unmortgage,
    proposeTrade,
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
  };
}
