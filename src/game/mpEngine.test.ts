import { describe, expect, it } from 'vitest';
import { settleGetOutOnBankrupt } from './decks';
import { applyAction, createRuntime, type MpRuntime } from './mpEngine';

function humanAiRuntime(): MpRuntime {
  return createRuntime(
    [
      { name: 'You', human: true, token: '🎩', color: '#c9a84c' },
      { name: 'Bot', human: false, token: '🐈', color: '#7ee787' },
    ],
    42,
  );
}

describe('mpEngine doubles after utility re-roll', () => {
  it('keeps extra roll when awaitingExtraRoll even if dice faces change', () => {
    const rt = humanAiRuntime();
    const p = rt.game.players[0];
    rt.game.turn = 0;
    rt.game.doubles = 1;
    rt.awaitingExtraRoll = true;
    rt.game.dice = [2, 5]; // non-doubles after Chance util re-roll
    p.inJail = false;
    p.bankrupt = false;
    rt.game.phase = 'buy';
    rt.game.buySpace = 1;
    p.cash = 1500;
    applyAction(rt, 0, { type: 'buy', payload: 'buy' });
    expect(rt.awaitingExtraRoll).toBe(false);
    expect(rt.game.phase).toBe('roll');
  });
});

describe('mpEngine trade accept', () => {
  it('rejects accept when ownership changed', () => {
    const rt = humanAiRuntime();
    rt.game.players[1].human = true;
    rt.game.turn = 0;
    rt.game.phase = 'manage';
    rt.game.props[1].owner = 0;
    rt.game.props[3].owner = 1;
    applyAction(rt, 0, {
      type: 'tradeOffer',
      payload: { to: 1, give: [1], get: [3], cash: 0 },
    });
    expect(rt.pendingTrade).not.toBeNull();
    rt.game.props[1].owner = null;
    expect(() => applyAction(rt, 1, { type: 'tradeRespond', payload: { accept: true } })).toThrow();
    expect(rt.pendingTrade).toBeNull();
  });

  it('rejects Infinity cash on offer', () => {
    const rt = humanAiRuntime();
    rt.game.players[1].human = true;
    rt.game.turn = 0;
    rt.game.phase = 'manage';
    rt.game.props[1].owner = 0;
    rt.game.props[3].owner = 1;
    expect(() =>
      applyAction(rt, 0, {
        type: 'tradeOffer',
        payload: { to: 1, give: [1], get: [3], cash: Infinity },
      }),
    ).toThrow(/Invalid cash/i);
  });

  it('clears pending trade on successful accept', () => {
    const rt = humanAiRuntime();
    rt.game.players[1].human = true;
    rt.game.turn = 0;
    rt.game.phase = 'manage';
    rt.game.props[1].owner = 0;
    rt.game.props[3].owner = 1;
    applyAction(rt, 0, {
      type: 'tradeOffer',
      payload: { to: 1, give: [1], get: [3], cash: 0 },
    });
    applyAction(rt, 1, { type: 'tradeRespond', payload: { accept: true } });
    expect(rt.pendingTrade).toBeNull();
    expect(rt.game.props[1].owner).toBe(1);
    expect(rt.game.props[3].owner).toBe(0);
  });
});

describe('Get Out on bankruptcy', () => {
  it('transfers held cards to creditor', () => {
    const held = [
      { pid: 0, deck: 'CHANCE' as const },
      { pid: 1, deck: 'CHEST' as const },
    ];
    const result = settleGetOutOnBankrupt(held, 0, 1);
    expect(result.transferred).toBe(1);
    expect(result.returnToDeck).toEqual([]);
    expect(held.some((h) => h.pid === 1 && h.deck === 'CHANCE')).toBe(true);
    expect(held.some((h) => h.pid === 0)).toBe(false);
  });

  it('returns cards to deck when bankrupt to bank', () => {
    const held = [{ pid: 0, deck: 'CHEST' as const }];
    const result = settleGetOutOnBankrupt(held, 0, null);
    expect(result.transferred).toBe(0);
    expect(result.returnToDeck).toEqual(['CHEST']);
    expect(held).toEqual([]);
  });
});
