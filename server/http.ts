import type { VercelRequest, VercelResponse } from '@vercel/node';

export function cors(res: VercelResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Telegram-Init-Data');
}

export function ok(res: VercelResponse, data: unknown, status = 200): void {
  cors(res);
  res.status(status).json(data);
}

export function fail(res: VercelResponse, error: unknown, status = 400): void {
  cors(res);
  const message = error instanceof Error ? error.message : String(error);
  res.status(status).json({ error: message });
}

export async function readJson<T = Record<string, unknown>>(req: VercelRequest): Promise<T> {
  if (req.body && typeof req.body === 'object') return req.body as T;
  // body may already be parsed
  return (req.body ?? {}) as T;
}

export function getInitData(req: VercelRequest): string {
  const header = req.headers['x-telegram-init-data'];
  if (typeof header === 'string' && header) return header;
  const auth = req.headers.authorization;
  if (typeof auth === 'string' && auth.startsWith('tma ')) return auth.slice(4);
  const body = req.body as { initData?: string } | undefined;
  if (body?.initData) return body.initData;
  return '';
}

export function handleOptions(req: VercelRequest, res: VercelResponse): boolean {
  if (req.method === 'OPTIONS') {
    cors(res);
    res.status(204).end();
    return true;
  }
  return false;
}
