/** Local achievements + equippable titles. */

export interface AchievementDef {
  id: string;
  title: string;
  blurb: string;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first_win', title: 'City Baron', blurb: 'Win a game of Deco City' },
  { id: 'first_mono', title: 'Monopolist', blurb: 'Complete your first colour set' },
  { id: 'hotelier', title: 'Hotelier', blurb: 'Build a hotel' },
  { id: 'jailbreak', title: 'Escape Artist', blurb: 'Escape jail with doubles' },
  { id: 'auctioneer', title: 'Auction Hawk', blurb: 'Win an auction' },
  { id: 'streak2', title: 'Rematch Champ', blurb: 'Win 2 games in a best-of series' },
  { id: 'spectate', title: 'Gallery Guest', blurb: 'Spectate a live match' },
  { id: 'quick', title: 'Street Runner', blurb: 'Finish a Quick Match game' },
];

const UNLOCKED_KEY = 'deco-city-achievements-v1';
const TITLE_KEY = 'deco-city-equipped-title';

export type AchievementId = (typeof ACHIEVEMENTS)[number]['id'];

function loadUnlocked(): Set<string> {
  try {
    const raw = localStorage.getItem(UNLOCKED_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function saveUnlocked(set: Set<string>) {
  try {
    localStorage.setItem(UNLOCKED_KEY, JSON.stringify([...set]));
  } catch {
    /* ignore */
  }
}

export function listUnlocked(): string[] {
  return [...loadUnlocked()];
}

export function isUnlocked(id: string): boolean {
  return loadUnlocked().has(id);
}

/** Unlock and return true if newly earned. */
export function unlockAchievement(id: string): boolean {
  const set = loadUnlocked();
  if (set.has(id)) return false;
  set.add(id);
  saveUnlocked(set);
  return true;
}

export function getEquippedTitle(): string | null {
  try {
    return localStorage.getItem(TITLE_KEY);
  } catch {
    return null;
  }
}

export function setEquippedTitle(id: string | null) {
  try {
    if (!id) localStorage.removeItem(TITLE_KEY);
    else localStorage.setItem(TITLE_KEY, id);
  } catch {
    /* ignore */
  }
}

export function titleLabel(id: string | null | undefined): string | null {
  if (!id) return null;
  return ACHIEVEMENTS.find((a) => a.id === id)?.title ?? null;
}

export function evaluateGameAchievements(opts: {
  won: boolean;
  hadMonopoly: boolean;
  builtHotel: boolean;
  escapedJail: boolean;
  wonAuction: boolean;
  seriesWins?: number;
  wasQuickMatch?: boolean;
}): string[] {
  const earned: string[] = [];
  const tryUnlock = (id: string) => {
    if (unlockAchievement(id)) earned.push(id);
  };
  if (opts.won) tryUnlock('first_win');
  if (opts.hadMonopoly) tryUnlock('first_mono');
  if (opts.builtHotel) tryUnlock('hotelier');
  if (opts.escapedJail) tryUnlock('jailbreak');
  if (opts.wonAuction) tryUnlock('auctioneer');
  if ((opts.seriesWins ?? 0) >= 2) tryUnlock('streak2');
  if (opts.wasQuickMatch && opts.won) tryUnlock('quick');
  return earned;
}
