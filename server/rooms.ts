import { buildMultiplayerSeats } from '../src/game/playerProfile';
import { applyAction, createRuntime } from '../src/game/mpEngine';
import { kvDel, kvGet, kvSet, kvSetNx, kvSadd, kvSmembers, kvSrem } from './redis';
import { noteGame, noteRoom } from './stats';
import type { Room, RoomPlayer, RoomReaction, RoomRuntime, RoomSeries } from './types';
import { toPublicRoom } from './types';

const ROOM_TTL = 60 * 60 * 24; // 24h
const GROUP_KEY = (chatId: number) => `deco:group:${chatId}`;
const ROOM_KEY = (id: string) => `deco:room:${id}`;
const PUBLIC_LOBBIES = 'deco:public-lobbies';

const REACTION_EMOJI = new Set(['😂', '🔥', '👏', '😱', '💀', '🎩', '💰', '👀']);

function roomId(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += alphabet[(Math.random() * alphabet.length) | 0];
  return s;
}

async function indexPublic(room: Room): Promise<void> {
  if (room.inviteOnly === false && room.status === 'lobby' && !room.joinLocked) {
    await kvSadd(PUBLIC_LOBBIES, room.id);
  } else {
    await kvSrem(PUBLIC_LOBBIES, room.id);
  }
}

async function save(room: Room): Promise<void> {
  room.version += 1;
  await kvSet(ROOM_KEY(room.id), JSON.stringify(room), ROOM_TTL);
  if (room.chatId) await kvSet(GROUP_KEY(room.chatId), room.id, ROOM_TTL);
  await indexPublic(room);
}

const LOCK_KEY = (id: string) => `deco:lock:${id.toUpperCase()}`;

/** Serialize room mutations so concurrent actions/heartbeats cannot clobber each other. */
async function withRoomLock<T>(id: string, fn: () => Promise<T>): Promise<T> {
  const key = LOCK_KEY(id);
  for (let attempt = 0; attempt < 10; attempt++) {
    const got = await kvSetNx(key, String(Date.now()), 8);
    if (got) {
      try {
        return await fn();
      } finally {
        await kvDel(key);
      }
    }
    await new Promise((r) => setTimeout(r, 35 + attempt * 25));
  }
  throw new Error('Room is busy — try again');
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
  title?: string;
  chatId?: number;
  maxPlayers?: number;
  inviteOnly?: boolean;
}): Promise<Room> {
  const id = roomId();
  const host: RoomPlayer = {
    telegramId: opts.hostTelegramId,
    name: opts.hostName,
    avatar: opts.hostAvatar,
    pieceToken: opts.pieceToken,
    pieceColor: opts.pieceColor,
    title: opts.title,
    ready: true,
    seat: 0,
    lastSeenAt: Date.now(),
  };
  const series: RoomSeries = { target: 2, wins: {}, gamesPlayed: 0 };
  const room: Room = {
    id,
    chatId: opts.chatId,
    hostTelegramId: opts.hostTelegramId,
    players: [host],
    spectators: [],
    status: 'lobby',
    maxPlayers: opts.maxPlayers ?? 4,
    inviteOnly: opts.inviteOnly !== false,
    joinLocked: false,
    version: 0,
    createdAt: Date.now(),
    runtime: null,
    seatMap: { 0: opts.hostTelegramId },
    reactions: [],
    series,
  };
  await save(room);
  await noteRoom();
  return room;
}

