import { buildMultiplayerSeats } from '../src/game/playerProfile';
import { applyAction, createRuntime } from '../src/game/mpEngine';
import { kvDel, kvGet, kvSet } from './redis';
import { noteGame, noteRoom } from './stats';
import type { Room, RoomPlayer, RoomRuntime } from './types';
import { toPublicRoom } from './types';

const ROOM_TTL = 60 * 60 * 24; // 24h
const GROUP_KEY = (chatId: number) => `deco:group:${chatId}`;
const ROOM_KEY = (id: string) => `deco:room:${id}`;

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
  pieceToken?: string;
  pieceColor?: string;
  chatId?: number;
  maxPlayers?: number;
}): Promise<Room> {
  const id = roomId();
  const host: RoomPlayer = {
    telegramId: opts.hostTelegramId,
    name: opts.hostName,
    avatar: opts.hostAvatar,
    pieceToken: opts.pieceToken,
    pieceColor: opts.pieceColor,
    ready: true,
    seat: 0,
    lastSeenAt: Date.now(),
  };
  const room: Room = {
    id,
    chatId: opts.chatId,
    hostTelegramId: opts.hostTelegramId,
    players: [host],
    status: 'lobby',
    maxPlayers: opts.maxPlayers ?? 4,
    inviteOnly: true,
    joinLocked: false,
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
  player: { telegramId: number; name: string; avatar?: string; pieceToken?: string; pieceColor?: string },
): Promise<Room> {
  const room = await getRoom(id);
  if (!room) throw new Error('Room not found');
  if (room.status !== 'lobby') throw new Error('Game already started');
  const existing = room.players.find((p) => p.telegramId === player.telegramId);
  if (existing) {
    existing.name = player.name;
    existing.avatar = player.avatar;
    if (player.pieceToken) existing.pieceToken = player.pieceToken;
    if (player.pieceColor) existing.pieceColor = player.pieceColor;
    existing.lastSeenAt = Date.now();
    await save(room);
    return room;
  }
  if (room.joinLocked) throw new Error('Host locked this lobby');
  if (room.players.length >= room.maxPlayers) throw new Error('Room is full');
  const seat = room.players.length;
  room.players.push({
    telegramId: player.telegramId,
    name: player.name,
    avatar: player.avatar,
    pieceToken: player.pieceToken,
    pieceColor: player.pieceColor,
    ready: false,
    seat,
    lastSeenAt: Date.now(),
  });
  room.seatMap[seat] = player.telegramId;
  await save(room);
  return room;
}

export async function heartbeat(id: string, telegramId: number): Promise<Room> {
  const room = await getRoom(id);
  if (!room) throw new Error('Room not found');
  const p = room.players.find((x) => x.telegramId === telegramId);
  if (!p) throw new Error('Not in room');
  p.lastSeenAt = Date.now();
  await save(room);
  return room;
}

export async function kickPlayer(id: string, hostId: number, targetId: number): Promise<Room> {
  const room = await getRoom(id);
  if (!room) throw new Error('Room not found');
  if (room.status !== 'lobby') throw new Error('Can only kick in lobby');
  if (room.hostTelegramId !== hostId) throw new Error('Only the host can kick');
  if (targetId === hostId) throw new Error('Host cannot kick themselves');
  room.players = room.players.filter((p) => p.telegramId !== targetId);
  room.players.forEach((p, i) => {
    p.seat = i;
  });
  room.seatMap = {};
  room.players.forEach((p, i) => {
    room.seatMap[i] = p.telegramId;
  });
  await save(room);
  return room;
}

export async function setJoinLocked(id: string, hostId: number, locked: boolean): Promise<Room> {
  const room = await getRoom(id);
  if (!room) throw new Error('Room not found');
  if (room.hostTelegramId !== hostId) throw new Error('Only the host can lock the lobby');
  room.joinLocked = locked;
  await save(room);
  return room;
}

export async function setPlayerAppearance(
  id: string,
  telegramId: number,
  appearance: { pieceToken: string; pieceColor: string },
): Promise<Room> {
  const room = await getRoom(id);
  if (!room) throw new Error('Room not found');
  if (room.status !== 'lobby') throw new Error('Game already started');
  const p = room.players.find((x) => x.telegramId === telegramId);
  if (!p) throw new Error('Not in room');
  p.pieceToken = appearance.pieceToken;
  p.pieceColor = appearance.pieceColor;
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

  const finalCount = fillAi
    ? Math.max(2, Math.min(4, room.maxPlayers))
    : Math.max(2, Math.min(4, room.players.length));
  const aiCount = Math.max(0, finalCount - room.players.length);
  const seats = buildMultiplayerSeats(
    room.players.map((p) => ({
      name: p.name,
      token: p.pieceToken,
      color: p.pieceColor,
    })),
    aiCount,
  );

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
