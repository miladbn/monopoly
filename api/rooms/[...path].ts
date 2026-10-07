import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { MpAction } from '../../src/game/mpEngine';
import { fail, getInitData, handleOptions, ok, readJson } from '../../server/http';
import {
  applyRoomAction,
  getRoom,
  joinRoom,
  setReady,
  startRoom,
  toPublicRoom,
} from '../../server/rooms';
import { displayName, validateInitData } from '../../server/telegramAuth';

function parsePath(query: VercelRequest['query']): { id: string; action?: string } {
  const raw = query.path;
  const parts = Array.isArray(raw) ? raw : typeof raw === 'string' ? [raw] : [];
  return { id: (parts[0] || '').toUpperCase(), action: parts[1] };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) return;

  const { id, action } = parsePath(req.query);
  if (!id) return fail(res, 'Room id required', 400);

  try {
    // GET /api/rooms/:id
    if (req.method === 'GET' && !action) {
      const room = await getRoom(id);
      if (!room) return fail(res, 'Room not found', 404);
      let telegramId: number | undefined;
      try {
        const initData = getInitData(req);
        if (initData) telegramId = validateInitData(initData).user.id;
      } catch {
        /* optional */
      }
      return ok(res, { room: toPublicRoom(room, telegramId) });
    }

    if (req.method !== 'POST') return fail(res, 'Method not allowed', 405);

    const body = await readJson<{
      initData?: string;
      ready?: boolean;
      fillAi?: boolean;
      type?: string;
      payload?: unknown;
    }>(req);
    const initData = getInitData(req) || body.initData || '';
    const v = validateInitData(initData);
    const name = displayName(v.user);

    if (action === 'join') {
      const room = await joinRoom(id, {
        telegramId: v.user.id,
        name,
        avatar: v.user.photo_url,
      });
      return ok(res, { room: toPublicRoom(room, v.user.id) });
    }

    if (action === 'ready') {
      const room = await setReady(id, v.user.id, body.ready !== false);
      return ok(res, { room: toPublicRoom(room, v.user.id) });
    }

    if (action === 'start') {
      const room = await startRoom(id, v.user.id, body.fillAi !== false);
      return ok(res, { room: toPublicRoom(room, v.user.id) });
    }

    if (action === 'action') {
      if (!body.type) return fail(res, 'Action type required');
      const mpAction: MpAction = { type: body.type as MpAction['type'], payload: body.payload };
      const room = await applyRoomAction(id, v.user.id, mpAction);
      return ok(res, { room: toPublicRoom(room, v.user.id) });
    }

    return fail(res, 'Unknown action', 404);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const status = msg.includes('not found') ? 404 : msg.includes('Unauthorized') || msg.includes('signature') ? 401 : 400;
    return fail(res, e, status);
  }
}
