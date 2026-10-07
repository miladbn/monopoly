import type { Game } from './engine';

export interface TradeParts {
  from: number;
  to: number;
  give: number[];
  get: number[];
  cash: number;
}

/** Normalize and validate finite trade cash. */
export function normalizeTradeCash(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return NaN;
  return Math.trunc(n);
}

/** True when deeds still belong to the parties and have no buildings. */
export function tradeDeedsValid(
  g: Game,
  from: number,
  to: number,
  give: number[],
  get: number[],
): boolean {
  if (give.some((i) => g.props[i]?.owner !== from)) return false;
  if (get.some((i) => g.props[i]?.owner !== to)) return false;
  if ([...give, ...get].some((i) => (g.props[i]?.houses || 0) > 0)) return false;
  return true;
}

/** Validate a trade offer before applying or stashing it. */
export function validateTradeOffer(
  g: Game,
  from: number,
  to: number,
  give: number[],
  get: number[],
  cash: number,
): { ok: true } | { ok: false; msg: string } {
  const a = g.players[from];
  const b = g.players[to];
  if (!a || !b || a.bankrupt || b.bankrupt || from === to) {
    return { ok: false, msg: 'Bad trade target' };
  }
  if (!give.length && !get.length) return { ok: false, msg: 'Offer something first.' };
  if (!Number.isFinite(cash)) return { ok: false, msg: 'Invalid cash amount.' };
  if (cash > 0 && a.cash < cash) return { ok: false, msg: "You don't have that cash." };
  if (cash < 0 && b.cash < -cash) return { ok: false, msg: `${b.name} can't pay that much.` };
  if (!tradeDeedsValid(g, from, to, give, get)) {
    return { ok: false, msg: 'Sell buildings first, or check deed ownership.' };
  }
  return { ok: true };
}

/** Re-check a pending offer at accept time (ownership / cash may have changed). */
export function validateTradeAccept(
  g: Game,
  t: TradeParts,
): { ok: true } | { ok: false; msg: string } {
  const from = g.players[t.from];
  const to = g.players[t.to];
  if (!from || !to || from.bankrupt || to.bankrupt) {
    return { ok: false, msg: 'Offer expired' };
  }
  if (!Number.isFinite(t.cash)) return { ok: false, msg: 'Invalid cash amount.' };
  if (t.cash > 0 && from.cash < t.cash) return { ok: false, msg: 'Offer no longer affordable' };
  if (t.cash < 0 && to.cash < -t.cash) return { ok: false, msg: 'You cannot pay that' };
  if (!tradeDeedsValid(g, t.from, t.to, t.give, t.get)) {
    return { ok: false, msg: 'Deeds no longer match the offer' };
  }
  return { ok: true };
}

/** Apply a validated deed+cash swap. Caller must validate first. */
export function transferTradeDeeds(
  g: Game,
  from: number,
  to: number,
  give: number[],
  get: number[],
  cash: number,
): void {
  const a = g.players[from];
  const b = g.players[to];
  for (const i of give) {
    if (g.props[i]?.owner === from) g.props[i].owner = to;
  }
  for (const i of get) {
    if (g.props[i]?.owner === to) g.props[i].owner = from;
  }
  a.cash -= cash;
  b.cash += cash;
}
