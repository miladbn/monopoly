import { GROUP_MEMBERS, SPACES } from './data';
import { canBuild, playerProps, type Game, type Player } from './engine';
import { unmortgageCost } from './rules';

export type AiDifficulty = 'easy' | 'normal' | 'hard';

export const AI_DIFFICULTIES: { id: AiDifficulty; label: string }[] = [
  { id: 'easy', label: 'Easy' },
  { id: 'normal', label: 'Normal' },
  { id: 'hard', label: 'Hard' },
];

interface AiProfile {
  /** Multiplier on strategic property value when deciding buys. */
  buyMult: number;
  reserveEarly: number;
  reserveLate: number;
  /** Auction bid cap as fraction of aiValue (before RNG). */
  auctionBase: number;
  auctionJitter: number;
  /** Keep at least this much cash after building. */
  buildBuffer: number;
  /** Keep at least this much cash after unmortgaging. */
  unmortgageBuffer: number;
  /** Trade: require AI delta vs human delta ratio. */
  tradeAcceptRatio: number;
  tradeMinDelta: number;
}

const PROFILES: Record<AiDifficulty, AiProfile> = {
  easy: {
    buyMult: 0.82,
    reserveEarly: 90,
    reserveLate: 240,
    auctionBase: 0.4,
    auctionJitter: 0.25,
    buildBuffer: 280,
    unmortgageBuffer: 550,
    tradeAcceptRatio: 0.95,
    tradeMinDelta: 40,
  },
  normal: {
    buyMult: 1,
    reserveEarly: 40,
    reserveLate: 160,
    auctionBase: 0.55,
    auctionJitter: 0.4,
    buildBuffer: 180,
    unmortgageBuffer: 400,
    tradeAcceptRatio: 0.75,
    tradeMinDelta: 20,
  },
  hard: {
    buyMult: 1.18,
    reserveEarly: 20,
    reserveLate: 100,
    auctionBase: 0.72,
    auctionJitter: 0.35,
    buildBuffer: 110,
    unmortgageBuffer: 260,
    tradeAcceptRatio: 0.55,
    tradeMinDelta: 10,
  },
};

export function profileFor(diff: AiDifficulty = 'normal'): AiProfile {
  return PROFILES[diff] || PROFILES.normal;
}

/** Strategic value of a deed for this owner (buy / auction). */
export function aiPropertyValue(g: Game, p: Player, space: number, diff: AiDifficulty = 'normal'): number {
  const sp = SPACES[space];
  let v = sp.price!;
  if (sp.group) {
    const owned = GROUP_MEMBERS[sp.group].filter((x) => g.props[x].owner === p.id).length;
    const total = GROUP_MEMBERS[sp.group].length;
    if (owned === total - 1) v *= 1.75;
    else if (owned > 0) v *= 1.3;
    const rivals = GROUP_MEMBERS[sp.group].filter((x) => g.props[x].owner !== null && g.props[x].owner !== p.id).length;
    if (rivals === total - 1) v *= 1.25;
  }
  return Math.round(v * profileFor(diff).buyMult);
}

export function aiWantsBuy(g: Game, p: Player, space: number, diff: AiDifficulty = 'normal'): boolean {
  const sp = SPACES[space];
  const value = aiPropertyValue(g, p, space, diff);
  const prof = profileFor(diff);
  const reserve = g.round < 4 ? prof.reserveEarly : prof.reserveLate;
  if (p.cash - sp.price! < reserve) return value > sp.price! * 1.5 && p.cash >= sp.price!;
  return value >= sp.price! && p.cash >= sp.price!;
}

export function aiAuctionCap(
  g: Game,
  p: Player,
  space: number,
  rng: () => number,
  diff: AiDifficulty = 'normal',
): number {
  const prof = profileFor(diff);
  const value = aiPropertyValue(g, p, space, diff);
  const factor = prof.auctionBase + rng() * prof.auctionJitter;
  return Math.min(p.cash, Math.round(value * factor));
}

/** Strategic portfolio weight used for trade evaluation. */
export function stratWorth(props: Game['props'], pid: number): number {
  let v = 0;
  for (const key of Object.keys(props)) {
    const i = +key;
    const st = props[i];
    if (st.owner !== pid) continue;
    const sp = SPACES[i];
    if (!sp.price) continue;
    let m = 1;
    if (sp.group) {
      const owned = GROUP_MEMBERS[sp.group].filter((x) => props[x].owner === pid).length;
      const total = GROUP_MEMBERS[sp.group].length;
      m = owned === total ? 2.4 : owned === total - 1 ? 1.25 : 1;
    }
    v += (st.mortgaged ? sp.price / 2 : sp.price) * m;
    v += st.houses * (sp.houseCost || 0);
  }
  return v;
}

export function aiAcceptsTrade(
  g: Game,
  aiSeat: number,
  humanSeat: number,
  give: number[],
  get: number[],
  cash: number,
  diff: AiDifficulty = 'normal',
): boolean {
  const prof = profileFor(diff);
  const before = stratWorth(g.props, aiSeat);
  const hBefore = stratWorth(g.props, humanSeat);
  const sim: Game['props'] = {};
  for (const k of Object.keys(g.props)) sim[+k] = { ...g.props[+k] };
  give.forEach((i) => {
    sim[i].owner = aiSeat;
  });
  get.forEach((i) => {
    sim[i].owner = humanSeat;
  });
  const aiDelta = stratWorth(sim, aiSeat) - before + cash;
  const hDelta = stratWorth(sim, humanSeat) - hBefore - cash;
  return aiDelta > prof.tradeMinDelta && aiDelta >= hDelta * prof.tradeAcceptRatio;
}

/** Spaces the AI would build on next (highest rent uplift first). */
export function aiBuildTargets(g: Game, p: Player, diff: AiDifficulty = 'normal'): number[] {
  const buffer = profileFor(diff).buildBuffer;
  const options = playerProps(g, p.id).filter((i) => canBuild(g, i) && p.cash - (SPACES[i].houseCost || 0) > buffer);
  options.sort((a, b) => (SPACES[b].rents![1] || 0) - (SPACES[a].rents![1] || 0));
  return options;
}

/** Mortgaged deeds the AI would lift when flush. */
export function aiUnmortgageTargets(g: Game, p: Player, diff: AiDifficulty = 'normal'): number[] {
  const buffer = profileFor(diff).unmortgageBuffer;
  return playerProps(g, p.id).filter((i) => {
    const st = g.props[i];
    if (!st.mortgaged) return false;
    const cost = unmortgageCost(SPACES[i].price!);
    return p.cash - cost > buffer;
  });
}
