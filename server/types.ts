export interface RoomPlayer {
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
  /** Invite-only (always code-gated); when true, refuse joins after lobby full intent */
  inviteOnly?: boolean;
  /** Host locked lobby — no new joins */
  joinLocked?: boolean;
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
  inviteOnly?: boolean;
  joinLocked?: boolean;
  version: number;
  createdAt: number;
  // Client treats this as Game (+ pendingTrade from runtime)
  game: (RoomRuntime['game'] & { pendingTrade?: unknown }) | null;
  seatMap: Record<number, number>;
  mySeat?: number;
}

export function toPublicRoom(room: Room, telegramId?: number): PublicRoom {
  const mySeat =
    telegramId !== undefined
      ? room.players.find((p) => p.telegramId === telegramId)?.seat
      : undefined;
  const now = Date.now();
  const players = room.players.map((p) => ({
    ...p,
    connected: !p.lastSeenAt ? true : now - p.lastSeenAt < 45000,
  }));
  return {
    id: room.id,
    chatId: room.chatId,
    hostTelegramId: room.hostTelegramId,
    players,
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
  };
}
