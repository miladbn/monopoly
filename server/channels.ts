export interface RequiredChannel {
  chatId: string;
  url: string;
  title: string;
}

export interface ChannelGate {
  error: string;
  code: 'CHANNELS_REQUIRED';
  welcome: string;
  comment: string;
  channels: { title: string; url: string }[];
}

const MEMBER = new Set(['creator', 'administrator', 'member']);
const ADMIN_STATUS = new Set(['creator', 'administrator']);
const memberCache = new Map<string, { status: string; member: boolean; at: number }>();
const MEMBER_TTL_MS = 60_000;

/** Telegram user ids that always see the bot report. Comma-separated. */
export function configuredAdminIds(): number[] {
  return (process.env.ADMIN_IDS || '')
    .split(/[\s,]+/)
    .map((part) => Number(part))
    .filter((id) => Number.isFinite(id) && id > 0);
}

export function welcomeComment(): string {
  return (process.env.WELCOME_COMMENT || 'Play fair, trade bold, and may the best tycoon win.').trim();
}

export function welcomeBody(): string {
  return (
    process.env.WELCOME_MESSAGE ||
    'Build an empire, trade deeds, and play with friends inside Telegram.'
  ).trim();
}

/** Comma or newline separated. Each entry: @channel  or  @channel|https://t.me/channel|Title */
export function requiredChannels(): RequiredChannel[] {
  const raw = (process.env.REQUIRED_CHANNELS || '').trim();
  if (!raw) return [];
  const seen = new Set<string>();
  const list: RequiredChannel[] = [];
  for (const part of raw.split(/[\n,]/)) {
    const entry = part.trim();
    if (!entry) continue;
    const channel = parseChannel(entry);
    if (!channel || seen.has(channel.chatId)) continue;
    seen.add(channel.chatId);
    list.push(channel);
  }
  return list;
}

function parseChannel(entry: string): RequiredChannel | null {
  const bits = entry.split('|').map((s) => s.trim());
  let chatId = bits[0] || '';
  let url = bits[1] || '';
  let title = bits[2] || '';

  if (chatId.startsWith('http')) {
    url = url || chatId;
    const name = usernameFromUrl(chatId);
    chatId = name ? `@${name}` : '';
  }
  if (!chatId) return null;
  if (!chatId.startsWith('@') && !/^-?\d+$/.test(chatId)) chatId = `@${chatId.replace(/^@/, '')}`;
  if (!url && chatId.startsWith('@')) url = `https://t.me/${chatId.slice(1)}`;
  if (!title) title = chatId.startsWith('@') ? chatId : 'Channel';
  return { chatId, url, title: title.slice(0, 40) };
}

function usernameFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const name = u.pathname.split('/').filter(Boolean)[0] || '';
    if (!name || name.startsWith('+')) return '';
    return name.replace(/^@/, '');
  } catch {
    return '';
  }
}

export async function missingChannels(userId: number): Promise<RequiredChannel[]> {
  const channels = requiredChannels();
  if (!channels.length) return [];
  const token = process.env.BOT_TOKEN;
  if (!token) throw new Error('BOT_TOKEN is not configured');
  const flags = await Promise.all(channels.map((ch) => isMember(token, ch.chatId, userId)));
  return channels.filter((_, i) => !flags[i]);
}

export async function channelGate(userId: number): Promise<ChannelGate | null> {
  const missing = await missingChannels(userId);
  if (!missing.length) return null;
  return {
    error: 'Join the required channels to play',
    code: 'CHANNELS_REQUIRED',
    welcome: welcomeBody(),
    comment: welcomeComment(),
    channels: missing.map((c) => ({ title: c.title, url: c.url })),
  };
}

async function memberStatus(
  token: string,
  chatId: string,
  userId: number,
): Promise<{ status: string; member: boolean } | null> {
  const key = `${chatId}:${userId}`;
  const cached = memberCache.get(key);
  if (cached && Date.now() - cached.at < MEMBER_TTL_MS) return cached;
  try {
    const url =
      `https://api.telegram.org/bot${token}/getChatMember` +
      `?chat_id=${encodeURIComponent(chatId)}&user_id=${userId}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    const data = (await res.json()) as {
      ok?: boolean;
      description?: string;
      result?: { status?: string; is_member?: boolean };
    };
    if (!data.ok || !data.result?.status) {
      console.error('getChatMember', chatId, data.description || res.status);
      return null;
    }
    const status = data.result.status;
    const member = status === 'restricted' ? data.result.is_member !== false : MEMBER.has(status);
    const hit = { status, member, at: Date.now() };
    memberCache.set(key, hit);
    return hit;
  } catch (e) {
    console.error('getChatMember', chatId, e);
    return null;
  }
}

async function isMember(token: string, chatId: string, userId: number): Promise<boolean> {
  const hit = await memberStatus(token, chatId, userId);
  return !!hit?.member;
}

/** Bot owner (ADMIN_IDS) or a creator/administrator of a required channel. */
export async function isAppAdmin(userId: number): Promise<boolean> {
  if (configuredAdminIds().includes(userId)) return true;
  const channels = requiredChannels();
  const token = process.env.BOT_TOKEN;
  if (!token || !channels.length) return false;
  const hits = await Promise.all(channels.map((ch) => memberStatus(token, ch.chatId, userId)));
  return hits.some((hit) => !!hit && ADMIN_STATUS.has(hit.status));
}

export function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
