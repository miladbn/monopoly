import type { VercelRequest, VercelResponse } from '@vercel/node';

function parsePath(query: VercelRequest['query']): { id: string; action?: string } {
  const raw = query.path;
  const parts = Array.isArray(raw) ? raw : typeof raw === 'string' ? [raw] : [];
  return { id: (parts[0] || '').toUpperCase(), action: parts[1] };
}

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
    const { applyRoomAction, getRoom, joinRoom, setReady, startRoom, toPublicRoom } = await import(
      '../../server/rooms'
    );
    const { displayName, validateInitData } = await import('../../server/telegramAuth');

    const { id, action } = parsePath(req.query);
    if (!id) return fail(res, 'Room id required', 400);

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
      const room = await applyRoomAction(id, v.user.id, { type: body.type, payload: body.payload });
      return ok(res, { room: toPublicRoom(room, v.user.id) });
    }

    return fail(res, 'Unknown action', 404);
  } catch (e) {
    console.error('rooms path', e);
    const msg = e instanceof Error ? e.message : String(e);
    const status = msg.includes('not found')
      ? 404
      : msg.includes('signature') || msg.includes('Missing') || msg.includes('expired')
        ? 401
        : 500;
    if (!res.headersSent) {
      res.status(status).json({ error: msg, stack: e instanceof Error ? e.stack : undefined });
    }
  }
}
