import type { VercelRequest, VercelResponse } from '@vercel/node';
import { fail, getInitData, handleOptions, ok, readJson } from '../../server/http';
import { createRoom, toPublicRoom } from '../../server/rooms';
import { displayName, isBotSecret, validateInitData } from '../../server/telegramAuth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) return;
  if (req.method !== 'POST') return fail(res, 'Method not allowed', 405);

  try {
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
    return fail(res, e, 500);
  }
}
