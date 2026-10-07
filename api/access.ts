import type { VercelRequest, VercelResponse } from '@vercel/node';
import { channelGate, welcomeBody, welcomeComment } from '../server/channels';
import { fail, getInitData, handleOptions, ok } from '../server/http';
import { validateInitData } from '../server/telegramAuth';

/** Membership check for the Mini App. Players must join REQUIRED_CHANNELS before playing. */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) return;
  if (req.method !== 'GET' && req.method !== 'POST') {
    fail(res, 'Method not allowed', 405);
    return;
  }

  try {
    const user = validateInitData(getInitData(req)).user;
    const gate = await channelGate(user.id);
    if (gate) {
      ok(res, { ok: false, ...gate }, 403);
      return;
    }
    ok(res, { ok: true, welcome: welcomeBody(), comment: welcomeComment(), channels: [] });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const status = msg.includes('signature') || msg.includes('Missing') || msg.includes('expired') || msg.includes('initData') ? 401 : 500;
    fail(res, e, status);
  }
}
