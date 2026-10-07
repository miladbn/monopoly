import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHmac, timingSafeEqual } from 'node:crypto';

function cors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Telegram-Init-Data');
}

function json(res: VercelResponse, status: number, data: unknown) {
  cors(res);
  res.status(status).json(data);
}

async function redisCommand(command: (string | number)[]): Promise<unknown> {
  const url = process.env.UPSTASH_REDIS_REST_URL?.replace(/\/$/, '');
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error('Redis not configured');
  const r = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
  });
  const data = (await r.json()) as { result?: unknown; error?: string };
  if (!r.ok || data.error) throw new Error(data.error || `Upstash ${r.status}`);
  return data.result;
}

async function loadRoom(id: string) {
  const raw = await redisCommand(['GET', `deco:room:${id.toUpperCase()}`]);
  if (raw == null) return null;
  return typeof raw === 'string' ? JSON.parse(raw) : raw;
}

async function saveRoom(room: Record<string, unknown>) {
  room.version = Number(room.version || 0) + 1;
  await redisCommand(['SET', `deco:room:${String(room.id).toUpperCase()}`, JSON.stringify(room), 'EX', 86400]);
  if (room.chatId) {
    await redisCommand(['SET', `deco:group:${room.chatId}`, String(room.id).toUpperCase(), 'EX', 86400]);
  }
}

function validateInitData(initData: string) {
  const token = process.env.BOT_TOKEN;
  if (!token) throw new Error('BOT_TOKEN missing');
  if (!initData) throw new Error('Missing initData');
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) throw new Error('Missing hash');
  const pairs: string[] = [];
  params.forEach((value, key) => {
    if (key !== 'hash') pairs.push(`${key}=${value}`);
  });
  pairs.sort();
  const secretKey = createHmac('sha256', 'WebAppData').update(token).digest();
  const calculated = createHmac('sha256', secretKey).update(pairs.join('\n')).digest('hex');
  const a = Buffer.from(calculated, 'hex');
  const b = Buffer.from(hash, 'hex');
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new Error('Invalid initData signature');
  const authDate = Number(params.get('auth_date') || 0);
  if (!authDate || Date.now() / 1000 - authDate > 86400) throw new Error('initData expired');
  const userRaw = params.get('user');
  if (!userRaw) throw new Error('Missing user');
  const user = JSON.parse(userRaw) as {
    id: number;
    first_name?: string;
    last_name?: string;
    username?: string;
    photo_url?: string;
  };
  if (!user?.id) throw new Error('Invalid user');
  return user;
}

function displayName(u: { first_name?: string; last_name?: string; username?: string; id: number }) {
  const n = [u.first_name, u.last_name].filter(Boolean).join(' ').trim();
  return (n || u.username || `Player${u.id}`).slice(0, 14);
}

function getInitData(req: VercelRequest, body: Record<string, unknown>): string {
  const header = req.headers['x-telegram-init-data'];
  if (typeof header === 'string' && header) return header;
  if (typeof body.initData === 'string') return body.initData;
  return '';
}

