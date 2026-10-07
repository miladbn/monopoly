import type { VercelRequest, VercelResponse } from '@vercel/node';
import 'grammy';

/**
 * GET stays dependency-free so health checks never crash.
 * POST dynamically loads the bot (grammy + rooms).
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    res.status(200).json({ ok: true, service: 'deco-city-telegram' });
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
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
