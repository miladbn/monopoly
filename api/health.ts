import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Lightweight probe. Reads process.env directly so a missing server import
 * cannot take this route down. Names are unprefixed on purpose: Vercel
 * serverless functions do not use the VITE_ prefix.
 */
export default function handler(_req: VercelRequest, res: VercelResponse) {
  const channelCount = (process.env.REQUIRED_CHANNELS || '')
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean).length;
  const vitePrefixed = [
    'VITE_BOT_TOKEN',
    'VITE_REQUIRED_CHANNELS',
    'VITE_UPSTASH_REDIS_REST_URL',
    'VITE_UPSTASH_REDIS_REST_TOKEN',
    'VITE_WEBAPP_URL',
    'VITE_WELCOME_MESSAGE',
    'VITE_WELCOME_COMMENT',
    'VITE_BOT_USERNAME',
  ].filter((name) => Boolean(process.env[name]));

  res.status(200).json({
    ok: true,
    hasBotToken: Boolean(process.env.BOT_TOKEN),
    hasRedisUrl: Boolean(process.env.UPSTASH_REDIS_REST_URL),
    hasRedisToken: Boolean(process.env.UPSTASH_REDIS_REST_TOKEN),
    hasWebappUrl: Boolean(process.env.WEBAPP_URL),
    hasBotUsername: Boolean(process.env.BOT_USERNAME),
    requiredChannels: channelCount,
    hasWelcomeMessage: Boolean(process.env.WELCOME_MESSAGE),
    hasWelcomeComment: Boolean(process.env.WELCOME_COMMENT),
    vitePrefixed,
  });
}
