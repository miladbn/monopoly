import { describe, expect, it } from 'vitest';
import { CHANCE, CHEST, GETOUT_CARD_INDEX, GROUP_MEMBERS } from './data';
import { heldGetOutExclude, shuffleIndices, takeHeldGetOut } from './decks';
import { canManageProperties, canRespondToTrade, unmortgageCost } from './rules';
import { newGame, rentFor, type Game } from './engine';

function withOwner(g: Game, space: number, owner: number, opts?: { mortgaged?: boolean; houses?: number }) {
  g.props[space].owner = owner;
  if (opts?.mortgaged) g.props[space].mortgaged = true;
  if (opts?.houses != null) g.props[space].houses = opts.houses;
}

describe('Chance / Chest card data', () => {
  it('Boardwalk Chance collects GO when passing', () => {
    const card = CHANCE[0];
    expect(card.act).toEqual({ k: 'move', to: 39, collectGo: true });
  });

  it('Get Out indices match deck contents', () => {
    expect(CHANCE[GETOUT_CARD_INDEX.CHANCE].act).toEqual({ k: 'getout' });
    expect(CHEST[GETOUT_CARD_INDEX.CHEST].act).toEqual({ k: 'getout' });
  });
});

describe('rentFor', () => {
  it('returns 0 for mortgaged properties', () => {
    const g = newGame('You', 1);
    withOwner(g, 1, 0, { mortgaged: true });
    expect(rentFor(g, 1, 7)).toBe(0);
  });

  it('doubles colour-set rent without houses', () => {
    const g = newGame('You', 1);
    for (const i of GROUP_MEMBERS.brown) withOwner(g, i, 0);
    expect(rentFor(g, 1, 7)).toBe(4); // Mediterranean base 2 × 2
  });

  it('counts owned railroads even if a sibling is mortgaged', () => {
    const g = newGame('You', 1);
    for (const i of GROUP_MEMBERS.rr) withOwner(g, i, 0);
    g.props[GROUP_MEMBERS.rr[1]].mortgaged = true;
    // Land on an unmortgaged RR while owning all 4
    const land = GROUP_MEMBERS.rr[0];
    expect(rentFor(g, land, 7)).toBe(200);
  });

  it('uses 10× dice when Chance util mult is applied', () => {
    const g = newGame('You', 1);
    withOwner(g, GROUP_MEMBERS.util[0], 1);
    g.turn = 0;
    // Player 0 lands on util owned by 1 with mult=2 (Chance card)
    expect(rentFor(g, GROUP_MEMBERS.util[0], 8, 2)).toBe(80);
  });
});

describe('Get Out deck helpers', () => {
  it('excludes held Get Out cards from reshuffles', () => {
    const held = [{ pid: 0, deck: 'CHANCE' as const }];
    const deck = shuffleIndices(16, () => 0.5, heldGetOutExclude(held));
    expect(deck).not.toContain(GETOUT_CARD_INDEX.CHANCE);
    expect(deck).toContain(GETOUT_CARD_INDEX.CHEST);
  });

  it('returns held cards FIFO per player', () => {
    const held = [
      { pid: 0, deck: 'CHANCE' as const },
      { pid: 1, deck: 'CHEST' as const },
      { pid: 0, deck: 'CHEST' as const },
    ];
    expect(takeHeldGetOut(held, 0)).toBe('CHANCE');
    expect(takeHeldGetOut(held, 0)).toBe('CHEST');
    expect(takeHeldGetOut(held, 0)).toBeNull();
  });
});

describe('manage / trade phase guards', () => {
  it('allows manage only on your turn in manage/roll', () => {
    const g = newGame('You', 1);
    g.phase = 'manage';
    g.turn = 0;
    expect(canManageProperties(g, 0)).toBe(true);
    g.phase = 'moving';
    expect(canManageProperties(g, 0)).toBe(false);
    g.phase = 'manage';
    g.turn = 1;
    expect(canManageProperties(g, 0)).toBe(false);
  });

  it('blocks trade respond during auction/buy/card', () => {
    const g = newGame('You', 1);
    const pending = { to: 0 };
    g.phase = 'manage';
    expect(canRespondToTrade(g, pending, 0)).toBe(true);
    g.phase = 'auction';
    expect(canRespondToTrade(g, pending, 0)).toBe(false);
  });

  it('computes unmortgage cost at 110% of mortgage value', () => {
    expect(unmortgageCost(200)).toBe(110);
  });
});

describe('AI policy', () => {
  it('hard AI values completing a set more aggressively than easy', async () => {
    const { aiPropertyValue } = await import('./ai');
    const g = newGame('You', 1);
    // Own one brown; evaluate the other
    g.props[1].owner = 1;
    const easy = aiPropertyValue(g, g.players[1], 3, 'easy');
    const hard = aiPropertyValue(g, g.players[1], 3, 'hard');
    expect(hard).toBeGreaterThan(easy);
  });

  it('rejects obviously bad trades on normal', async () => {
    const { aiAcceptsTrade } = await import('./ai');
    const g = newGame('You', 1);
    g.props[1].owner = 0;
    g.props[3].owner = 1;
    // Human gives nothing valuable, takes Baltic for free
    expect(aiAcceptsTrade(g, 1, 0, [], [3], 0, 'normal')).toBe(false);
  });
});

describe('history summary', () => {
  it('counts key events from the log', async () => {
    const { summarizeGame } = await import('./history');
    const g = newGame('You', 1);
    g.log = [
      { id: 1, text: 'You buys Baltic.' },
      { id: 2, text: 'You pays $50 rent.' },
      { id: 3, text: 'Trade with Rex.' },
      { id: 4, text: 'Sent to jail.' },
    ];
    const s = summarizeGame(g);
    expect(s.purchases).toBe(1);
    expect(s.payments).toBe(1);
    expect(s.trades).toBe(1);
    expect(s.jailEvents).toBe(1);
  });
});
