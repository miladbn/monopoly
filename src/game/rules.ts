import type { Game, Phase } from './engine';

const MANAGE_PHASES: Phase[] = ['manage', 'roll'];

/** Property development / mortgage is only legal on your turn in manage or pre-roll. */
export function canManageProperties(g: Game, seat: number): boolean {
  if (!g.started || g.paused) return false;
  if (g.phase === 'over' || g.phase === 'menu' || g.phase === 'moving') return false;
  const p = g.players[seat];
  if (!p || p.bankrupt || !p.human) return false;
  if (g.turn !== seat) return false;
  return MANAGE_PHASES.includes(g.phase);
}

/** Accept/decline trade only while a pending offer targets this seat and the table is idle enough. */
export function canRespondToTrade(
  g: Game,
  pending: { to: number } | null | undefined,
  seat: number,
): boolean {
  if (!pending || pending.to !== seat) return false;
  if (g.phase === 'over' || g.phase === 'menu') return false;
  if (g.phase === 'auction' || g.phase === 'buy' || g.phase === 'card' || g.phase === 'moving') return false;
  const p = g.players[seat];
  return !!(p && !p.bankrupt);
}

export function unmortgageCost(price: number): number {
  return Math.round((price / 2) * 1.1);
}
