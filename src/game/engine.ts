import { GROUP_MEMBERS, RR_RENT, SPACES } from './data';
import { buildSoloSeats, type PlayerAppearance, type SeatSpec } from './playerProfile';

export interface Player {
  id: number;
  name: string;
  token: string;
  color: string;
  human: boolean;
  cash: number;
  pos: number;
  inJail: boolean;
  jailTurns: number;
  getOut: number;
  bankrupt: boolean;
  netPeak: number;
}

export interface PropState {
  owner: number | null;
  houses: number; // 0-4 houses, 5 = hotel
  mortgaged: boolean;
}

export interface LogEntry {
  id: number;
  text: string;
  color?: string;
}

export type Phase =
  | 'menu'
  | 'roll'
  | 'moving'
  | 'card'
  | 'buy'
  | 'auction'
  | 'manage'
  | 'ai'
  | 'over';

export interface AuctionState {
  space: number;
  price: number;
  high: number | null;
  active: boolean[];
  current: number;
  message: string;
}

/** Classic Monopoly building bank. */
export const BANK_HOUSES = 32;
export const BANK_HOTELS = 12;

export interface Game {
  players: Player[];
  props: Record<number, PropState>;
  turn: number;
  phase: Phase;
  dice: [number, number];
  rolling: boolean;
  doubles: number;
  log: LogEntry[];
  winner: number | null;
  round: number;
  card: { deck: 'CHANCE' | 'CHEST'; text: string } | null;
  buySpace: number | null;
  auction: AuctionState | null;
  jailChoice: boolean;
  lastGain: number;
  started: boolean;
  paused: boolean;
  /** Houses still in the bank (not on the board). */
  housesLeft: number;
  /** Hotels still in the bank. */
  hotelsLeft: number;
  /** Achievement: escaped jail with doubles this game. */
  escapedJail: boolean;
  /** Achievement: won at least one auction this game. */
  wonAuction: boolean;
}

function emptyProps(): Record<number, PropState> {
  const props: Record<number, PropState> = {};
  SPACES.forEach((s) => {
    if (s.price) props[s.i] = { owner: null, houses: 0, mortgaged: false };
  });
  return props;
}

function playersFromSeats(seats: SeatSpec[]): Player[] {
  return seats.map((s, i) => ({
    id: i,
    name: s.name,
    token: s.token!,
    color: s.color!,
    human: s.human,
    cash: 1500,
    pos: 0,
    inJail: false,
    jailTurns: 0,
    getOut: 0,
    bankrupt: false,
    netPeak: 1500,
  }));
}

export function newGame(humanName: string, opponents: number, humanLook?: PlayerAppearance): Game {
  const seats = buildSoloSeats(humanName, opponents, humanLook || { token: '🎩', color: '#c9a84c' });
  const players = playersFromSeats(seats);
  return {
    players,
    props: emptyProps(),
    turn: 0,
    phase: 'roll',
    dice: [1, 1],
    rolling: false,
    doubles: 0,
    log: [{ id: 1, text: 'Welcome to Deco City. Roll the dice!', color: '#e9c46a' }],
    winner: null,
    round: 1,
    card: null,
    buySpace: null,
    auction: null,
    jailChoice: false,
    lastGain: 0,
    started: true,
    paused: false,
    housesLeft: BANK_HOUSES,
    hotelsLeft: BANK_HOTELS,
    escapedJail: false,
    wonAuction: false,
  };
}

/** Build a multiplayer match: each entry is a human or AI seat (2–4 total). */
export function newMultiplayerGame(seats: SeatSpec[]): Game {
  const players = playersFromSeats(seats);
  return {
    players,
    props: emptyProps(),
    turn: 0,
    phase: 'roll',
    dice: [1, 1],
    rolling: false,
    doubles: 0,
    log: [{ id: 1, text: 'Welcome to Deco City multiplayer!', color: '#e9c46a' }],
    winner: null,
    round: 1,
    card: null,
    buySpace: null,
    auction: null,
    jailChoice: false,
    lastGain: 0,
    started: true,
    paused: false,
    housesLeft: BANK_HOUSES,
    hotelsLeft: BANK_HOTELS,
    escapedJail: false,
    wonAuction: false,
  };
}

/** Backfill bank stock / flags for older saved/serialized games. */
export function ensureBankStock(g: Game): void {
  if (typeof g.escapedJail !== 'boolean') g.escapedJail = false;
  if (typeof g.wonAuction !== 'boolean') g.wonAuction = false;
  if (typeof g.housesLeft === 'number' && typeof g.hotelsLeft === 'number') return;
  let houses = 0;
  let hotels = 0;
  for (const sp of SPACES) {
    if (!sp.price) continue;
    const h = g.props[sp.i]?.houses || 0;
    if (h === 5) hotels++;
    else houses += h;
  }
  g.housesLeft = Math.max(0, BANK_HOUSES - houses);
  g.hotelsLeft = Math.max(0, BANK_HOTELS - hotels);
}

