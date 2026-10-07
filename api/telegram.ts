import type { VercelRequest, VercelResponse } from '@vercel/node';
import 'grammy';

/**
 * GET stays dependency-free so health checks never crash.
 * POST dynamically loads the bot (grammy + rooms).
 *
 * Telegram should call setWebhook with secret_token = WEBHOOK_SECRET (or BOT_TOKEN).
 * Requests must include matching X-Telegram-Bot-Api-Secret-Token.
 */
function webhookAuthorized(req: VercelRequest): boolean {
  const expected = process.env.WEBHOOK_SECRET || process.env.BOT_TOKEN;
  if (!expected) return false;
  const got = req.headers['x-telegram-bot-api-secret-token'];
  const header = Array.isArray(got) ? got[0] : got;
  if (header && header === expected) return true;
  // Fallback: Authorization: Bot <token> (shared with isBotSecret)
  const auth = req.headers.authorization;
  const authVal = Array.isArray(auth) ? auth[0] : auth;
  if (authVal === `Bot ${expected}` || authVal === expected) return true;
  return false;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    res.status(200).json({ ok: true, service: 'deco-city-telegram' });
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!webhookAuthorized(req)) {
    res.status(401).json({ error: 'Unauthorized webhook' });
    return;
  }

  try {
    const { handleTelegramWebhook } = await import('../server-bundle/bot.js');
    await handleTelegramWebhook(req.body);
    res.status(200).json({ ok: true });
  } catch (e) {
    console.error('telegram webhook', e);
    if (!res.headersSent) {
      res.status(500).json({ error: e instanceof Error ? e.message : 'Webhook failed' });
    }
  }
}