/** Join an open public lobby or create one. */
export async function quickMatch(opts: {
  telegramId: number;
  name: string;
  avatar?: string;
  pieceToken?: string;
  pieceColor?: string;
  title?: string;
}): Promise<Room> {
  const ids = await kvSmembers(PUBLIC_LOBBIES);
  for (const id of ids) {
    try {
      const room = await getRoom(id);
      if (!room || room.status !== 'lobby' || room.inviteOnly !== false || room.joinLocked) {
        await kvSrem(PUBLIC_LOBBIES, id);
        continue;
      }
      if (room.players.some((p) => p.telegramId === opts.telegramId)) return room;
      if (room.players.length >= room.maxPlayers) {
        await kvSrem(PUBLIC_LOBBIES, id);
        continue;
      }
      return await joinRoom(id, opts);
    } catch {
      await kvSrem(PUBLIC_LOBBIES, id);
    }
  }
  return createRoom({
    hostTelegramId: opts.telegramId,
    hostName: opts.name,
    hostAvatar: opts.avatar,
    pieceToken: opts.pieceToken,
    pieceColor: opts.pieceColor,
    title: opts.title,
    inviteOnly: false,
  });
}

export async function joinRoom(
  id: string,
  player: {
    telegramId: number;
    name: string;
    avatar?: string;
    pieceToken?: string;
    pieceColor?: string;
    title?: string;
  },
): Promise<Room> {
  const room = await getRoom(id);
  if (!room) throw new Error('Room not found');
  if (room.status === 'ended') throw new Error('Game already ended — ask host to rematch');
  if (room.status === 'playing') {
    return joinAsSpectator(id, player);
  }
  const existing = room.players.find((p) => p.telegramId === player.telegramId);
  if (existing) {
    existing.name = player.name;
    existing.avatar = player.avatar;
    if (player.pieceToken) existing.pieceToken = player.pieceToken;
    if (player.pieceColor) existing.pieceColor = player.pieceColor;
    if (player.title !== undefined) existing.title = player.title;
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
    title: player.title,
    ready: false,
    seat,
    lastSeenAt: Date.now(),
  });
  room.seatMap[seat] = player.telegramId;
  await save(room);
  return room;
}

export async function joinAsSpectator(
  id: string,
  player: {
    telegramId: number;
    name: string;
    avatar?: string;
    pieceToken?: string;
    pieceColor?: string;
    title?: string;
  },
): Promise<Room> {
  const room = await getRoom(id);
  if (!room) throw new Error('Room not found');
  if (room.status !== 'playing' && room.status !== 'ended') {
    throw new Error('Game has not started yet — join as a player');
  }
  if (room.players.some((p) => p.telegramId === player.telegramId)) {
    return room;
  }
  room.spectators = room.spectators || [];
  const existing = room.spectators.find((s) => s.telegramId === player.telegramId);
  if (existing) {
    existing.name = player.name;
    existing.avatar = player.avatar;
    existing.lastSeenAt = Date.now();
    if (player.title !== undefined) existing.title = player.title;
  } else {
    room.spectators.push({
      telegramId: player.telegramId,
      name: player.name,
      avatar: player.avatar,
      pieceToken: player.pieceToken,
      pieceColor: player.pieceColor,
      title: player.title,
      ready: false,
      seat: -1,
      lastSeenAt: Date.now(),
    });
  }
  await save(room);
  return room;
}

