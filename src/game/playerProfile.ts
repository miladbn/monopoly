import { TOKENS } from './data';

export interface PlayerAppearance {
  token: string;
  color: string;
}

export const TOKEN_CHOICES = ['🎩', '🏎️', '🐕', '🚢', '🦊', '🎲', '👑', '💎', '🚀', '🎭', '🦁', '⭐'] as const;

export const COLOR_CHOICES = [
  '#c9a84c',
  '#ff6b6b',
  '#5ac8fa',
  '#7ee787',
  '#e95ba1',
  '#b794f6',
  '#ffb347',
  '#56d9c8',
  '#f2cf35',
  '#8fa3c8',
] as const;

const PROFILE_KEY = 'deco-city-profile-v1';
const NAME_KEY = 'deco-city-name';

const AI_FALLBACK = TOKENS.slice(1).map((t) => ({ name: t.name, token: t.token, color: t.color }));

export function defaultAppearance(): PlayerAppearance {
  return { token: TOKEN_CHOICES[0], color: COLOR_CHOICES[0] };
}

export function loadPlayerProfile(): PlayerAppearance {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return defaultAppearance();
    const parsed = JSON.parse(raw) as Partial<PlayerAppearance>;
    return normalizeAppearance(parsed);
  } catch {
    return defaultAppearance();
  }
}

export function savePlayerProfile(profile: PlayerAppearance) {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(normalizeAppearance(profile)));
  } catch {
    /* ignore */
  }
}

export function savePlayerName(name: string) {
  try {
    localStorage.setItem(NAME_KEY, name.slice(0, 14));
  } catch {
    /* ignore */
  }
}

export function loadPlayerName(fallback = '') {
  try {
    return localStorage.getItem(NAME_KEY) || fallback;
  } catch {
    return fallback;
  }
}

function normalizeAppearance(p: Partial<PlayerAppearance>): PlayerAppearance {
  const token = TOKEN_CHOICES.includes(p.token as (typeof TOKEN_CHOICES)[number])
    ? (p.token as string)
    : defaultAppearance().token;
  const color = COLOR_CHOICES.includes(p.color as (typeof COLOR_CHOICES)[number])
    ? (p.color as string)
    : defaultAppearance().color;
  return { token, color };
}

export type SeatSpec = {
  name: string;
  human: boolean;
  token?: string;
  color?: string;
};

function nextUnused(
  preferred: string | undefined,
  pool: readonly string[],
  used: Set<string>,
): string {
  if (preferred && !used.has(preferred)) return preferred;
  for (const item of pool) {
    if (!used.has(item)) return item;
  }
  return pool[0];
}

/** Assign tokens/colors for solo + AI seats without duplicates. */
export function buildSoloSeats(
  humanName: string,
  opponents: number,
  human: PlayerAppearance,
): SeatSpec[] {
  const total = Math.min(4, Math.max(2, opponents + 1));
  const usedTokens = new Set<string>();
  const usedColors = new Set<string>();
  const seats: SeatSpec[] = [];

  const humanToken = nextUnused(human.token, TOKEN_CHOICES, usedTokens);
  const humanColor = nextUnused(human.color, COLOR_CHOICES, usedColors);
  usedTokens.add(humanToken);
  usedColors.add(humanColor);
  seats.push({
    name: humanName || 'You',
    human: true,
    token: humanToken,
    color: humanColor,
  });

  for (let i = 1; i < total; i++) {
    const preset = AI_FALLBACK[(i - 1) % AI_FALLBACK.length];
    const token = nextUnused(preset.token, TOKEN_CHOICES, usedTokens);
    const color = nextUnused(preset.color, COLOR_CHOICES, usedColors);
    usedTokens.add(token);
    usedColors.add(color);
    seats.push({ name: preset.name, human: false, token, color });
  }
  return seats;
}

/** Multiplayer: one spec per lobby player, then AI fill. */
export function buildMultiplayerSeats(
  humans: { name: string; token?: string; color?: string }[],
  aiCount: number,
): SeatSpec[] {
  const usedTokens = new Set<string>();
  const usedColors = new Set<string>();
  const seats: SeatSpec[] = [];

  for (const h of humans) {
    const token = nextUnused(h.token, TOKEN_CHOICES, usedTokens);
    const color = nextUnused(h.color, COLOR_CHOICES, usedColors);
    usedTokens.add(token);
    usedColors.add(color);
    seats.push({ name: h.name, human: true, token, color });
  }

  for (let i = 0; i < aiCount; i++) {
    const preset = AI_FALLBACK[i % AI_FALLBACK.length];
    const token = nextUnused(preset.token, TOKEN_CHOICES, usedTokens);
    const color = nextUnused(preset.color, COLOR_CHOICES, usedColors);
    usedTokens.add(token);
    usedColors.add(color);
    seats.push({ name: preset.name, human: false, token, color });
  }
  return seats;
}
