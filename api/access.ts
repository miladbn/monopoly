import type { VercelRequest, VercelResponse } from '@vercel/node';

/** Membership check for the Mini App. Players must join REQUIRED_CHANNELS before playing. */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { fail, getInitData, handleOptions, ok } = await import('../server-bundle/http.js');
  if (handleOptions(req, res)) return;
  if (req.method !== 'GET' && req.method !== 'POST') {
    fail(res, 'Method not allowed', 405);
    return;
  }

  try {
    const { validateInitData } = await import('../server-bundle/telegramAuth.js');
    const { channelGate, welcomeBody, welcomeComment } = await import('../server-bundle/channels.js');
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