export async function heartbeat(id: string, telegramId: number): Promise<Room> {
  return withRoomLock(id, async () => {
    const room = await getRoom(id);
    if (!room) throw new Error('Room not found');
    const p =
      room.players.find((x) => x.telegramId === telegramId) ||
      room.spectators?.find((x) => x.telegramId === telegramId);
    if (!p) throw new Error('Not in room');
    p.lastSeenAt = Date.now();
    await save(room);
    return room;
  });
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
  appearance: { pieceToken: string; pieceColor: string; title?: string },
): Promise<Room> {
  const room = await getRoom(id);
  if (!room) throw new Error('Room not found');
  if (room.status !== 'lobby') throw new Error('Game already started');
  const p = room.players.find((x) => x.telegramId === telegramId);
  if (!p) throw new Error('Not in room');
  p.pieceToken = appearance.pieceToken;
  p.pieceColor = appearance.pieceColor;
  if (appearance.title !== undefined) p.title = appearance.title;
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

function startRuntime(room: Room): void {
  const finalCount = Math.max(2, Math.min(4, room.maxPlayers));
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
  room.reactions = [];
  room.seatMap = {};
  room.players.forEach((p, i) => {
    p.seat = i;
    room.seatMap[i] = p.telegramId;
  });
}

export async function startRoom(id: string, telegramId: number, fillAi = true): Promise<Room> {
  const room = await getRoom(id);
  if (!room) throw new Error('Room not found');
  if (room.status !== 'lobby') throw new Error('Already started');
  if (room.hostTelegramId !== telegramId) throw new Error('Only the host can start');
  if (room.players.length < 1) throw new Error('Need at least one player');
  if (!fillAi && room.players.length < 2) throw new Error('Need at least 2 players (or enable AI fill)');

  startRuntime(room);
  await save(room);
  await noteGame();
  return room;
}

function recordSeriesWin(room: Room): void {
  if (!room.runtime || room.runtime.game.phase !== 'over') return;
  const winnerId = room.runtime.game.winner as number | null;
  if (winnerId === null || winnerId === undefined) return;
  const winnerTg = room.seatMap[winnerId];
  if (!winnerTg) return;
  if (!room.series) room.series = { target: 2, wins: {}, gamesPlayed: 0 };
  room.series.gamesPlayed += 1;
  const key = String(winnerTg);
  room.series.wins[key] = (room.series.wins[key] || 0) + 1;
}

export async function rematchRoom(id: string, telegramId: number): Promise<Room> {
  const room = await getRoom(id);
  if (!room) throw new Error('Room not found');
  if (room.status !== 'ended') throw new Error('Rematch only after the game ends');
  if (room.hostTelegramId !== telegramId) throw new Error('Only the host can rematch');
  if (room.players.length < 1) throw new Error('No players left');

  startRuntime(room);
  room.spectators = room.spectators || [];
  await save(room);
  await noteGame();
  return room;
}

export async function postReaction(
  id: string,
  telegramId: number,
  emoji: string,
): Promise<Room> {
  return withRoomLock(id, async () => {
    const room = await getRoom(id);
    if (!room) throw new Error('Room not found');
    if (room.status !== 'playing') throw new Error('Reactions only during play');
    if (!REACTION_EMOJI.has(emoji)) throw new Error('Unknown reaction');
    const who =
      room.players.find((p) => p.telegramId === telegramId) ||
      room.spectators?.find((p) => p.telegramId === telegramId);
    if (!who) throw new Error('Not in room');
    const reaction: RoomReaction = {
      id: `${Date.now()}-${telegramId}-${Math.random().toString(36).slice(2, 6)}`,
      fromTelegramId: telegramId,
      fromName: who.name,
      emoji,
      at: Date.now(),
    };
    room.reactions = [...(room.reactions || []), reaction].slice(-12);
    await save(room);
    return room;
  });
}

export async function applyRoomAction(
  id: string,
  telegramId: number,
  action: { type: string; payload?: unknown },
): Promise<Room> {
  return withRoomLock(id, async () => {
    const room = await getRoom(id);
    if (!room) throw new Error('Room not found');
    if (room.status !== 'playing' || !room.runtime) throw new Error('Game not in progress');

    const seatEntry = Object.entries(room.seatMap).find(([, tid]) => tid === telegramId);
    if (!seatEntry) throw new Error('Spectators cannot play — watch only');
    const seat = Number(seatEntry[0]);

    room.runtime = applyAction(room.runtime as never, seat, action as never) as unknown as RoomRuntime;
    if (room.runtime.game.phase === 'over') {
      room.status = 'ended';
      recordSeriesWin(room);
    }
    await save(room);
    return room;
  });
}

export async function deleteRoom(id: string): Promise<void> {
  const room = await getRoom(id);
  if (room?.chatId) await kvDel(GROUP_KEY(room.chatId));
  await kvSrem(PUBLIC_LOBBIES, id.toUpperCase());
  await kvDel(ROOM_KEY(id));
}

export { toPublicRoom };
