import { Redis } from '@upstash/redis';

let redis: Redis | null | undefined;
const memory = new Map<string, string>();

export function getRedis(): Redis | null {
  if (redis !== undefined) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    redis = null;
    return null;
  }
  try {
    redis = new Redis({ url, token });
  } catch (e) {
    console.error('Redis init failed', e);
    redis = null;
  }
  return redis;
}

export async function kvGet(key: string): Promise<string | null> {
  const r = getRedis();
  if (r) {
    try {
      const v = await r.get<string>(key);
      return typeof v === 'string' ? v : v == null ? null : JSON.stringify(v);
    } catch (e) {
      console.error('kvGet', key, e);
      throw new Error('Redis read failed — check UPSTASH_REDIS_REST_URL / TOKEN on Vercel');
    }
  }
  return memory.get(key) ?? null;
}

export async function kvSet(key: string, value: string, exSeconds?: number): Promise<void> {
  const r = getRedis();
  if (r) {
    try {
      if (exSeconds) await r.set(key, value, { ex: exSeconds });
      else await r.set(key, value);
      return;
    } catch (e) {
      console.error('kvSet', key, e);
      throw new Error('Redis write failed — check UPSTASH_REDIS_REST_URL / TOKEN on Vercel');
    }
  }
  console.warn('Redis not configured; using in-memory store (not durable on Vercel)');
  memory.set(key, value);
}

export async function kvDel(key: string): Promise<void> {
  const r = getRedis();
  if (r) {
    try {
      await r.del(key);
      return;
    } catch (e) {
      console.error('kvDel', key, e);
      throw new Error('Redis delete failed');
    }
  }
  memory.delete(key);
}
