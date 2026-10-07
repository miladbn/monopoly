import { createHmac, timingSafeEqual } from 'crypto';

export interface TelegramUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
  is_premium?: boolean;
}

export interface ValidatedInitData {
  user: TelegramUser;
  authDate: number;
  startParam?: string;
  queryId?: string;
  raw: Record<string, string>;
}

function botToken(): string {
  const t = process.env.BOT_TOKEN;
  if (!t) throw new Error('BOT_TOKEN is not configured');
  return t;
}

/**
 * Validate Telegram Mini App initData per
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export function validateInitData(initData: string, maxAgeSec = 86400): ValidatedInitData {
  if (!initData) throw new Error('Missing initData');
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) throw new Error('Missing hash');

  const pairs: string[] = [];
  params.forEach((value, key) => {
    if (key !== 'hash') pairs.push(`${key}=${value}`);
  });
  pairs.sort();
  const dataCheckString = pairs.join('\n');

  const secretKey = createHmac('sha256', 'WebAppData').update(botToken()).digest();
  const calculated = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  const a = Buffer.from(calculated, 'hex');
  const b = Buffer.from(hash, 'hex');
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new Error('Invalid initData signature');
  }

  const authDate = Number(params.get('auth_date') || 0);
  if (!authDate || Date.now() / 1000 - authDate > maxAgeSec) {
    throw new Error('initData expired');
  }

  const userRaw = params.get('user');
  if (!userRaw) throw new Error('Missing user in initData');
  const user = JSON.parse(userRaw) as TelegramUser;
  if (!user?.id) throw new Error('Invalid user');

  const raw: Record<string, string> = {};
  params.forEach((v, k) => {
    raw[k] = v;
  });

  return {
    user,
    authDate,
    startParam: params.get('start_param') || undefined,
    queryId: params.get('query_id') || undefined,
    raw,
  };
}

export function displayName(u: TelegramUser): string {
  const n = [u.first_name, u.last_name].filter(Boolean).join(' ').trim();
  return (n || u.username || `Player${u.id}`).slice(0, 14);
}

/** True when request carries the bot token as a shared secret */
export function isBotSecret(header: string | string[] | undefined): boolean {
  const expected = process.env.BOT_TOKEN;
  if (!expected) return false;
  const got = Array.isArray(header) ? header[0] : header;
  return got === `Bot ${expected}` || got === expected;
}
