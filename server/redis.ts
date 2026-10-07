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

const memorySets = new Map<string, Set<string>>();
const memoryLists = new Map<string, string[]>();

export async function kvIncr(key: string): Promise<number> {
  if (!creds()) {
    const n = Number(memory.get(key) || 0) + 1;
    memory.set(key, String(n));
    return n;
  }
  const result = await upstash(['INCR', key]);
  return Number(result) || 0;
}

export async function kvSadd(key: string, member: string): Promise<void> {
  if (!creds()) {
    const set = memorySets.get(key) ?? new Set<string>();
    set.add(member);
    memorySets.set(key, set);
    return;
  }
  await upstash(['SADD', key, member]);
}

export async function kvScard(key: string): Promise<number> {
  if (!creds()) return memorySets.get(key)?.size ?? 0;
  return Number(await upstash(['SCARD', key])) || 0;
}

export async function kvSmembers(key: string): Promise<string[]> {
  if (!creds()) return [...(memorySets.get(key) ?? [])];
  const result = await upstash(['SMEMBERS', key]);
  return Array.isArray(result) ? result.map((item) => String(item)) : [];
}

export async function kvSrem(key: string, member: string): Promise<void> {
  if (!creds()) {
    memorySets.get(key)?.delete(member);
    return;
  }
  await upstash(['SREM', key, member]);
}

export async function kvPushRecent(key: string, value: string, keep: number): Promise<void> {
  if (!creds()) {
    const list = memoryLists.get(key) ?? [];
    list.unshift(value);
    memoryLists.set(key, list.slice(0, keep));
    return;
  }
  await upstash(['LPUSH', key, value]);
  await upstash(['LTRIM', key, '0', String(keep - 1)]);
}

export async function kvLrange(key: string, start: number, stop: number): Promise<string[]> {
  if (!creds()) return (memoryLists.get(key) ?? []).slice(start, stop + 1);
  const result = await upstash(['LRANGE', key, String(start), String(stop)]);
  return Array.isArray(result) ? result.map((item) => String(item)) : [];
}
