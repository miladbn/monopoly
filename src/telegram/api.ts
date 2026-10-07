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
  const res = await fetch(path, { ...rest, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || res.statusText);
  return data as T;
}

export async function createRoom(): Promise<PublicRoom> {
  const data = await request<{ room: PublicRoom }>('/api/rooms', {
    method: 'POST',
    body: JSON.stringify({ initData: getInitData() }),
  });
  return data.room;
}

export async function fetchRoom(id: string): Promise<PublicRoom> {
  const q = getInitData() ? '' : '';
  const data = await request<{ room: PublicRoom }>(`/api/rooms/${id}${q}`, { method: 'GET' });
  return data.room;
}

export async function joinRoom(id: string): Promise<PublicRoom> {
  const data = await request<{ room: PublicRoom }>(`/api/rooms/${id}/join`, {
    method: 'POST',
    body: JSON.stringify({ initData: getInitData() }),
  });
  return data.room;
}

export async function setReady(id: string, ready: boolean): Promise<PublicRoom> {
  const data = await request<{ room: PublicRoom }>(`/api/rooms/${id}/ready`, {
    method: 'POST',
    body: JSON.stringify({ ready, initData: getInitData() }),
  });
  return data.room;
}

export async function startRoom(id: string, fillAi = true): Promise<PublicRoom> {
  const data = await request<{ room: PublicRoom }>(`/api/rooms/${id}/start`, {
    method: 'POST',
    body: JSON.stringify({ fillAi, initData: getInitData() }),
  });
  return data.room;
}

export async function sendAction(id: string, type: MpActionType, payload?: unknown): Promise<PublicRoom> {
  const data = await request<{ room: PublicRoom }>(`/api/rooms/${id}/action`, {
    method: 'POST',
    body: JSON.stringify({ type, payload, initData: getInitData() }),
  });
  return data.room;
}

export function inviteUrl(roomId: string): string {
  const base = window.location.origin;
  return `${base}/?room=${roomId}`;
}
