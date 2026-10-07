import * as esbuild from 'esbuild';
import { writeFileSync } from 'node:fs';

// Vercel compiles api/*.ts but does not turn server/*.ts into runnable JS.
// Bundle the server entries so the functions can import server-bundle/*.js.
await esbuild.build({
  entryPoints: [
    'server/bot.ts',
    'server/rooms.ts',
    'server/channels.ts',
    'server/http.ts',
    'server/telegramAuth.ts',
    'server/stats.ts',
  ],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  outdir: 'server-bundle',
  outbase: 'server',
  packages: 'external',
});

const declarations = {
  'server-bundle/http.d.ts': `export function fail(res: unknown, error: unknown, status?: number): void;
export function ok(res: unknown, data: unknown, status?: number): void;
export function getInitData(req: unknown): string;
export function handleOptions(req: unknown, res: unknown): boolean;
`,
  'server-bundle/telegramAuth.d.ts': `export function validateInitData(initData: string): { user: { id: number; first_name?: string; last_name?: string; username?: string; photo_url?: string } };
export function displayName(user: { id: number; first_name?: string; last_name?: string; username?: string }): string;
`,
  'server-bundle/channels.d.ts': `export function channelGate(userId: number): Promise<{
  error: string;
  code: string;
  welcome: string;
  comment: string;
  channels: { title: string; url: string }[];
} | null>;
export function welcomeBody(): string;
export function welcomeComment(): string;
export function isAppAdmin(userId: number): Promise<boolean>;
`,
  'server-bundle/stats.d.ts': `export function noteStart(user: { id: number; name?: string; username?: string }): Promise<void>;
export function noteOpen(user: { id: number; name?: string; username?: string }): Promise<void>;
export function noteRoom(): Promise<void>;
export function noteGame(): Promise<void>;
export function botReport(): Promise<{
  bot: { id: number | null; name: string; username: string };
  counts: { users: number; starts: number; opens: number; rooms: number; games: number };
  channels: { title: string; members: number | null }[];
  webhook: { set: boolean; pending: number; lastError: string | null };
  recent: { id: number; name: string; username?: string; at: number; event: 'start' | 'open' }[];
}>;
`,
  'server-bundle/rooms.d.ts': `export function createRoom(opts: Record<string, unknown>): Promise<unknown>;
export function quickMatch(opts: Record<string, unknown>): Promise<unknown>;
export function joinRoom(id: string, player: Record<string, unknown>): Promise<unknown>;
export function joinAsSpectator(id: string, player: Record<string, unknown>): Promise<unknown>;
export function startRoom(roomId: string, telegramId: number, fillAi?: boolean): Promise<unknown>;
export function rematchRoom(roomId: string, telegramId: number): Promise<unknown>;
export function postReaction(roomId: string, telegramId: number, emoji: string): Promise<unknown>;
export function applyRoomAction(roomId: string, telegramId: number, action: { type: string; payload?: unknown }): Promise<unknown>;
export function setPlayerAppearance(roomId: string, telegramId: number, appearance: { pieceToken: string; pieceColor: string; title?: string }): Promise<unknown>;
export function heartbeat(roomId: string, telegramId: number): Promise<unknown>;
export function kickPlayer(roomId: string, hostId: number, targetId: number): Promise<unknown>;
export function setJoinLocked(roomId: string, hostId: number, locked: boolean): Promise<unknown>;
export function toPublicRoom(room: unknown, telegramId?: number): unknown;
`,
  'server-bundle/bot.d.ts': `export function handleTelegramWebhook(update: unknown): Promise<void>;
`,
};

for (const [file, contents] of Object.entries(declarations)) {
  writeFileSync(file, contents);
}