export function ownedInGroup(g: Game, group: string, owner: number): number {
  return GROUP_MEMBERS[group].filter((i) => g.props[i].owner === owner).length;
}

export function hasMonopoly(g: Game, group: string, owner: number): boolean {
  return ownedInGroup(g, group, owner) === GROUP_MEMBERS[group].length;
}

export function rentFor(g: Game, i: number, diceTotal: number, mult = 1): number {
  const sp = SPACES[i];
  const st = g.props[i];
  if (!st || st.owner === null || st.mortgaged) return 0;
  if (sp.type === 'prop') {
    const r = sp.rents!;
    if (st.houses > 0) return r[st.houses];
    return hasMonopoly(g, sp.group!, st.owner) ? r[0] * 2 : r[0];
  }
  if (sp.type === 'rr') {
    // Official: rent tier from number owned; mortgaged deed itself already returns 0 above.
    const n = GROUP_MEMBERS.rr.filter((x) => g.props[x].owner === st.owner).length;
    return RR_RENT[n] * mult;
  }
  if (sp.type === 'util') {
    const n = GROUP_MEMBERS.util.filter((x) => g.props[x].owner === st.owner).length;
    const m = mult === 2 ? 10 : n === 2 ? 10 : 4;
    return diceTotal * m;
  }
  return 0;
}

export function netWorth(g: Game, pid: number): number {
  const p = g.players[pid];
  let v = p.cash;
  for (const sp of SPACES) {
    if (!sp.price) continue;
    const st = g.props[sp.i];
    if (st.owner !== pid) continue;
    v += st.mortgaged ? sp.price / 2 : sp.price;
    v += st.houses * (sp.houseCost || 0);
  }
  return Math.round(v);
}

export function canBuild(g: Game, i: number): boolean {
  ensureBankStock(g);
  const sp = SPACES[i];
  const st = g.props[i];
  if (sp.type !== 'prop' || st.owner === null) return false;
  if (!hasMonopoly(g, sp.group!, st.owner)) return false;
  if (GROUP_MEMBERS[sp.group!].some((x) => g.props[x].mortgaged)) return false;
  if (st.houses >= 5) return false;
  const min = Math.min(...GROUP_MEMBERS[sp.group!].map((x) => g.props[x].houses));
  if (st.houses > min) return false;
  if (g.players[st.owner].cash < (sp.houseCost || 0)) return false;
  // Hotel needs a free hotel and returns 4 houses to the bank.
  if (st.houses === 4) return g.hotelsLeft >= 1;
  return g.housesLeft >= 1;
}

export function canSellHouse(g: Game, i: number): boolean {
  ensureBankStock(g);
  const sp = SPACES[i];
  const st = g.props[i];
  if (sp.type !== 'prop' || st.houses === 0) return false;
  const max = Math.max(...GROUP_MEMBERS[sp.group!].map((x) => g.props[x].houses));
  if (st.houses < max) return false;
  // Demoting a hotel requires 4 houses available in the bank.
  if (st.houses === 5) return g.housesLeft >= 4;
  return true;
}

/** Consume bank stock and place one house/hotel. Caller charges cash. */
export function applyBuild(g: Game, i: number): void {
  ensureBankStock(g);
  const st = g.props[i];
  if (st.houses === 4) {
    g.hotelsLeft -= 1;
    g.housesLeft = Math.min(BANK_HOUSES, g.housesLeft + 4);
    st.houses = 5;
  } else {
    g.housesLeft -= 1;
    st.houses += 1;
  }
}

/** Return one building to the bank. Caller refunds cash. */
export function applySellHouse(g: Game, i: number): void {
  ensureBankStock(g);
  const st = g.props[i];
  if (st.houses === 5) {
    g.hotelsLeft += 1;
    g.housesLeft -= 4;
    st.houses = 4;
  } else {
    g.housesLeft += 1;
    st.houses -= 1;
  }
}

/** Wipe buildings on a property and return stock to the bank. */
export function reclaimBuildings(g: Game, i: number): void {
  ensureBankStock(g);
  const st = g.props[i];
  if (!st || st.houses <= 0) return;
  if (st.houses === 5) g.hotelsLeft = Math.min(BANK_HOTELS, g.hotelsLeft + 1);
  else g.housesLeft = Math.min(BANK_HOUSES, g.housesLeft + st.houses);
  st.houses = 0;
}

export function canMortgage(g: Game, i: number): boolean {
  const st = g.props[i];
  const sp = SPACES[i];
  if (st.owner === null || st.mortgaged) return false;
  if (sp.group && GROUP_MEMBERS[sp.group].some((x) => g.props[x].houses > 0)) return false;
  return true;
}

export function playerProps(g: Game, pid: number): number[] {
  return SPACES.filter((s) => s.price && g.props[s.i].owner === pid).map((s) => s.i);
}

export function liveCount(g: Game): number {
  return g.players.filter((p) => !p.bankrupt).length;
}

export const money = (n: number) => `$${Math.round(n).toLocaleString()}`;
