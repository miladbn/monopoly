import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Telegram-Init-Data');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  try {
    const { fail, getInitData, ok, readJson } = await import('../../server/http');
    const { createRoom, toPublicRoom } = await import('../../server/rooms');
    const { displayName, isBotSecret, validateInitData } = await import('../../server/telegramAuth');

    if (req.method !== 'POST') return fail(res, 'Method not allowed', 405);

    if (!process.env.BOT_TOKEN) {
      return fail(res, 'Server misconfigured: BOT_TOKEN missing on Vercel', 500);
    }

    const body = await readJson<{
      chatId?: number;
      maxPlayers?: number;
      hostTelegramId?: number;
      hostName?: string;
      initData?: string;
    }>(req);

    const botAuth = req.headers['x-bot-secret'] || req.headers.authorization;
    let hostTelegramId: number;
    let hostName: string;
    let hostAvatar: string | undefined;
    let telegramIdForPublic: number | undefined;

    if (isBotSecret(botAuth as string | undefined)) {
      hostTelegramId = Number(body.hostTelegramId);
      hostName = (body.hostName || 'Host').slice(0, 14);
      if (!hostTelegramId) return fail(res, 'hostTelegramId required');
    } else {
      const initData = getInitData(req) || body.initData || '';
      if (!initData) {
        return fail(res, 'Missing Telegram initData — open the Mini App from the bot', 401);
      }
      const v = validateInitData(initData);
      hostTelegramId = v.user.id;
      hostName = displayName(v.user);
      hostAvatar = v.user.photo_url;
      telegramIdForPublic = v.user.id;
    }

    const room = await createRoom({
      hostTelegramId,
      hostName,
      hostAvatar,
      chatId: body.chatId,
      maxPlayers: body.maxPlayers ?? 4,
    });

    return ok(res, { room: toPublicRoom(room, telegramIdForPublic) }, 201);
  } catch (e) {
    console.error('POST /api/rooms', e);
    const message = e instanceof Error ? `${e.message}` : String(e);
    const stack = e instanceof Error ? e.stack : undefined;
    if (!res.headersSent) {
      res.status(500).json({ error: message, stack });
    }
  }
}
