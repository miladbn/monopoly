import type { HeldGetOut } from './decks';
import type { AiDifficulty } from './ai';
import type { Game } from './engine';
import { ensureBankStock } from './engine';

export const SAVE_VERSION = 1;
const SAVE_KEY = 'deco-city-save-v1';

export interface SoloSaveBlob {
  version: number;
  savedAt: string;
  game: Game;
  chanceDeck: number[];
  chestDeck: number[];
  heldGetOut: HeldGetOut[];
  logId: number;
  difficulty: AiDifficulty;
  dailyMode: boolean;
  /** Seeded RNG state for daily / deterministic runs */
  rngSeed?: number;
  rngCalls?: number;
}

export function canSaveGame(g: Game): boolean {
  if (!g.started || g.phase === 'over' || g.phase === 'menu') return false;
  // Prefer stable decision points — mid-animation / mid-auction is fragile to resume.
  return g.phase === 'roll' || g.phase === 'manage';
}

export function writeSoloSave(blob: SoloSaveBlob): boolean {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(blob));
    return true;
  } catch {
    return false;
  }
}

export function readSoloSave(): SoloSaveBlob | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as SoloSaveBlob;
    if (!data || data.version !== SAVE_VERSION || !data.game?.players) return null;
    ensureBankStock(data.game);
    return data;
  } catch {
    return null;
  }
}

export function clearSoloSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* ignore */
  }
}

export function hasSoloSave(): boolean {
  return !!readSoloSave();
}
