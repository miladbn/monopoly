import { Redis } from '@upstash/redis';

let redis: Redis | null = null;
const memory = new Map<string, string>();

export function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  if (!redis) redis = new Redis({ url, token });
  return redis;
}

export async function kvGet(key: string): Promise<string | null> {
  const r = getRedis();
  if (r) {
    const v = await r.get<string>(key);
    return typeof v === 'string' ? v : v == null ? null : JSON.stringify(v);
  }
  return memory.get(key) ?? null;
}

export async function kvSet(key: string, value: string, exSeconds?: number): Promise<void> {
  const r = getRedis();
  if (r) {
    if (exSeconds) await r.set(key, value, { ex: exSeconds });
    else await r.set(key, value);
    return;
  }
  memory.set(key, value);
}

export async function kvDel(key: string): Promise<void> {
  const r = getRedis();
  if (r) {
    await r.del(key);
    return;
  }
  memory.delete(key);
}
