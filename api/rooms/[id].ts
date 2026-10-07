import type { VercelRequest, VercelResponse } from '@vercel/node';
import { fail, getInitData, handleOptions, ok } from '../../server/http';
import { getRoom, toPublicRoom } from '../../server/rooms';
import { validateInitData } from '../../server/telegramAuth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) return;
  if (req.method !== 'GET') return fail(res, 'Method not allowed', 405);

  try {
    const id = String(req.query.id || '');
    const room = await getRoom(id);
    if (!room) return fail(res, 'Room not found', 404);

    let telegramId: number | undefined;
    try {
      const initData = getInitData(req);
      if (initData) telegramId = validateInitData(initData).user.id;
    } catch {
      /* public poll without auth still returns state */
    }

    return ok(res, { room: toPublicRoom(room, telegramId) });
  } catch (e) {
    return fail(res, e, 400);
  }
}
