import { GETOUT_CARD_INDEX } from './data';

export type DeckKind = 'CHANCE' | 'CHEST';

export type HeldGetOut = { pid: number; deck: DeckKind };

/** Fisher–Yates shuffle of 0..n-1, optionally excluding held Get Out indices. */
export function shuffleIndices(n: number, rng: () => number, exclude: Set<number> = new Set()): number[] {
  const a = Array.from({ length: n }, (_, i) => i).filter((i) => !exclude.has(i));
  for (let i = a.length - 1; i > 0; i--) {
    const j = (rng() * (i + 1)) | 0;
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function heldGetOutExclude(held: HeldGetOut[]): Set<number> {
  const exclude = new Set<number>();
  for (const h of held) exclude.add(GETOUT_CARD_INDEX[h.deck]);
  return exclude;
}

/** Remove and return one held Get Out for this player (FIFO). */
export function takeHeldGetOut(held: HeldGetOut[], pid: number): DeckKind | null {
  const i = held.findIndex((h) => h.pid === pid);
  if (i < 0) return null;
  const [item] = held.splice(i, 1);
  return item.deck;
}

/** Remove all held Get Out cards for a player (e.g. bankruptcy) and return their decks. */
export function returnHeldGetOutsForPlayer(held: HeldGetOut[], pid: number): DeckKind[] {
  const out: DeckKind[] = [];
  for (let i = held.length - 1; i >= 0; i--) {
    if (held[i].pid === pid) {
      out.push(held[i].deck);
      held.splice(i, 1);
    }
  }
  return out.reverse();
}
