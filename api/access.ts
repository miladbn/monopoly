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
    const { validateInitData, displayName } = await import('../server-bundle/telegramAuth.js');
    const { channelGate, isAppAdmin, welcomeBody, welcomeComment } = await import('../server-bundle/channels.js');
    const { noteOpen } = await import('../server-bundle/stats.js');
    const user = validateInitData(getInitData(req)).user;
    const admin = await isAppAdmin(user.id);
    if (!admin) {
      const gate = await channelGate(user.id);
      if (gate) {
        ok(res, { ok: false, ...gate }, 403);
        return;
      }
    }
    await noteOpen({ id: user.id, name: displayName(user), username: user.username });
    ok(res, { ok: true, admin, welcome: welcomeBody(), comment: welcomeComment(), channels: [] });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const status = msg.includes('signature') || msg.includes('Missing') || msg.includes('expired') || msg.includes('initData') ? 401 : 500;
    fail(res, e, status);
  }
}
