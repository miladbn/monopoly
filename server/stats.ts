import { requiredChannels } from './channels';
import { kvGet, kvIncr, kvLrange, kvPushRecent, kvSadd, kvScard } from './redis';

const USERS = 'deco:stats:users';
const STARTS = 'deco:stats:starts';
const OPENS = 'deco:stats:opens';
const ROOMS = 'deco:stats:rooms';
const GAMES = 'deco:stats:games';
const RECENT = 'deco:stats:recent';

export interface RecentPlayer {
  id: number;
  name: string;
  username?: string;
  at: number;
  event: 'start' | 'open';
}

export interface BotReport {
  bot: { id: number | null; name: string; username: string };
  counts: { users: number; starts: number; opens: number; rooms: number; games: number };
  channels: { title: string; members: number | null }[];
  webhook: { set: boolean; pending: number; lastError: string | null };
  recent: RecentPlayer[];
}

async function touch(
  user: { id: number; name?: string; username?: string },
  event: 'start' | 'open',
): Promise<void> {
  const name = (user.name || user.username || `Player ${user.id}`).slice(0, 32);
  const username = user.username?.replace(/^@/, '').slice(0, 32);
  await kvSadd(USERS, String(user.id));
  await kvIncr(event === 'start' ? STARTS : OPENS);
  await kvPushRecent(
    RECENT,
    JSON.stringify({ id: user.id, name, username, at: Date.now(), event } satisfies RecentPlayer),
    30,
  );
}

export async function noteStart(user: { id: number; name?: string; username?: string }): Promise<void> {
  try {
    await touch(user, 'start');
  } catch (e) {
    console.error('noteStart', e);
  }
}

export async function noteOpen(user: { id: number; name?: string; username?: string }): Promise<void> {
  try {
    await touch(user, 'open');
  } catch (e) {
    console.error('noteOpen', e);
  }
}

export async function noteRoom(): Promise<void> {
  try {
    await kvIncr(ROOMS);
  } catch (e) {
    console.error('noteRoom', e);
  }
}

export async function noteGame(): Promise<void> {
  try {
    await kvIncr(GAMES);
  } catch (e) {
    console.error('noteGame', e);
  }
}

async function count(key: string): Promise<number> {
  const raw = await kvGet(key);
  return raw ? Number(raw) || 0 : 0;
}

async function tg<T>(method: string, query = ''): Promise<T | null> {
  const token = process.env.BOT_TOKEN;
  if (!token) return null;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}${query}`, {
      signal: AbortSignal.timeout(4000),
    });
    const data = (await res.json()) as { ok?: boolean; result?: T };
    if (!data.ok) return null;
    return data.result ?? null;
  } catch (e) {
    console.error(method, e);
    return null;
  }
}

export async function botReport(): Promise<BotReport> {
  const channels = requiredChannels();
  const [users, starts, opens, rooms, games, recentRaw, me, webhook, memberCounts] = await Promise.all([
    kvScard(USERS),
    count(STARTS),
    count(OPENS),
    count(ROOMS),
    count(GAMES),
    kvLrange(RECENT, 0, 24),
    tg<{ id?: number; first_name?: string; username?: string }>('getMe'),
    tg<{ url?: string; pending_update_count?: number; last_error_message?: string }>('getWebhookInfo'),
    Promise.all(
      channels.map((ch) =>
        tg<number>('getChatMemberCount', `?chat_id=${encodeURIComponent(ch.chatId)}`),
      ),
    ),
  ]);

  const recent: RecentPlayer[] = [];
  for (const row of recentRaw) {
    try {
      const item = JSON.parse(row) as RecentPlayer;
      if (item?.id && item.name && item.at) recent.push(item);
    } catch {
      /* skip a bad row */
    }
  }

  return {
    bot: {
      id: me?.id ?? null,
      name: me?.first_name || 'Deco City',
      username: me?.username || (process.env.BOT_USERNAME || '').replace(/^@/, ''),
    },
    counts: { users, starts, opens, rooms, games },
    channels: channels.map((ch, i) => ({
      title: ch.title,
      members: typeof memberCounts[i] === 'number' ? memberCounts[i] : null,
    })),
    webhook: {
      set: !!webhook?.url,
      pending: webhook?.pending_update_count ?? 0,
      lastError: webhook?.last_error_message || null,
    },
    recent,
  };
}
