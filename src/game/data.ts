export type SpaceType =
  | 'go'
  | 'prop'
  | 'rr'
  | 'util'
  | 'chance'
  | 'chest'
  | 'tax'
  | 'jail'
  | 'parking'
  | 'gotojail';

export interface Space {
  i: number;
  name: string;
  short: string;
  type: SpaceType;
  price?: number;
  rents?: number[]; // [base, 1h, 2h, 3h, 4h, hotel]
  houseCost?: number;
  group?: string;
  tax?: number;
}

export const GROUP_COLORS: Record<string, string> = {
  brown: '#9c6b3f',
  lightblue: '#8fd3f4',
  pink: '#e95ba1',
  orange: '#f2873b',
  red: '#e0433b',
  yellow: '#f2cf35',
  green: '#2fa85b',
  darkblue: '#3f6ae0',
  rr: '#c8d2e8',
  util: '#9ad7c5',
};

const P = (
  i: number,
  name: string,
  short: string,
  group: string,
  price: number,
  rents: number[],
  houseCost: number,
): Space => ({ i, name, short, type: 'prop', group, price, rents, houseCost });

export const SPACES: Space[] = [
  { i: 0, name: 'GO', short: 'GO', type: 'go' },
  P(1, 'Mediterranean Avenue', 'Mediterranean', 'brown', 60, [2, 10, 30, 90, 160, 250], 50),
  { i: 2, name: 'Community Chest', short: 'Chest', type: 'chest' },
  P(3, 'Baltic Avenue', 'Baltic', 'brown', 60, [4, 20, 60, 180, 320, 450], 50),
  { i: 4, name: 'Income Tax', short: 'Income Tax', type: 'tax', tax: 200 },
  { i: 5, name: 'Reading Railroad', short: 'Reading RR', type: 'rr', price: 200, group: 'rr' },
  P(6, 'Oriental Avenue', 'Oriental', 'lightblue', 100, [6, 30, 90, 270, 400, 550], 50),
  { i: 7, name: 'Chance', short: 'Chance', type: 'chance' },
  P(8, 'Vermont Avenue', 'Vermont', 'lightblue', 100, [6, 30, 90, 270, 400, 550], 50),
  P(9, 'Connecticut Avenue', 'Connecticut', 'lightblue', 120, [8, 40, 100, 300, 450, 600], 50),
  { i: 10, name: 'Jail / Just Visiting', short: 'Jail', type: 'jail' },
  P(11, 'St. Charles Place', 'St. Charles', 'pink', 140, [10, 50, 150, 450, 625, 750], 100),
  { i: 12, name: 'Electric Company', short: 'Electric Co.', type: 'util', price: 150, group: 'util' },
  P(13, 'States Avenue', 'States', 'pink', 140, [10, 50, 150, 450, 625, 750], 100),
  P(14, 'Virginia Avenue', 'Virginia', 'pink', 160, [12, 60, 180, 500, 700, 900], 100),
  { i: 15, name: 'Pennsylvania Railroad', short: 'Penn. RR', type: 'rr', price: 200, group: 'rr' },
  P(16, 'St. James Place', 'St. James', 'orange', 180, [14, 70, 200, 550, 750, 950], 100),
  { i: 17, name: 'Community Chest', short: 'Chest', type: 'chest' },
  P(18, 'Tennessee Avenue', 'Tennessee', 'orange', 180, [14, 70, 200, 550, 750, 950], 100),
  P(19, 'New York Avenue', 'New York', 'orange', 200, [16, 80, 220, 600, 800, 1000], 100),
  { i: 20, name: 'Free Parking', short: 'Free Parking', type: 'parking' },
  P(21, 'Kentucky Avenue', 'Kentucky', 'red', 220, [18, 90, 250, 700, 875, 1050], 150),
  { i: 22, name: 'Chance', short: 'Chance', type: 'chance' },
  P(23, 'Indiana Avenue', 'Indiana', 'red', 220, [18, 90, 250, 700, 875, 1050], 150),
  P(24, 'Illinois Avenue', 'Illinois', 'red', 240, [20, 100, 300, 750, 925, 1100], 150),
  { i: 25, name: 'B. & O. Railroad', short: 'B&O RR', type: 'rr', price: 200, group: 'rr' },
  P(26, 'Atlantic Avenue', 'Atlantic', 'yellow', 260, [22, 110, 330, 800, 975, 1150], 150),
  P(27, 'Ventnor Avenue', 'Ventnor', 'yellow', 260, [22, 110, 330, 800, 975, 1150], 150),
  { i: 28, name: 'Water Works', short: 'Water Works', type: 'util', price: 150, group: 'util' },
  P(29, 'Marvin Gardens', 'Marvin Gdns', 'yellow', 280, [24, 120, 360, 850, 1025, 1200], 150),
  { i: 30, name: 'Go To Jail', short: 'Go To Jail', type: 'gotojail' },
  P(31, 'Pacific Avenue', 'Pacific', 'green', 300, [26, 130, 390, 900, 1100, 1275], 200),
  P(32, 'North Carolina Avenue', 'N. Carolina', 'green', 300, [26, 130, 390, 900, 1100, 1275], 200),
  { i: 33, name: 'Community Chest', short: 'Chest', type: 'chest' },
  P(34, 'Pennsylvania Avenue', 'Pennsylvania', 'green', 320, [28, 150, 450, 1000, 1200, 1400], 200),
  { i: 35, name: 'Short Line Railroad', short: 'Short Line', type: 'rr', price: 200, group: 'rr' },
  { i: 36, name: 'Chance', short: 'Chance', type: 'chance' },
  P(37, 'Park Place', 'Park Place', 'darkblue', 350, [35, 175, 500, 1100, 1300, 1500], 200),
  { i: 38, name: 'Luxury Tax', short: 'Luxury Tax', type: 'tax', tax: 100 },
  P(39, 'Boardwalk', 'Boardwalk', 'darkblue', 400, [50, 200, 600, 1400, 1700, 2000], 200),
];

