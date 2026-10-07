export type HudTab = 'play' | 'feed' | 'deeds';

const KEYS = {
  sfxMuted: 'deco-city-muted',
  musicMuted: 'deco-city-music-muted',
  onboarding: 'deco-city-onboarded-v1',
  colorblind: 'deco-city-colorblind',
  reconnectRoom: 'deco-city-reconnect-room',
  dailyScores: 'deco-city-daily-scores-v1',
} as const;

function readBool(key: string, fallback = false) {
  try {
    const v = localStorage.getItem(key);
    if (v === null) return fallback;
    return v === '1' || v === 'true';
  } catch {
    return fallback;
  }
}

function writeBool(key: string, value: boolean) {
  try {
    localStorage.setItem(key, value ? '1' : '0');
  } catch {
    /* ignore */
  }
}

export const settings = {
  sfxMuted: () => readBool(KEYS.sfxMuted),
  setSfxMuted: (v: boolean) => writeBool(KEYS.sfxMuted, v),
  musicMuted: () => readBool(KEYS.musicMuted, true),
  setMusicMuted: (v: boolean) => writeBool(KEYS.musicMuted, v),
  onboarded: () => readBool(KEYS.onboarding),
  setOnboarded: () => writeBool(KEYS.onboarding, true),
  colorblind: () => readBool(KEYS.colorblind),
  setColorblind: (v: boolean) => writeBool(KEYS.colorblind, v),
  getReconnectRoom: () => {
    try {
      return localStorage.getItem(KEYS.reconnectRoom);
    } catch {
      return null;
    }
  },
  setReconnectRoom: (id: string | null) => {
    try {
      if (!id) localStorage.removeItem(KEYS.reconnectRoom);
      else localStorage.setItem(KEYS.reconnectRoom, id);
    } catch {
      /* ignore */
    }
  },
};

export interface DailyScore {
  day: string;
  name: string;
  score: number;
  won: boolean;
  date: string;
}

export function todayKey(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

/** Deterministic seed from YYYY-MM-DD */
export function dailySeed(day = todayKey()) {
  let h = 2166136261;
  for (let i = 0; i < day.length; i++) {
    h ^= day.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function loadDailyScores(): DailyScore[] {
  try {
    const raw = localStorage.getItem(KEYS.dailyScores);
    if (!raw) return [];
    return (JSON.parse(raw) as DailyScore[]).slice(0, 20);
  } catch {
    return [];
  }
}

export function saveDailyScore(entry: DailyScore): DailyScore[] {
  const day = entry.day;
  const others = loadDailyScores().filter((s) => s.day !== day || s.name !== entry.name);
  const all = [...others, entry].sort((a, b) => b.score - a.score).slice(0, 20);
  try {
    localStorage.setItem(KEYS.dailyScores, JSON.stringify(all));
  } catch {
    /* ignore */
  }
  return all;
}

export function todayDailyBest(): DailyScore | null {
  const day = todayKey();
  return loadDailyScores().find((s) => s.day === day) ?? null;
}
