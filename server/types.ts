export interface RoomPlayer {
  telegramId: number;
  name: string;
  avatar?: string;
  pieceToken?: string;
  pieceColor?: string;
  title?: string;
  ready: boolean;
  seat: number;
  lastSeenAt?: number;
  connected?: boolean;
}

export type RoomStatus = 'lobby' | 'playing' | 'ended';

export interface RoomReaction {
  id: string;
  fromTelegramId: number;
  fromName: string;
  emoji: string;
  at: number;
}

export interface RoomSeries {
  /** First player to this many wins takes the series (default 2 = best of 3). */
  target: number;
  wins: Record<string, number>;
  gamesPlayed: number;
}

/** Opaque multiplayer runtime (serialized MpRuntime) */
export type RoomRuntime = {
  game: {
    phase: string;
    players: unknown[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

export interface Room {
  id: string;
  chatId?: number;
  hostTelegramId: number;
  players: RoomPlayer[];
  /** Watch-only seats (late join / after open spectate). */
  spectators?: RoomPlayer[];
  status: RoomStatus;
  maxPlayers: number;
  /** Invite-only (code-gated). False = listed for Quick Match. */
  inviteOnly?: boolean;
  /** Host locked lobby — no new joins */
  joinLocked?: boolean;
  version: number;
  createdAt: number;
  runtime: RoomRuntime | null;
  seatMap: Record<number, number>;
  reactions?: RoomReaction[];
  series?: RoomSeries;
}

export interface PublicRoom {
  id: string;
  chatId?: number;
  hostTelegramId: number;
  players: RoomPlayer[];
  spectators?: RoomPlayer[];
  status: RoomStatus;
  maxPlayers: number;
  inviteOnly?: boolean;
  joinLocked?: boolean;
  version: number;
  createdAt: number;
  // Client treats this as Game (+ pendingTrade from runtime)
  game: (RoomRuntime['game'] & { pendingTrade?: unknown }) | null;
  seatMap: Record<number, number>;
  mySeat?: number;
  /** True when this user is spectating (no seat). */
  isSpectator?: boolean;
  reactions?: RoomReaction[];
  series?: RoomSeries;
}

export function toPublicRoom(room: Room, telegramId?: number): PublicRoom {
  const mySeat =
    telegramId !== undefined
      ? room.players.find((p) => p.telegramId === telegramId)?.seat
      : undefined;
  const isSpectator =
    telegramId !== undefined &&
    mySeat === undefined &&
    !!room.spectators?.some((s) => s.telegramId === telegramId);
  const now = Date.now();
  const enrich = (p: RoomPlayer) => ({
    ...p,
    connected: !p.lastSeenAt ? true : now - p.lastSeenAt < 45000,
  });
  const players = room.players.map(enrich);
  const spectators = (room.spectators || []).map(enrich);
  const reactions = (room.reactions || []).filter((r) => now - r.at < 8000).slice(-10);
  return {
    id: room.id,
    chatId: room.chatId,
    hostTelegramId: room.hostTelegramId,
    players,
    spectators,
    status: room.status,
    maxPlayers: room.maxPlayers,
    inviteOnly: room.inviteOnly ?? true,
    joinLocked: !!room.joinLocked,
    version: room.version,
    createdAt: room.createdAt,
    game: room.runtime
      ? {
          ...room.runtime.game,
          pendingTrade: (room.runtime as { pendingTrade?: unknown }).pendingTrade ?? null,
        }
      : null,
    seatMap: room.seatMap,
    mySeat,
    isSpectator,
    reactions,
    series: room.series,
  };
}
