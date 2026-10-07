/** Upstash Redis via REST (no SDK — avoids ESM/CJS crashes on Vercel). */

const memory = new Map<string, string>();

function creds(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return { url: url.replace(/\/$/, ''), token };
}

async function upstash(command: (string | number)[]): Promise<unknown> {
  const c = creds();
  if (!c) return null;
  const res = await fetch(c.url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${c.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
  });
  const data = (await res.json()) as { result?: unknown; error?: string };
  if (!res.ok || data.error) {
    throw new Error(data.error || `Upstash HTTP ${res.status}`);
  }
  return data.result;
}

export async function kvGet(key: string): Promise<string | null> {
  if (!creds()) return memory.get(key) ?? null;
  try {
    const result = await upstash(['GET', key]);
    if (result == null) return null;
    return typeof result === 'string' ? result : JSON.stringify(result);
  } catch (e) {
    console.error('kvGet', key, e);
    throw new Error('Redis read failed — check UPSTASH_REDIS_REST_URL / TOKEN on Vercel');
  }
}

export async function kvSet(key: string, value: string, exSeconds?: number): Promise<void> {
  if (!creds()) {
    console.warn('Redis not configured; using in-memory store (not durable on Vercel)');
    memory.set(key, value);
    return;
  }
  try {
    if (exSeconds) await upstash(['SET', key, value, 'EX', exSeconds]);
    else await upstash(['SET', key, value]);
  } catch (e) {
    console.error('kvSet', key, e);
    throw new Error('Redis write failed — check UPSTASH_REDIS_REST_URL / TOKEN on Vercel');
  }
}

export async function kvDel(key: string): Promise<void> {
  if (!creds()) {
    memory.delete(key);
    return;
  }
  try {
    await upstash(['DEL', key]);
  } catch (e) {
    console.error('kvDel', key, e);
    throw new Error('Redis delete failed');
  }
}
