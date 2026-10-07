import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requiredChannels } from '../server/channels';

/** Lightweight probe — no game/redis imports. */
export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.status(200).json({
    ok: true,
    hasBotToken: Boolean(process.env.BOT_TOKEN),
    hasRedisUrl: Boolean(process.env.UPSTASH_REDIS_REST_URL),
    hasRedisToken: Boolean(process.env.UPSTASH_REDIS_REST_TOKEN),
    requiredChannels: requiredChannels().length,
  });
}
