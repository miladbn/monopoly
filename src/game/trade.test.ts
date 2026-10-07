import { describe, expect, it } from 'vitest';
import { newGame } from './engine';
import {
  normalizeTradeCash,
  tradeDeedsValid,
  transferTradeDeeds,
  validateTradeAccept,
  validateTradeOffer,
} from './trade';

describe('trade helpers', () => {
  it('rejects non-finite cash', () => {
    expect(Number.isFinite(normalizeTradeCash(Infinity))).toBe(false);
    expect(Number.isFinite(normalizeTradeCash('nope'))).toBe(false);
    expect(normalizeTradeCash(25.9)).toBe(25);
  });

  it('validates ownership and buildings', () => {
    const g = newGame('You', 1);
    g.props[1].owner = 0;
    g.props[3].owner = 1;
    expect(validateTradeOffer(g, 0, 1, [1], [3], 0).ok).toBe(true);
    g.props[1].houses = 1;
    expect(validateTradeOffer(g, 0, 1, [1], [3], 0).ok).toBe(false);
    g.props[1].houses = 0;
    g.props[1].owner = 1;
    expect(validateTradeOffer(g, 0, 1, [1], [3], 0).ok).toBe(false);
  });

  it('accept re-check fails when deeds moved', () => {
    const g = newGame('You', 1);
    g.props[1].owner = 0;
    g.props[3].owner = 1;
    const offer = { from: 0, to: 1, give: [1], get: [3], cash: 0 };
    expect(validateTradeAccept(g, offer).ok).toBe(true);
    g.props[1].owner = null;
    expect(validateTradeAccept(g, offer).ok).toBe(false);
  });

  it('transferTradeDeeds swaps owners and cash', () => {
    const g = newGame('You', 1);
    g.props[1].owner = 0;
    g.props[3].owner = 1;
    g.players[0].cash = 1400;
    g.players[1].cash = 1500;
    transferTradeDeeds(g, 0, 1, [1], [3], 100);
    expect(g.props[1].owner).toBe(1);
    expect(g.props[3].owner).toBe(0);
    expect(g.players[0].cash).toBe(1300);
    expect(g.players[1].cash).toBe(1600);
    expect(tradeDeedsValid(g, 0, 1, [1], [3])).toBe(false);
  });
});
