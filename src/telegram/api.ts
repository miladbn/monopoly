import type { MpActionType } from '../game/mpEngine';
import type { Game } from '../game/engine';
import { getInitData } from './webapp';

export interface PublicPlayer {
  telegramId: number;
  name: string;
  avatar?: string;
  ready: boolean;
  seat: number;
}

export interface PublicRoom {
  id: string;
  chatId?: number;
  hostTelegramId: number;
  players: PublicPlayer[];
  status: 'lobby' | 'playing' | 'ended';
  maxPlayers: number;
  version: number;
  createdAt: number;
  game: Game | null;
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

export async function createRoom(): Promise<PublicRoom> {
  const data = await request<{ room: PublicRoom }>('/api/rooms', {
    method: 'POST',
    body: JSON.stringify({ initData: getInitData() }),
  });
  return data.room;
}

export async function fetchRoom(id: string): Promise<PublicRoom> {
  const data = await request<{ room: PublicRoom }>(`/api/room?id=${encodeURIComponent(id)}`, {
    method: 'GET',
  });
  return data.room;
}

export async function joinRoom(id: string): Promise<PublicRoom> {
  const data = await request<{ room: PublicRoom }>('/api/room', {
    method: 'POST',
    body: JSON.stringify({ action: 'join', roomId: id.trim().toUpperCase(), initData: getInitData() }),
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

export function inviteUrl(roomId: string): string {
  const base = window.location.origin;
  return `${base}/?room=${roomId}`;
}