export const GROUP_MEMBERS: Record<string, number[]> = (() => {
  const m: Record<string, number[]> = {};
  SPACES.forEach((s) => {
    if (s.group) (m[s.group] ||= []).push(s.i);
  });
  return m;
})();

export const RR_RENT = [0, 25, 50, 100, 200];

export type CardAction =
  | { k: 'move'; to: number; collectGo?: boolean }
  | { k: 'moveBack'; n: number }
  | { k: 'nearest'; kind: 'rr' | 'util' }
  | { k: 'cash'; amt: number }
  | { k: 'jail' }
  | { k: 'getout' }
  | { k: 'repairs'; house: number; hotel: number }
  | { k: 'each'; amt: number }; // positive: collect from each, negative: pay each

export interface Card {
  text: string;
  act: CardAction;
}

/** Indices of Get Out of Jail Free cards in each deck (must stay in sync with arrays below). */
export const GETOUT_CARD_INDEX = { CHANCE: 8, CHEST: 4 } as const;

export const CHANCE: Card[] = [
  { text: 'Advance to Boardwalk.', act: { k: 'move', to: 39, collectGo: true } },
  { text: 'Advance to GO. Collect $200.', act: { k: 'move', to: 0, collectGo: true } },
  { text: 'Advance to Illinois Avenue. If you pass GO, collect $200.', act: { k: 'move', to: 24, collectGo: true } },
  { text: 'Advance to St. Charles Place. If you pass GO, collect $200.', act: { k: 'move', to: 11, collectGo: true } },
  { text: 'Advance to the nearest Railroad. Pay owner twice the rental.', act: { k: 'nearest', kind: 'rr' } },
  { text: 'Advance to the nearest Railroad. Pay owner twice the rental.', act: { k: 'nearest', kind: 'rr' } },
  { text: 'Advance to the nearest Utility. Pay 10× the dice roll.', act: { k: 'nearest', kind: 'util' } },
  { text: 'Bank pays you dividend of $50.', act: { k: 'cash', amt: 50 } },
  { text: 'GET OUT OF JAIL FREE. Keep this card until needed.', act: { k: 'getout' } },
  { text: 'Go back 3 spaces.', act: { k: 'moveBack', n: 3 } },
  { text: 'GO TO JAIL. Go directly to Jail. Do not pass GO.', act: { k: 'jail' } },
  { text: 'Make general repairs: $25 per house, $100 per hotel.', act: { k: 'repairs', house: 25, hotel: 100 } },
  { text: 'Speeding fine. Pay $15.', act: { k: 'cash', amt: -15 } },
  { text: 'Take a trip to Reading Railroad. If you pass GO, collect $200.', act: { k: 'move', to: 5, collectGo: true } },
  { text: 'You have been elected Chairman of the Board. Pay each player $50.', act: { k: 'each', amt: -50 } },
  { text: 'Your building loan matures. Collect $150.', act: { k: 'cash', amt: 150 } },
];

