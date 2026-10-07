import { applyAction, createRuntime } from '../src/game/mpEngine';
import { kvDel, kvGet, kvSet } from './redis';
import { noteGame, noteRoom } from './stats';
import type { Room, RoomPlayer, RoomRuntime } from './types';
import { toPublicRoom } from './types';

const ROOM_TTL = 60 * 60 * 24; // 24h
const GROUP_KEY = (chatId: number) => `deco:group:${chatId}`;
const ROOM_KEY = (id: string) => `deco:room:${id}`;

const AI_TOKENS = [
  { name: 'You' },
  { name: 'Vivian Vex' },
  { name: 'Rex Ruby' },
  { name: 'Ada Sterling' },
];

function roomId(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += alphabet[(Math.random() * alphabet.length) | 0];
  return s;
}

async function save(room: Room): Promise<void> {
  room.version += 1;
  await kvSet(ROOM_KEY(room.id), JSON.stringify(room), ROOM_TTL);
  if (room.chatId) await kvSet(GROUP_KEY(room.chatId), room.id, ROOM_TTL);
}

export async function getRoom(id: string): Promise<Room | null> {
  const raw = await kvGet(ROOM_KEY(id.toUpperCase()));
  if (!raw) return null;
  try {
    return typeof raw === 'string' ? (JSON.parse(raw) as Room) : (raw as Room);
  } catch {
    return null;
  }
}

export async function getGroupRoomId(chatId: number): Promise<string | null> {
  return kvGet(GROUP_KEY(chatId));
}

export async function createRoom(opts: {
  hostTelegramId: number;
  hostName: string;
  hostAvatar?: string;
  chatId?: number;
  maxPlayers?: number;
}): Promise<Room> {
  const id = roomId();
  const host: RoomPlayer = {
    telegramId: opts.hostTelegramId,
    name: opts.hostName,
    avatar: opts.hostAvatar,
    ready: true,
    seat: 0,
  };
  const room: Room = {
    id,
    chatId: opts.chatId,
    hostTelegramId: opts.hostTelegramId,
    players: [host],
    status: 'lobby',
    maxPlayers: opts.maxPlayers ?? 4,
    version: 0,
    createdAt: Date.now(),
    runtime: null,
    seatMap: { 0: opts.hostTelegramId },
  };
  await save(room);
  await noteRoom();
  return room;
}

export async function joinRoom(
  id: string,
  player: { telegramId: number; name: string; avatar?: string },
): Promise<Room> {
  const room = await getRoom(id);
  if (!room) throw new Error('Room not found');
  if (room.status !== 'lobby') throw new Error('Game already started');
  const existing = room.players.find((p) => p.telegramId === player.telegramId);
  if (existing) {
    existing.name = player.name;
    existing.avatar = player.avatar;
    await save(room);
    return room;
  }
  if (room.players.length >= room.maxPlayers) throw new Error('Room is full');
  const seat = room.players.length;
  room.players.push({
    telegramId: player.telegramId,
    name: player.name,
    avatar: player.avatar,
    ready: false,
    seat,
  });
  room.seatMap[seat] = player.telegramId;
  await save(room);
  return room;
}

export async function setReady(id: string, telegramId: number, ready: boolean): Promise<Room> {
  const room = await getRoom(id);
  if (!room) throw new Error('Room not found');
  if (room.status !== 'lobby') throw new Error('Game already started');
  const p = room.players.find((x) => x.telegramId === telegramId);
  if (!p) throw new Error('Not in room');
  p.ready = ready;
  await save(room);
  return room;
}

export async function startRoom(id: string, telegramId: number, fillAi = true): Promise<Room> {
  const room = await getRoom(id);
  if (!room) throw new Error('Room not found');
  if (room.status !== 'lobby') throw new Error('Already started');
  if (room.hostTelegramId !== telegramId) throw new Error('Only the host can start');
  if (room.players.length < 1) throw new Error('Need at least one player');
  if (!fillAi && room.players.length < 2) throw new Error('Need at least 2 players (or enable AI fill)');

  const seats: { name: string; human: boolean }[] = room.players.map((p) => ({
    name: p.name,
    human: true,
  }));

  const finalCount = fillAi
    ? Math.max(2, Math.min(4, room.maxPlayers))
    : Math.max(2, Math.min(4, room.players.length));
  while (seats.length < finalCount) {
    seats.push({ name: AI_TOKENS[seats.length]?.name || `AI ${seats.length}`, human: false });
  }

  room.runtime = createRuntime(seats) as unknown as RoomRuntime;
  room.status = 'playing';
  room.seatMap = {};
  room.players.forEach((p, i) => {
    p.seat = i;
    room.seatMap[i] = p.telegramId;
  });
  await save(room);
  await noteGame();
  return room;
}

export async function applyRoomAction(
  id: string,
  telegramId: number,
  action: { type: string; payload?: unknown },
): Promise<Room> {
  const room = await getRoom(id);
  if (!room) throw new Error('Room not found');
  if (room.status !== 'playing' || !room.runtime) throw new Error('Game not in progress');

  const seatEntry = Object.entries(room.seatMap).find(([, tid]) => tid === telegramId);
  if (!seatEntry) throw new Error('You are not in this game');
  const seat = Number(seatEntry[0]);

  room.runtime = applyAction(room.runtime as never, seat, action as never) as unknown as RoomRuntime;
  if (room.runtime.game.phase === 'over') room.status = 'ended';
  await save(room);
  return room;
}

export async function deleteRoom(id: string): Promise<void> {
  const room = await getRoom(id);
  if (room?.chatId) await kvDel(GROUP_KEY(room.chatId));
  await kvDel(ROOM_KEY(id));
}

export { toPublicRoom };
