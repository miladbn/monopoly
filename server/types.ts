export interface RoomPlayer {
  telegramId: number;
  name: string;
  avatar?: string;
  ready: boolean;
  seat: number;
}

export type RoomStatus = 'lobby' | 'playing' | 'ended';

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
  status: RoomStatus;
  maxPlayers: number;
  version: number;
  createdAt: number;
  runtime: RoomRuntime | null;
  seatMap: Record<number, number>;
}

export interface PublicRoom {
  id: string;
  chatId?: number;
  hostTelegramId: number;
  players: RoomPlayer[];
  status: RoomStatus;
  maxPlayers: number;
  version: number;
  createdAt: number;
  // Client treats this as Game
  game: RoomRuntime['game'] | null;
  seatMap: Record<number, number>;
  mySeat?: number;
}

export function toPublicRoom(room: Room, telegramId?: number): PublicRoom {
  const mySeat =
    telegramId !== undefined
      ? room.players.find((p) => p.telegramId === telegramId)?.seat
      : undefined;
  return {
    id: room.id,
    chatId: room.chatId,
    hostTelegramId: room.hostTelegramId,
    players: room.players,
    status: room.status,
    maxPlayers: room.maxPlayers,
    version: room.version,
    createdAt: room.createdAt,
    game: room.runtime?.game ?? null,
    seatMap: room.seatMap,
    mySeat,
  };
}