export const CHEST: Card[] = [
  { text: 'Advance to GO. Collect $200.', act: { k: 'move', to: 0, collectGo: true } },
  { text: 'Bank error in your favor. Collect $200.', act: { k: 'cash', amt: 200 } },
  { text: "Doctor's fee. Pay $50.", act: { k: 'cash', amt: -50 } },
  { text: 'From sale of stock you get $50.', act: { k: 'cash', amt: 50 } },
  { text: 'GET OUT OF JAIL FREE. Keep this card until needed.', act: { k: 'getout' } },
  { text: 'GO TO JAIL. Go directly to Jail. Do not pass GO.', act: { k: 'jail' } },
  { text: 'Holiday fund matures. Receive $100.', act: { k: 'cash', amt: 100 } },
  { text: 'Income tax refund. Collect $20.', act: { k: 'cash', amt: 20 } },
  { text: 'It is your birthday. Collect $10 from every player.', act: { k: 'each', amt: 10 } },
  { text: 'Life insurance matures. Collect $100.', act: { k: 'cash', amt: 100 } },
  { text: 'Hospital fees. Pay $100.', act: { k: 'cash', amt: -100 } },
  { text: 'School fees. Pay $50.', act: { k: 'cash', amt: -50 } },
  { text: 'Receive $25 consultancy fee.', act: { k: 'cash', amt: 25 } },
  { text: 'Street repairs: $40 per house, $115 per hotel.', act: { k: 'repairs', house: 40, hotel: 115 } },
  { text: 'You have won second prize in a beauty contest. Collect $10.', act: { k: 'cash', amt: 10 } },
  { text: 'You inherit $100.', act: { k: 'cash', amt: 100 } },
];

export const TOKENS = [
  { token: '🎩', name: 'You', color: '#e9c46a' },
  { token: '🏎️', name: 'Vivian Vex', color: '#ff6b6b' },
  { token: '🐕', name: 'Rex Ruby', color: '#5ac8fa' },
  { token: '🚢', name: 'Ada Sterling', color: '#7ee787' },
];

// grid helpers: board is an 11x11 grid with fat corners (2 units) -> 13 units total
const OFFS = [0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const WIDS = [2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2];

export function gridPos(i: number): { row: number; col: number } {
  if (i === 0) return { row: 11, col: 11 };
  if (i < 10) return { row: 11, col: 11 - i };
  if (i === 10) return { row: 11, col: 1 };
  if (i < 20) return { row: 21 - i, col: 1 };
  if (i === 20) return { row: 1, col: 1 };
  if (i < 30) return { row: 1, col: i - 19 };
  if (i === 30) return { row: 1, col: 11 };
  return { row: i - 29, col: 11 };
}

export function cellCenter(i: number): { x: number; y: number } {
  const { row, col } = gridPos(i);
  const x = ((OFFS[col - 1] + WIDS[col - 1] / 2) / 13) * 100;
  const y = ((OFFS[row - 1] + WIDS[row - 1] / 2) / 13) * 100;
  return { x, y };
}

/** exact pixel centre of a space inside a board of `size` px (pad 3px, gap 2px) */
export function cellCenterPx(i: number, size: number, pad = 3, gap = 2): { x: number; y: number } {
  const { row, col } = gridPos(i);
  const u = (size - pad * 2 - gap * 10) / 13;
  const x = pad + (col - 1) * gap + OFFS[col - 1] * u + (WIDS[col - 1] * u) / 2;
  const y = pad + (row - 1) * gap + OFFS[row - 1] * u + (WIDS[row - 1] * u) / 2;
  return { x, y };
}

export function edgeOf(i: number): 'bottom' | 'left' | 'top' | 'right' | 'corner' {
  if (i % 10 === 0) return 'corner';
  if (i < 10) return 'bottom';
  if (i < 20) return 'left';
  if (i < 30) return 'top';
  return 'right';
}
