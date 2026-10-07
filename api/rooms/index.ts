import type { VercelRequest, VercelResponse } from '@vercel/node';
import { fail, getInitData, handleOptions, ok, readJson } from '../../server/http';
import { createRoom, toPublicRoom } from '../../server/rooms';
import { assertBotSecret, displayName, validateInitData } from '../../server/telegramAuth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) return;
  if (req.method !== 'POST') return fail(res, 'Method not allowed', 405);

  try {
    const body = await readJson<{
      chatId?: number;
      maxPlayers?: number;
      hostTelegramId?: number;
      hostName?: string;
      initData?: string;
    }>(req);

    // Bot-internal create
    const botAuth = req.headers['x-bot-secret'] || req.headers.authorization;
    let hostTelegramId: number;
    let hostName: string;
    let hostAvatar: string | undefined;
    let telegramIdForPublic: number | undefined;

    try {
      assertBotSecret(botAuth as string | undefined);
      hostTelegramId = Number(body.hostTelegramId);
      hostName = (body.hostName || 'Host').slice(0, 14);
      if (!hostTelegramId) throw new Error('hostTelegramId required');
    } catch {
      const initData = getInitData(req) || body.initData || '';
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
    return fail(res, e, 400);
  }
}
