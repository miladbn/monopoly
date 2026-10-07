import type { Game, LogEntry } from './engine';
import { netWorth } from './engine';

export interface GameHistorySummary {
  rounds: number;
  logCount: number;
  payments: number;
  purchases: number;
  auctions: number;
  jailEvents: number;
  trades: number;
  bankruptcies: number;
  playerNets: { id: number; name: string; net: number; bankrupt: boolean }[];
}

function countMatching(log: LogEntry[], re: RegExp): number {
  return log.filter((l) => re.test(l.text)).length;
}

/** Derive lightweight stats from the in-game log + board (for end screens / future analytics). */
export function summarizeGame(g: Game): GameHistorySummary {
  const log = g.log || [];
  return {
    rounds: g.round,
    logCount: log.length,
    payments: countMatching(log, /\bpays\b/i),
    purchases: countMatching(log, /\bbuys\b/i),
    auctions: countMatching(log, /\b(sold|auction|bids)\b/i),
    jailEvents: countMatching(log, /\bjail\b/i),
    trades: countMatching(log, /\btrade\b/i),
    bankruptcies: countMatching(log, /\bbankrupt\b/i),
    playerNets: g.players.map((p) => ({
      id: p.id,
      name: p.name,
      net: p.bankrupt ? 0 : netWorth(g, p.id),
      bankrupt: p.bankrupt,
    })),
  };
}
