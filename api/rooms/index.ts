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

function roomId() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += alphabet[(Math.random() * alphabet.length) | 0];
  return s;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    cors(res);
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  try {
    if (!process.env.BOT_TOKEN) return json(res, 500, { error: 'BOT_TOKEN missing on Vercel' });

    const body = (typeof req.body === 'object' && req.body) || {};
    const header = req.headers['x-telegram-init-data'];
    const initData =
      (typeof header === 'string' && header) ||
      (typeof body.initData === 'string' && body.initData) ||
      '';

    if (!initData) {
      return json(res, 401, { error: 'Missing Telegram initData — open the Mini App from the bot' });
    }

    const user = validateInitData(initData);
    const { channelGate } = await import('../../server-bundle/channels.js');
    const gate = await channelGate(user.id);
    if (gate) return json(res, 403, gate);
    const hostName = displayName(user);
    const pieceToken = typeof body.pieceToken === 'string' ? body.pieceToken : undefined;
    const pieceColor = typeof body.pieceColor === 'string' ? body.pieceColor : undefined;
    const id = roomId();
    const room = {
      id,
      hostTelegramId: user.id,
      players: [
        {
          telegramId: user.id,
          name: hostName,
          avatar: user.photo_url,
          pieceToken,
          pieceColor,
          ready: true,
          seat: 0,
        },
      ],
      status: 'lobby',
      maxPlayers: 4,
      version: 1,
      createdAt: Date.now(),
      runtime: null,
      seatMap: { 0: user.id },
    };

    await redisCommand(['SET', `deco:room:${id}`, JSON.stringify(room), 'EX', 86400]);
    try {
      const { noteRoom } = await import('../../server-bundle/stats.js');
      await noteRoom();
    } catch (e) {
      console.error('noteRoom', e);
    }

    return json(res, 201, {
      room: {
        ...room,
        game: null,
        mySeat: 0,
      },
    });
  } catch (e) {
    console.error('POST /api/rooms', e);
    return json(res, 500, { error: e instanceof Error ? e.message : String(e) });
  }
}
