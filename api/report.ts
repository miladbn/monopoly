import type { VercelRequest, VercelResponse } from '@vercel/node';

/** Bot report for admins opening the Mini App. */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { fail, getInitData, handleOptions, ok } = await import('../server-bundle/http.js');
  if (handleOptions(req, res)) return;
  if (req.method !== 'GET') {
    fail(res, 'Method not allowed', 405);
    return;
  }

  try {
    const { validateInitData } = await import('../server-bundle/telegramAuth.js');
    const { isAppAdmin } = await import('../server-bundle/channels.js');
    const { botReport } = await import('../server-bundle/stats.js');
    const user = validateInitData(getInitData(req)).user;
    if (!(await isAppAdmin(user.id))) {
      fail(res, 'Admin only', 403);
      return;
    }
    ok(res, { report: await botReport() });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const status = msg.includes('signature') || msg.includes('Missing') || msg.includes('expired') || msg.includes('initData') ? 401 : 500;
    fail(res, e, status);
  }
}