function publicRoom(room: Record<string, unknown>, telegramId?: number) {
  const players = (room.players as { telegramId: number; seat: number; lastSeenAt?: number }[]) || [];
  const spectators =
    (room.spectators as { telegramId: number; seat: number; lastSeenAt?: number }[]) || [];
  const mySeat = telegramId !== undefined ? players.find((p) => p.telegramId === telegramId)?.seat : undefined;
  const isSpectator =
    telegramId !== undefined &&
    mySeat === undefined &&
    spectators.some((s) => s.telegramId === telegramId);
  const runtime = room.runtime as { game?: unknown; pendingTrade?: unknown } | null;
  const now = Date.now();
  const enrich = (p: { lastSeenAt?: number }) => ({
    ...p,
    connected: !p.lastSeenAt ? true : now - p.lastSeenAt < 45000,
  });
  const reactions = (
    (room.reactions as { id: string; fromTelegramId: number; fromName: string; emoji: string; at: number }[]) ||
    []
  )
    .filter((r) => now - r.at < 8000)
    .slice(-10);
  return {
    id: room.id,
    chatId: room.chatId,
    hostTelegramId: room.hostTelegramId,
    players: players.map(enrich),
    spectators: spectators.map(enrich),
    status: room.status,
    maxPlayers: room.maxPlayers,
    inviteOnly: room.inviteOnly ?? true,
    joinLocked: !!room.joinLocked,
    version: room.version,
    createdAt: room.createdAt,
    game: runtime?.game
      ? { ...(runtime.game as object), pendingTrade: runtime.pendingTrade ?? null }
      : null,
    seatMap: room.seatMap,
    mySeat,
    isSpectator,
    reactions,
    series: room.series ?? null,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    cors(res);
    res.status(204).end();
    return;
  }

  try {
    const body = (typeof req.body === 'object' && req.body ? req.body : {}) as Record<string, unknown>;
    const roomId = String(req.query.id || body.roomId || body.id || '')
      .trim()
      .toUpperCase();

    if (!roomId) return json(res, 400, { error: 'Room id required' });

    // GET /api/room?id=ABC123
    if (req.method === 'GET') {
      const room = await loadRoom(roomId);
      if (!room) return json(res, 404, { error: 'Room not found' });
      let telegramId: number | undefined;
      try {
        const initData = getInitData(req, body);
        if (initData) telegramId = validateInitData(initData).id;
      } catch {
        /* optional on poll */
      }
      return json(res, 200, { room: publicRoom(room, telegramId) });
    }

    if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

    const action = String(body.action || req.query.action || '').toLowerCase();
    if (!action) return json(res, 400, { error: 'Action required (join|ready|start|appearance|action)' });

    const user = validateInitData(getInitData(req, body));
    const { channelGate } = await import('../server-bundle/channels.js');
    const gate = await channelGate(user.id);
    if (gate) return json(res, 403, gate);
    const name = displayName(user);

    if (action === 'join' || action === 'spectate') {
      try {
        const { joinRoom, joinAsSpectator } = await import('../server-bundle/rooms.js');
        const pieceToken = typeof body.pieceToken === 'string' ? body.pieceToken : undefined;
        const pieceColor = typeof body.pieceColor === 'string' ? body.pieceColor : undefined;
        const title = typeof body.title === 'string' ? body.title : undefined;
        const payload = {
          telegramId: user.id,
          name,
          avatar: user.photo_url,
          pieceToken,
          pieceColor,
          title,
        };
        const room =
          action === 'spectate'
            ? await joinAsSpectator(roomId, payload)
            : await joinRoom(roomId, payload);
        return json(res, 200, { room: publicRoom(room as unknown as Record<string, unknown>, user.id) });
      } catch (e) {
        return json(res, 400, { error: e instanceof Error ? e.message : 'Join failed' });
      }
    }

    if (action === 'appearance') {
      const pieceToken = typeof body.pieceToken === 'string' ? body.pieceToken : '';
      const pieceColor = typeof body.pieceColor === 'string' ? body.pieceColor : '';
      if (!pieceToken || !pieceColor) return json(res, 400, { error: 'pieceToken and pieceColor required' });
      try {
        const { setPlayerAppearance } = await import('../server-bundle/rooms.js');
        const title = typeof body.title === 'string' ? body.title : undefined;
        const room = await setPlayerAppearance(roomId, user.id, { pieceToken, pieceColor, title });
        return json(res, 200, { room: publicRoom(room as unknown as Record<string, unknown>, user.id) });
      } catch (e) {
        return json(res, 400, { error: e instanceof Error ? e.message : 'Appearance failed' });
      }
    }

    if (action === 'ready') {
      const room = await loadRoom(roomId);
      if (!room) return json(res, 404, { error: 'Room not found' });
      if (room.status !== 'lobby') return json(res, 400, { error: 'Game already started' });
      const p = (room.players as { telegramId: number; ready: boolean; lastSeenAt?: number }[]).find(
        (x) => x.telegramId === user.id,
      );
      if (!p) return json(res, 400, { error: 'Not in room' });
      p.ready = body.ready !== false;
      p.lastSeenAt = Date.now();
      await saveRoom(room);
      return json(res, 200, { room: publicRoom(room, user.id) });
    }

    if (action === 'heartbeat') {
      try {
        const { heartbeat } = await import('../server-bundle/rooms.js');
        const room = await heartbeat(roomId, user.id);
        return json(res, 200, { room: publicRoom(room as unknown as Record<string, unknown>, user.id) });
      } catch {
        const room = await loadRoom(roomId);
        if (!room) return json(res, 404, { error: 'Room not found' });
        const p = (room.players as { telegramId: number; lastSeenAt?: number }[]).find((x) => x.telegramId === user.id);
        if (!p) return json(res, 400, { error: 'Not in room' });
        p.lastSeenAt = Date.now();
        await saveRoom(room);
        return json(res, 200, { room: publicRoom(room, user.id) });
      }
    }

    if (action === 'kick') {
      const targetId = Number(body.targetId);
      if (!targetId) return json(res, 400, { error: 'targetId required' });
      try {
        const { kickPlayer } = await import('../server-bundle/rooms.js');
        const room = await kickPlayer(roomId, user.id, targetId);
        return json(res, 200, { room: publicRoom(room as unknown as Record<string, unknown>, user.id) });
      } catch (e) {
        return json(res, 400, { error: e instanceof Error ? e.message : 'Kick failed' });
      }
    }

    if (action === 'lock') {
      try {
        const { setJoinLocked } = await import('../server-bundle/rooms.js');
        const room = await setJoinLocked(roomId, user.id, body.locked !== false);
        return json(res, 200, { room: publicRoom(room as unknown as Record<string, unknown>, user.id) });
      } catch (e) {
        return json(res, 400, { error: e instanceof Error ? e.message : 'Lock failed' });
      }
    }

    if (action === 'start') {
      // Prefer shared server logic when available; fall back to inline error if import fails.
      try {
        const { startRoom } = await import('../server-bundle/rooms.js');
        const room = await startRoom(roomId, user.id, body.fillAi !== false);
        return json(res, 200, { room: publicRoom(room as unknown as Record<string, unknown>, user.id) });
      } catch (e) {
        // If dynamic import/bundle fails, surface clear message
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes('Cannot find module') || msg.includes('Failed to load')) {
          return json(res, 500, {
            error: `Start engine unavailable (${msg}). includeFiles/server bundle issue.`,
          });
        }
        throw e;
      }
    }

    if (action === 'action') {
      const { applyRoomAction } = await import('../server-bundle/rooms.js');
      if (!body.type) return json(res, 400, { error: 'Action type required' });
      const room = await applyRoomAction(roomId, user.id, {
        type: String(body.type),
        payload: body.payload,
        clientActionId: body.clientActionId ? String(body.clientActionId) : undefined,
      });
      return json(res, 200, { room: publicRoom(room as unknown as Record<string, unknown>, user.id) });
    }

    if (action === 'react') {
      try {
        const { postReaction } = await import('../server-bundle/rooms.js');
        const emoji = String(body.emoji || '');
        const room = await postReaction(roomId, user.id, emoji);
        return json(res, 200, { room: publicRoom(room as unknown as Record<string, unknown>, user.id) });
      } catch (e) {
        return json(res, 400, { error: e instanceof Error ? e.message : 'Reaction failed' });
      }
    }

    if (action === 'rematch') {
      try {
        const { rematchRoom } = await import('../server-bundle/rooms.js');
        const room = await rematchRoom(roomId, user.id);
        return json(res, 200, { room: publicRoom(room as unknown as Record<string, unknown>, user.id) });
      } catch (e) {
        return json(res, 400, { error: e instanceof Error ? e.message : 'Rematch failed' });
      }
    }

    return json(res, 400, { error: `Unknown action: ${action}` });
  } catch (e) {
    console.error('/api/room', e);
    const msg = e instanceof Error ? e.message : String(e);
    const status = msg.includes('not found')
      ? 404
      : msg.includes('signature') || msg.includes('Missing') || msg.includes('expired') || msg.includes('initData')
        ? 401
        : 500;
    return json(res, status, { error: msg });
  }
}
