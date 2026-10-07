import type { MpActionType } from '../game/mpEngine';
import type { Game } from '../game/engine';
import { getInitData } from './webapp';

export interface PublicPlayer {
  telegramId: number;
  name: string;
  avatar?: string;
  pieceToken?: string;
  pieceColor?: string;
  ready: boolean;
  seat: number;
  lastSeenAt?: number;
  connected?: boolean;
}

export interface PlayerAppearance {
  token: string;
  color: string;
}

function appearanceBody(appearance?: PlayerAppearance) {
  if (!appearance) return {};
  return { pieceToken: appearance.token, pieceColor: appearance.color };
}

export interface PendingTrade {
  from: number;
  to: number;
  give: number[];
  get: number[];
  cash: number;
}

export interface PublicRoom {
  id: string;
  chatId?: number;
  hostTelegramId: number;
  players: PublicPlayer[];
  status: 'lobby' | 'playing' | 'ended';
  maxPlayers: number;
  inviteOnly?: boolean;
  joinLocked?: boolean;
  version: number;
  createdAt: number;
  game: (Game & { pendingTrade?: PendingTrade | null }) | null;
  seatMap: Record<number, number>;
  mySeat?: number;
}

async function request<T>(path: string, opts: RequestInit & { initData?: string } = {}): Promise<T> {
  const initData = opts.initData ?? getInitData();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(opts.headers as Record<string, string>),
  };
  if (initData) {
    headers['X-Telegram-Init-Data'] = initData;
  }
  const { initData: _i, ...rest } = opts;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(path, { ...rest, headers, signal: ctrl.signal });
    const text = await res.text();
    let data: { error?: string } = {};
    try {
      data = text ? (JSON.parse(text) as { error?: string }) : {};
    } catch {
      throw new Error(
        res.ok ? 'Invalid server response' : `Server error ${res.status}. Redeploy and check Vercel env vars.`,
      );
    }
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data as T;
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error('Request timed out — API may be down. Check Vercel deployment & env vars.');
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export async function createRoom(appearance?: PlayerAppearance): Promise<PublicRoom> {
  const data = await request<{ room: PublicRoom }>('/api/rooms', {
    method: 'POST',
    body: JSON.stringify({ initData: getInitData(), ...appearanceBody(appearance) }),
  });
  return data.room;
}

export async function fetchRoom(id: string): Promise<PublicRoom> {
  const data = await request<{ room: PublicRoom }>(`/api/room?id=${encodeURIComponent(id)}`, {
    method: 'GET',
  });
  return data.room;
}

export async function joinRoom(id: string, appearance?: PlayerAppearance): Promise<PublicRoom> {
  const data = await request<{ room: PublicRoom }>('/api/room', {
    method: 'POST',
    body: JSON.stringify({
      action: 'join',
      roomId: id.trim().toUpperCase(),
      initData: getInitData(),
      ...appearanceBody(appearance),
    }),
  });
  return data.room;
}

export async function setPlayerAppearance(id: string, appearance: PlayerAppearance): Promise<PublicRoom> {
  const data = await request<{ room: PublicRoom }>('/api/room', {
    method: 'POST',
    body: JSON.stringify({
      action: 'appearance',
      roomId: id,
      initData: getInitData(),
      ...appearanceBody(appearance),
    }),
  });
  return data.room;
}

export async function setReady(id: string, ready: boolean): Promise<PublicRoom> {
  const data = await request<{ room: PublicRoom }>('/api/room', {
    method: 'POST',
    body: JSON.stringify({ action: 'ready', roomId: id, ready, initData: getInitData() }),
  });
  return data.room;
}

export async function sendHeartbeat(id: string): Promise<PublicRoom> {
  const data = await request<{ room: PublicRoom }>('/api/room', {
    method: 'POST',
    body: JSON.stringify({ action: 'heartbeat', roomId: id, initData: getInitData() }),
  });
  return data.room;
}

export async function kickPlayer(id: string, targetId: number): Promise<PublicRoom> {
  const data = await request<{ room: PublicRoom }>('/api/room', {
    method: 'POST',
    body: JSON.stringify({ action: 'kick', roomId: id, targetId, initData: getInitData() }),
  });
  return data.room;
}

export async function setLobbyLock(id: string, locked: boolean): Promise<PublicRoom> {
  const data = await request<{ room: PublicRoom }>('/api/room', {
    method: 'POST',
    body: JSON.stringify({ action: 'lock', roomId: id, locked, initData: getInitData() }),
  });
  return data.room;
}

export async function startRoom(id: string, fillAi = true): Promise<PublicRoom> {
  const data = await request<{ room: PublicRoom }>('/api/room', {
    method: 'POST',
    body: JSON.stringify({ action: 'start', roomId: id, fillAi, initData: getInitData() }),
  });
  return data.room;
}

export async function sendAction(id: string, type: MpActionType, payload?: unknown): Promise<PublicRoom> {
  const data = await request<{ room: PublicRoom }>('/api/room', {
    method: 'POST',
    body: JSON.stringify({ action: 'action', roomId: id, type, payload, initData: getInitData() }),
  });
  return data.room;
}

export interface ChannelLink {
  title: string;
  url: string;
}

export interface AccessOk {
  ok: true;
  admin: boolean;
  welcome: string;
  comment: string;
}

export interface AccessBlocked {
  ok: false;
  error: string;
  welcome: string;
  comment: string;
  channels: ChannelLink[];
}

export async function fetchAccess(): Promise<AccessOk | AccessBlocked> {
  const initData = getInitData();
  const headers: Record<string, string> = {};
  if (initData) headers['X-Telegram-Init-Data'] = initData;
  const res = await fetch('/api/access', { headers });
  const text = await res.text();
  let data: {
    ok?: boolean;
    code?: string;
    error?: string;
    welcome?: string;
    comment?: string;
    admin?: boolean;
    channels?: ChannelLink[];
  } = {};
  try {
    data = text ? (JSON.parse(text) as typeof data) : {};
  } catch {
    throw new Error(res.ok ? 'Invalid server response' : `Server error ${res.status}`);
  }
  if (res.status === 403 && data.code === 'CHANNELS_REQUIRED') {
    return {
      ok: false,
      error: data.error || 'Join the required channels to play',
      welcome: data.welcome || '',
      comment: data.comment || '',
      channels: data.channels || [],
    };
  }
  if (!res.ok) throw new Error(data.error || `Access check failed (${res.status})`);
  return { ok: true, admin: !!data.admin, welcome: data.welcome || '', comment: data.comment || '' };
}

export interface BotReport {
  bot: { id: number | null; name: string; username: string };
  counts: { users: number; starts: number; opens: number; rooms: number; games: number };
  channels: { title: string; members: number | null }[];
  webhook: { set: boolean; pending: number; lastError: string | null };
  recent: { id: number; name: string; username?: string; at: number; event: 'start' | 'open' }[];
}

export async function fetchReport(): Promise<BotReport> {
  const data = await request<{ report: BotReport }>('/api/report');
  return data.report;
}

export function inviteUrl(roomId: string): string {
  const base = window.location.origin;
  return `${base}/?room=${roomId}`;
}

/** Room codes are 6 letters. A pasted invite link is reduced to that code. */
export function roomCodeFromInput(raw: string): string {
  const text = raw.trim();
  const fromLink = text.match(/(?:[?&]room=|startapp=)([A-Za-z0-9]{4,8})/i);
  if (fromLink) return fromLink[1].toUpperCase();
  return text.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
}
