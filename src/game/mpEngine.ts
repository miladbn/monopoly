import { CHANCE, CHEST, Card, GROUP_MEMBERS, SPACES } from './data';
import {
  AuctionState,
  Game,
  Player,
  applyBuild,
  applySellHouse,
  canBuild,
  canMortgage,
  canSellHouse,
  ensureBankStock,
  hasMonopoly,
  liveCount,
  money,
  netWorth,
  newMultiplayerGame,
  playerProps,
  reclaimBuildings,
  rentFor,
} from './engine';

import { makeRng } from './rng';
export { makeRng };

function shuffled(n: number, rng: () => number): number[] {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = a.length - 1; i > 0; i--) {
    const j = (rng() * (i + 1)) | 0;
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export interface MpRuntime {
  game: Game;
  chanceDeck: number[];
  chestDeck: number[];
  logId: number;
  seed: number;
  /** Stored as stringified function state via seed + call count */
  rngCalls: number;
  /** Rent multiplier when moving via nearest RR/util card */
  pendingRentMult: number;
  /** Card waiting for human ack before apply */
  pendingCard: Card | null;
  /** After doubles, player rolls again — track within turn */
  awaitingExtraRoll: boolean;
  /** Current winning auction bid */
  auctionBid: number;
  /** Pending human↔human trade offer */
  pendingTrade: {
    from: number;
    to: number;
    give: number[];
    get: number[];
    cash: number;
  } | null;
}

export type MpActionType =
  | 'roll'
  | 'jail'
  | 'buy'
  | 'auction'
  | 'ack'
  | 'endturn'
  | 'build'
  | 'sellHouse'
  | 'mortgage'
  | 'unmortgage'
  | 'tradeOffer'
  | 'tradeRespond';

export interface MpAction {
  type: MpActionType;
  payload?: unknown;
}

function stratWorth(props: Game['props'], pid: number): number {
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

function applyTradeDeal(
  rt: MpRuntime,
  from: number,
  to: number,
  give: number[],
  get: number[],
  cash: number,
) {
  const g = rt.game;
  const a = g.players[from];
  const b = g.players[to];
  give.forEach((i) => {
    if (g.props[i]?.owner === from) g.props[i].owner = to;
  });
  get.forEach((i) => {
    if (g.props[i]?.owner === to) g.props[i].owner = from;
  });
  a.cash -= cash;
  b.cash += cash;
  pushLog(
    rt,
    `Trade: ${a.name} ↔ ${b.name} (${give.map((i) => SPACES[i].short).join(', ') || '—'} / ${
      get.map((i) => SPACES[i].short).join(', ') || '—'
    }${cash ? `, cash ${cash > 0 ? a.name : b.name} pays ${money(Math.abs(cash))}` : ''}).`,
    '#e9c46a',
  );
}

function restoreRng(rt: MpRuntime): () => number {
  const rng = makeRng(rt.seed);
  for (let i = 0; i < rt.rngCalls; i++) rng();
  return () => {
    rt.rngCalls++;
    return rng();
  };
}

function pushLog(rt: MpRuntime, text: string, color?: string) {
  const g = rt.game;
  g.log = [{ id: rt.logId++, text, color }, ...g.log].slice(0, 40);
}

function gain(rt: MpRuntime, p: Player, amt: number) {
  p.cash += amt;
  p.netPeak = Math.max(p.netPeak, netWorth(rt.game, p.id));
}

function raiseFunds(rt: MpRuntime, p: Player, needed: number) {
  const g = rt.game;
  const mine = playerProps(g, p.id);
  let guard = 0;
  while (p.cash < needed && guard++ < 120) {
    const sellable = mine.filter((i) => canSellHouse(g, i));
    if (!sellable.length) break;
    sellable.sort((a, b) => (SPACES[b].houseCost || 0) - (SPACES[a].houseCost || 0));
    const i = sellable[0];
    applySellHouse(g, i);
    p.cash += (SPACES[i].houseCost || 0) / 2;
    pushLog(rt, `${p.name} sells a building on ${SPACES[i].short} for ${money((SPACES[i].houseCost || 0) / 2)}.`, '#ffb4a2');
  }
  guard = 0;
  while (p.cash < needed && guard++ < 60) {
    const m = mine.filter((i) => canMortgage(g, i));
    if (!m.length) break;
    m.sort((a, b) => (SPACES[a].price || 0) - (SPACES[b].price || 0));
    const i = m[0];
    g.props[i].mortgaged = true;
    p.cash += (SPACES[i].price || 0) / 2;
    pushLog(rt, `${p.name} mortgages ${SPACES[i].short} for ${money((SPACES[i].price || 0) / 2)}.`, '#ffb4a2');
  }
}

function bankrupt(rt: MpRuntime, p: Player, creditor: Player | null) {
  const g = rt.game;
  p.bankrupt = true;
  const mine = playerProps(g, p.id);
  if (creditor) {
    creditor.cash += p.cash;
    for (const i of mine) {
      const st = g.props[i];
      creditor.cash += (st.houses * (SPACES[i].houseCost || 0)) / 2;
      reclaimBuildings(g, i);
      st.owner = creditor.id;
    }
    pushLog(rt, `${p.name} is BANKRUPT! All assets go to ${creditor.name}.`, '#ff6b6b');
  } else {
    for (const i of mine) {
      reclaimBuildings(g, i);
      g.props[i] = { owner: null, houses: 0, mortgaged: false };
    }
    pushLog(rt, `${p.name} is BANKRUPT! Assets return to the Bank.`, '#ff6b6b');
  }
  p.cash = 0;
}

function charge(rt: MpRuntime, p: Player, amt: number, creditor: Player | null, reason: string): boolean {
  if (p.cash < amt) raiseFunds(rt, p, amt);
  if (p.cash < amt) {
    const owed = Math.min(p.cash, amt);
    if (creditor) creditor.cash += owed;
    p.cash -= owed;
    bankrupt(rt, p, creditor);
    return false;
  }
  p.cash -= amt;
  if (creditor) creditor.cash += amt;
  pushLog(rt, `${p.name} pays ${money(amt)} ${reason}.`, '#ffd6d6');
  return true;
}

function goToJail(rt: MpRuntime, p: Player) {
  p.pos = 10;
  p.inJail = true;
  p.jailTurns = 0;
  rt.game.doubles = 0;
  rt.awaitingExtraRoll = false;
  pushLog(rt, `${p.name} is sent to JAIL!`, '#ff9f68');
}

function stepMove(rt: MpRuntime, p: Player, steps: number, collectGo = true) {
  const dir = steps >= 0 ? 1 : -1;
  const n = Math.abs(steps);
  for (let k = 0; k < n; k++) {
    p.pos = (p.pos + dir + 40) % 40;
    if (dir === 1 && p.pos === 0 && collectGo) {
      gain(rt, p, 200);
      pushLog(rt, `${p.name} passes GO and collects $200.`, '#7ee787');
    }
  }
}

function moveTo(rt: MpRuntime, p: Player, target: number, collectGo = true) {
  const steps = (target - p.pos + 40) % 40;
  stepMove(rt, p, steps === 0 ? 40 : steps, collectGo);
}

function rollDice(rt: MpRuntime): [number, number] {
  const rng = restoreRng(rt);
  const d: [number, number] = [1 + ((rng() * 6) | 0), 1 + ((rng() * 6) | 0)];
  rt.game.dice = d;
  rt.game.rolling = false;
  return d;
}

function doBuy(rt: MpRuntime, p: Player, i: number) {
  const g = rt.game;
  const sp = SPACES[i];
  p.cash -= sp.price!;
  g.props[i].owner = p.id;
  pushLog(rt, `${p.name} buys ${sp.name} for ${money(sp.price!)}.`, p.color);
  if (sp.group && hasMonopoly(g, sp.group, p.id)) {
    pushLog(rt, `${p.name} completes the ${sp.group.toUpperCase()} monopoly!`, '#e9c46a');
  }
}

function aiValue(rt: MpRuntime, p: Player, i: number): number {
  const g = rt.game;
  const sp = SPACES[i];
  let v = sp.price!;
  if (sp.group) {
    const owned = GROUP_MEMBERS[sp.group].filter((x) => g.props[x].owner === p.id).length;
    const total = GROUP_MEMBERS[sp.group].length;
    if (owned === total - 1) v *= 1.75;
    else if (owned > 0) v *= 1.3;
    const rivals = GROUP_MEMBERS[sp.group].filter((x) => g.props[x].owner !== null && g.props[x].owner !== p.id).length;
    if (rivals === total - 1) v *= 1.25;
  }
  return Math.round(v);
}

function aiWantsBuy(rt: MpRuntime, p: Player, i: number): boolean {
  const sp = SPACES[i];
  const value = aiValue(rt, p, i);
  const reserve = rt.game.round < 4 ? 40 : 160;
  if (p.cash - sp.price! < reserve) return value > sp.price! * 1.5 && p.cash >= sp.price!;
  return value >= sp.price!;
}

function applyCardEffects(rt: MpRuntime, p: Player, card: Card, diceTotal: number) {
  const g = rt.game;
  const a = card.act;
  switch (a.k) {
    case 'move':
      moveTo(rt, p, a.to, !!a.collectGo);
      resolveLanding(rt, p, diceTotal);
      break;
    case 'moveBack':
      stepMove(rt, p, -a.n, false);
      resolveLanding(rt, p, diceTotal);
      break;
    case 'nearest': {
      const list = a.kind === 'rr' ? GROUP_MEMBERS.rr : GROUP_MEMBERS.util;
      let target = list[0];
      let best = 99;
      for (const i of list) {
        const d = (i - p.pos + 40) % 40;
        if (d > 0 && d < best) {
          best = d;
          target = i;
        }
      }
      moveTo(rt, p, target, true);
      resolveLanding(rt, p, diceTotal, 2);
      break;
    }
    case 'cash':
      if (a.amt >= 0) {
        gain(rt, p, a.amt);
        pushLog(rt, `${p.name} collects ${money(a.amt)}.`, '#7ee787');
      } else charge(rt, p, -a.amt, null, 'to the Bank');
      break;
    case 'jail':
      goToJail(rt, p);
      break;
    case 'getout':
      p.getOut++;
      break;
    case 'repairs': {
      let houses = 0;
      let hotels = 0;
      for (const i of playerProps(g, p.id)) {
        if (g.props[i].houses === 5) hotels++;
        else houses += g.props[i].houses;
      }
      const total = houses * a.house + hotels * a.hotel;
      if (total > 0) charge(rt, p, total, null, `for repairs (${houses}h/${hotels}H)`);
      else pushLog(rt, `${p.name} has nothing to repair.`);
      break;
    }
    case 'each': {
      for (const q of g.players) {
        if (q.id === p.id || q.bankrupt) continue;
        if (a.amt > 0) {
          charge(rt, q, a.amt, p, `to ${p.name}`);
        } else {
          if (!charge(rt, p, -a.amt, q, `to ${q.name}`)) break;
        }
      }
      break;
    }
  }
}

function drawCard(rt: MpRuntime, p: Player, deck: 'CHANCE' | 'CHEST', diceTotal: number) {
  const list = deck === 'CHANCE' ? CHANCE : CHEST;
  const ref = deck === 'CHANCE' ? 'chanceDeck' : 'chestDeck';
  if (!rt[ref].length) {
    const rng = restoreRng(rt);
    rt[ref] = shuffled(16, rng);
  }
  const idx = rt[ref].shift()!;
  const card = list[idx];
  rt.pendingCard = card;
  rt.pendingRentMult = 1;
  rt.game.card = { deck, text: card.text };
  rt.game.phase = 'card';
  pushLog(rt, `${p.name} draws ${deck === 'CHANCE' ? 'Chance' : 'Community Chest'}: ${card.text}`, '#8fd3f4');
  // stash diceTotal on lastGain temporarily for ack apply
  rt.game.lastGain = diceTotal;
}

function offerPurchase(rt: MpRuntime, p: Player, i: number) {
  if (p.human) {
    rt.game.phase = 'buy';
    rt.game.buySpace = i;
    return;
  }
  if (aiWantsBuy(rt, p, i)) {
    doBuy(rt, p, i);
    afterLandingResolved(rt, p);
  } else {
    pushLog(rt, `${p.name} declines ${SPACES[i].short} — auction time!`, '#ffd166');
    startAuction(rt, i);
  }
}

function startAuction(rt: MpRuntime, i: number) {
  const g = rt.game;
  const active = g.players.map((p) => !p.bankrupt);
  const a: AuctionState = {
    space: i,
    price: 10,
    high: null,
    active,
    current: 0,
    message: 'Bidding opens at $10',
  };
  g.auction = a;
  g.phase = 'auction';
  g.buySpace = null;
  rt.auctionBid = 0;
  // Find first active bidder
  a.current = active.findIndex(Boolean);
  if (a.current < 0) {
    endAuction(rt);
    return;
  }
  // Auto-advance AI bidders until human or done
  runAuctionAiUntilHuman(rt);
}

function endAuction(rt: MpRuntime) {
  const g = rt.game;
  const a = g.auction;
  g.auction = null;
  if (a && a.high !== null && rt.auctionBid > 0) {
    const w = g.players[a.high];
    const bid = Math.min(w.cash, rt.auctionBid);
    w.cash -= bid;
    g.props[a.space].owner = w.id;
    pushLog(rt, `SOLD! ${w.name} wins ${SPACES[a.space].short} at auction for ${money(bid)}.`, w.color);
  } else {
    pushLog(rt, `No bids — ${SPACES[a?.space ?? 0].short} stays with the Bank.`);
  }
  rt.auctionBid = 0;
  const p = g.players[g.turn];
  afterLandingResolved(rt, p);
}

/** Winning bid amount kept in game.lastGain during auction */
function acceptBid(rt: MpRuntime, cur: number, bid: number) {
  const a = rt.game.auction!;
  a.message = `${rt.game.players[cur].name} bids ${money(bid)}`;
  rt.auctionBid = bid;
  a.high = cur;
  a.price = bid + 10;
}

function dropBidder(rt: MpRuntime, cur: number) {
  const a = rt.game.auction!;
  a.active[cur] = false;
  a.message = `${rt.game.players[cur].name} drops out`;
}

function nextAuctionSeat(a: AuctionState, from: number, len: number): number {
  let cur = from;
  for (let k = 0; k < len; k++) {
    cur = (cur + 1) % len;
    if (a.active[cur]) return cur;
  }
  return -1;
}

function runAuctionAiUntilHuman(rt: MpRuntime) {
  const g = rt.game;
  const a = g.auction;
  if (!a) return;
  const rng = restoreRng(rt);
  let guard = 0;
  while (a.active.some(Boolean) && guard++ < 160) {
    if (a.high !== null && a.high === a.current) {
      endAuction(rt);
      return;
    }
    if (!a.active[a.current]) {
      const n = nextAuctionSeat(a, a.current, g.players.length);
      if (n < 0) {
        endAuction(rt);
        return;
      }
      a.current = n;
      continue;
    }
    const p = g.players[a.current];
    if (p.human) {
      // wait for human action
      return;
    }
    const next = a.price;
    const cap = Math.min(p.cash, Math.round(aiValue(rt, p, a.space) * (0.55 + rng() * 0.4)));
    if (next <= cap && p.cash >= next) {
      acceptBid(rt, a.current, next);
    } else {
      dropBidder(rt, a.current);
    }
    if (a.high !== null && a.active.filter(Boolean).length <= 1 && a.active[a.high]) {
      endAuction(rt);
      return;
    }
    const n = nextAuctionSeat(a, a.current, g.players.length);
    if (n < 0 || (a.high !== null && n === a.high && a.active.filter(Boolean).every((on, i) => !on || i === a.high))) {
      endAuction(rt);
      return;
    }
    a.current = n;
  }
  endAuction(rt);
}

function resolveLanding(rt: MpRuntime, p: Player, diceTotal: number, mult = 1) {
  const g = rt.game;
  const sp = SPACES[p.pos];
  switch (sp.type) {
    case 'tax':
      pushLog(rt, `${p.name} lands on ${sp.name}.`, '#ffd6d6');
      charge(rt, p, sp.tax!, null, `in ${sp.name}`);
      afterLandingResolved(rt, p);
      break;
    case 'gotojail':
      goToJail(rt, p);
      finishTurnAfterMove(rt, p);
      break;
    case 'chance':
      drawCard(rt, p, 'CHANCE', diceTotal);
      if (!p.human) {
        // AI auto-acks
        applyPendingCard(rt, p);
      }
      break;
    case 'chest':
      drawCard(rt, p, 'CHEST', diceTotal);
      if (!p.human) applyPendingCard(rt, p);
      break;
    case 'parking':
      pushLog(rt, `${p.name} rests at Free Parking.`, '#9ad7c5');
      afterLandingResolved(rt, p);
      break;
    case 'go':
      afterLandingResolved(rt, p);
      break;
    case 'jail':
      if (!p.inJail) pushLog(rt, `${p.name} is just visiting the jail.`);
      afterLandingResolved(rt, p);
      break;
    case 'prop':
    case 'rr':
    case 'util': {
      const st = g.props[sp.i];
      if (st.owner === null) {
        offerPurchase(rt, p, sp.i);
      } else if (st.owner === p.id) {
        pushLog(rt, `${p.name} lands on their own ${sp.short}.`);
        afterLandingResolved(rt, p);
      } else if (st.mortgaged) {
        pushLog(rt, `${sp.short} is mortgaged — no rent due.`, '#9ad7c5');
        afterLandingResolved(rt, p);
      } else {
        const owner = g.players[st.owner];
        const rent = rentFor(g, sp.i, diceTotal, mult);
        pushLog(rt, `${sp.short} is owned by ${owner.name}. Rent is ${money(rent)}.`, '#ffd166');
        charge(rt, p, rent, owner, `rent to ${owner.name}`);
        afterLandingResolved(rt, p);
      }
      break;
    }
    default:
      afterLandingResolved(rt, p);
  }
}

function applyPendingCard(rt: MpRuntime, p: Player) {
  const card = rt.pendingCard;
  const diceTotal = rt.game.lastGain || 7;
  rt.pendingCard = null;
  rt.game.card = null;
  if (!card) {
    afterLandingResolved(rt, p);
    return;
  }
  applyCardEffects(rt, p, card, diceTotal);
  // applyCardEffects may have set another phase (buy/card/jail). If still mid-resolve, don't force.
  if (rt.game.phase === 'card' || rt.game.phase === 'buy' || rt.game.phase === 'auction') return;
  if (p.inJail) {
    finishTurnAfterMove(rt, p);
    return;
  }
  afterLandingResolved(rt, p);
}

function checkEndGame(rt: MpRuntime): boolean {
  const g = rt.game;
  if (liveCount(g) <= 1) {
    const w = g.players.find((q) => !q.bankrupt) || null;
    g.phase = 'over';
    g.winner = w ? w.id : null;
    pushLog(rt, w ? `${w.name} wins Deco City!` : 'Game over.', '#e9c46a');
    return true;
  }
  return false;
}

function advanceTurn(rt: MpRuntime) {
  const g = rt.game;
  let guard = 0;
  do {
    g.turn = (g.turn + 1) % g.players.length;
    if (g.turn === 0) g.round++;
  } while (g.players[g.turn].bankrupt && guard++ < 10);
  rt.awaitingExtraRoll = false;
  g.doubles = 0;
  g.jailChoice = false;
  g.buySpace = null;
  beginTurn(rt);
}

function beginTurn(rt: MpRuntime) {
  const g = rt.game;
  if (checkEndGame(rt)) return;
  const p = g.players[g.turn];
  pushLog(rt, `— ${p.name}'s turn —`, '#8aa0c8');
  g.doubles = 0;
  rt.awaitingExtraRoll = false;
  if (p.inJail) {
    p.jailTurns++;
    if (p.human) {
      g.jailChoice = true;
      g.phase = 'roll';
      return;
    }
    // AI jail decision
    if (p.getOut > 0) {
      p.getOut--;
      p.inJail = false;
      pushLog(rt, `${p.name} uses a Get Out of Jail Free card.`, '#e9c46a');
      g.phase = 'ai';
      performRoll(rt, p);
      return;
    }
    if (p.cash > 300 && p.jailTurns >= 2) {
      charge(rt, p, 50, null, 'bail');
      p.inJail = false;
      g.phase = 'ai';
      performRoll(rt, p);
      return;
    }
    // try doubles
    const d = rollDice(rt);
    pushLog(rt, `${p.name} rolls ${d[0]} + ${d[1]} = ${d[0] + d[1]}${d[0] === d[1] ? ' (doubles!)' : ''}.`, p.color);
    if (d[0] === d[1]) {
      p.inJail = false;
      p.jailTurns = 0;
      pushLog(rt, `${p.name} rolls doubles and escapes jail!`, '#7ee787');
      stepMove(rt, p, d[0] + d[1]);
      resolveLanding(rt, p, d[0] + d[1]);
      return;
    }
    if (p.jailTurns >= 3) {
      pushLog(rt, `${p.name} must pay the $50 fine after three tries.`, '#ffd166');
      charge(rt, p, 50, null, 'the jail fine');
      p.inJail = false;
      p.jailTurns = 0;
      if (p.bankrupt) {
        if (!checkEndGame(rt)) advanceTurn(rt);
        return;
      }
      stepMove(rt, p, d[0] + d[1]);
      resolveLanding(rt, p, d[0] + d[1]);
      return;
    }
    pushLog(rt, `${p.name} stays in jail (${p.jailTurns}/3).`, '#ff9f68');
    finishTurnAfterMove(rt, p);
    return;
  }
  if (p.human) {
    g.phase = 'roll';
  } else {
    g.phase = 'ai';
    performRoll(rt, p);
  }
}

function afterLandingResolved(rt: MpRuntime, p: Player) {
  if (checkEndGame(rt)) return;
  if (p.bankrupt) {
    advanceTurn(rt);
    return;
  }
  if (p.inJail) {
    finishTurnAfterMove(rt, p);
    return;
  }
  if (rt.awaitingExtraRoll || (rt.game.doubles > 0 && rt.game.doubles < 3 && rt.game.dice[0] === rt.game.dice[1])) {
    // doubles: roll again
    if (rt.game.dice[0] === rt.game.dice[1] && !p.inJail) {
      pushLog(rt, `${p.name} rolls again (doubles).`, '#e9c46a');
      rt.awaitingExtraRoll = false;
      if (p.human) {
        rt.game.phase = 'roll';
        return;
      }
      performRoll(rt, p);
      return;
    }
  }
  finishTurnAfterMove(rt, p);
}

function finishTurnAfterMove(rt: MpRuntime, p: Player) {
  if (checkEndGame(rt)) return;
  if (p.bankrupt) {
    advanceTurn(rt);
    return;
  }
  // If doubles pending handled above; clear extra
  if (!p.human) {
    aiDevelop(rt, p);
    advanceTurn(rt);
    return;
  }
  rt.game.phase = 'manage';
}

function aiDevelop(rt: MpRuntime, p: Player) {
  const g = rt.game;
  let guard = 0;
  while (guard++ < 20) {
    const options = playerProps(g, p.id).filter((i) => canBuild(g, i) && p.cash - (SPACES[i].houseCost || 0) > 180);
    if (!options.length) break;
    options.sort((a, b) => (SPACES[b].rents![1] || 0) - (SPACES[a].rents![1] || 0));
      const i = options[0];
      p.cash -= SPACES[i].houseCost!;
      applyBuild(g, i);
      pushLog(rt, `${p.name} builds on ${SPACES[i].short} (${g.props[i].houses === 5 ? 'HOTEL' : g.props[i].houses + ' house'}).`, p.color);
  }
  for (const i of playerProps(g, p.id)) {
    const st = g.props[i];
    const cost = Math.round((SPACES[i].price! / 2) * 1.1);
    if (st.mortgaged && p.cash - cost > 400) {
      p.cash -= cost;
      st.mortgaged = false;
      pushLog(rt, `${p.name} lifts the mortgage on ${SPACES[i].short}.`, p.color);
    }
  }
}

function performRoll(rt: MpRuntime, p: Player) {
  const g = rt.game;
  g.jailChoice = false;
  const d = rollDice(rt);
  pushLog(rt, `${p.name} rolls ${d[0]} + ${d[1]} = ${d[0] + d[1]}${d[0] === d[1] ? ' (doubles!)' : ''}.`, p.color);
  if (d[0] === d[1]) {
    g.doubles++;
    if (g.doubles === 3) {
      pushLog(rt, `${p.name} rolls a third double — straight to jail!`, '#ff6b6b');
      goToJail(rt, p);
      finishTurnAfterMove(rt, p);
      return;
    }
    rt.awaitingExtraRoll = true;
  } else {
    rt.awaitingExtraRoll = false;
  }
  g.phase = 'moving';
  stepMove(rt, p, d[0] + d[1]);
  resolveLanding(rt, p, d[0] + d[1]);
}

export function createRuntime(
  seats: { name: string; human: boolean; token?: string; color?: string }[],
  seed?: number,
): MpRuntime {
  const s = seed ?? (Date.now() ^ (Math.random() * 1e9)) | 0;
  const rng = makeRng(s);
  let calls = 0;
  const wrapped = () => {
    calls++;
    return rng();
  };
  const chanceDeck = shuffled(16, wrapped);
  const chestDeck = shuffled(16, wrapped);
  const game = newMultiplayerGame(seats);
  const rt: MpRuntime = {
    game,
    chanceDeck,
    chestDeck,
    logId: 2,
    seed: s,
    rngCalls: calls,
    pendingRentMult: 1,
    pendingCard: null,
    awaitingExtraRoll: false,
    auctionBid: 0,
    pendingTrade: null,
  };
  beginTurn(rt);
  return rt;
}

function assertHumanTurn(rt: MpRuntime, seat: number, allowPhases: string[]) {
  const g = rt.game;
  if (g.phase === 'over') throw new Error('Game is over');
  if (!allowPhases.includes(g.phase)) throw new Error(`Cannot act in phase ${g.phase}`);
  const p = g.players[seat];
  if (!p || !p.human || p.bankrupt) throw new Error('Not your seat');
  if (g.phase === 'auction') {
    if (!g.auction || g.auction.current !== seat) throw new Error('Not your bid');
    return;
  }
  if (g.turn !== seat) throw new Error('Not your turn');
}

export function applyAction(rt: MpRuntime, seat: number, action: MpAction): MpRuntime {
  const g = rt.game;
  ensureBankStock(g);
  const p = g.players[seat];

  switch (action.type) {
    case 'roll': {
      assertHumanTurn(rt, seat, ['roll']);
      if (g.jailChoice) throw new Error('Choose jail option first');
      performRoll(rt, p);
      break;
    }
    case 'jail': {
      assertHumanTurn(rt, seat, ['roll']);
      if (!g.jailChoice || !p.inJail) throw new Error('Not in jail choice');
      const ans = String(action.payload || 'roll');
      g.jailChoice = false;
      if (ans === 'card' && p.getOut > 0) {
        p.getOut--;
        p.inJail = false;
        pushLog(rt, `${p.name} uses a Get Out of Jail Free card.`, '#e9c46a');
        g.phase = 'roll';
        break;
      }
      if (ans === 'pay' && p.cash >= 50) {
        charge(rt, p, 50, null, 'bail');
        p.inJail = false;
        g.phase = 'roll';
        break;
      }
      // roll for doubles
      const d = rollDice(rt);
      pushLog(rt, `${p.name} rolls ${d[0]} + ${d[1]} = ${d[0] + d[1]}${d[0] === d[1] ? ' (doubles!)' : ''}.`, p.color);
      if (d[0] === d[1]) {
        p.inJail = false;
        p.jailTurns = 0;
        pushLog(rt, `${p.name} rolls doubles and escapes jail!`, '#7ee787');
        stepMove(rt, p, d[0] + d[1]);
        resolveLanding(rt, p, d[0] + d[1]);
        break;
      }
      if (p.jailTurns >= 3) {
        pushLog(rt, `${p.name} must pay the $50 fine after three tries.`, '#ffd166');
        charge(rt, p, 50, null, 'the jail fine');
        p.inJail = false;
        p.jailTurns = 0;
        if (p.bankrupt) {
          if (!checkEndGame(rt)) advanceTurn(rt);
          break;
        }
        stepMove(rt, p, d[0] + d[1]);
        resolveLanding(rt, p, d[0] + d[1]);
        break;
      }
      pushLog(rt, `${p.name} stays in jail (${p.jailTurns}/3).`, '#ff9f68');
      finishTurnAfterMove(rt, p);
      break;
    }
    case 'buy': {
      assertHumanTurn(rt, seat, ['buy']);
      const i = g.buySpace!;
      const ans = String(action.payload || 'auction');
      g.buySpace = null;
      if (ans === 'buy' && p.cash >= (SPACES[i].price || 0)) {
        doBuy(rt, p, i);
        afterLandingResolved(rt, p);
      } else {
        pushLog(rt, `${p.name} declines ${SPACES[i].short} — going to auction!`, '#ffd166');
        startAuction(rt, i);
      }
      break;
    }
    case 'auction': {
      assertHumanTurn(rt, seat, ['auction']);
      const a = g.auction!;
      const ans = String(action.payload || 'pass');
      const next = a.price;
      if (ans === 'bid' && p.cash >= next) {
        acceptBid(rt, seat, next);
      } else {
        dropBidder(rt, seat);
      }
      if (a.high !== null && a.high === a.current && ans === 'bid') {
        // after bid, move to next
      }
      const n = nextAuctionSeat(a, a.current, g.players.length);
      if (n < 0 || (a.high !== null && !a.active.some((on, i) => on && i !== a.high))) {
        endAuction(rt);
        break;
      }
      // If only high bidder remains active
      if (a.high !== null && a.active.every((on, i) => !on || i === a.high)) {
        endAuction(rt);
        break;
      }
      a.current = n;
      if (a.high !== null && a.current === a.high) {
        endAuction(rt);
        break;
      }
      runAuctionAiUntilHuman(rt);
      break;
    }
    case 'ack': {
      assertHumanTurn(rt, seat, ['card']);
      applyPendingCard(rt, p);
      break;
    }
    case 'endturn': {
      assertHumanTurn(rt, seat, ['manage']);
      advanceTurn(rt);
      break;
    }
    case 'build': {
      assertHumanTurn(rt, seat, ['manage', 'roll']);
      const i = Number(action.payload);
      if (!canBuild(g, i) || g.props[i].owner !== seat) throw new Error('Cannot build');
      p.cash -= SPACES[i].houseCost!;
      applyBuild(g, i);
      pushLog(rt, `${p.name} builds on ${SPACES[i].short}.`, '#7ee787');
      break;
    }
    case 'sellHouse': {
      assertHumanTurn(rt, seat, ['manage', 'roll']);
      const i = Number(action.payload);
      if (!canSellHouse(g, i) || g.props[i].owner !== seat) throw new Error('Cannot sell');
      applySellHouse(g, i);
      p.cash += SPACES[i].houseCost! / 2;
      pushLog(rt, `${p.name} sells a building on ${SPACES[i].short}.`, '#ffd166');
      break;
    }
    case 'mortgage': {
      assertHumanTurn(rt, seat, ['manage', 'roll']);
      const i = Number(action.payload);
      if (!canMortgage(g, i) || g.props[i].owner !== seat) throw new Error('Cannot mortgage');
      g.props[i].mortgaged = true;
      p.cash += SPACES[i].price! / 2;
      pushLog(rt, `${p.name} mortgages ${SPACES[i].short}.`, '#ffd166');
      break;
    }
    case 'unmortgage': {
      assertHumanTurn(rt, seat, ['manage', 'roll']);
      const i = Number(action.payload);
      const st = g.props[i];
      const cost = Math.round((SPACES[i].price! / 2) * 1.1);
      if (!st?.mortgaged || st.owner !== seat || p.cash < cost) throw new Error('Cannot unmortgage');
      st.mortgaged = false;
      p.cash -= cost;
      pushLog(rt, `${p.name} lifts the mortgage on ${SPACES[i].short}.`, '#7ee787');
      break;
    }
    case 'tradeOffer': {
      assertHumanTurn(rt, seat, ['manage', 'roll']);
      const payload = (action.payload || {}) as {
        to: number;
        give: number[];
        get: number[];
        cash: number;
      };
      const to = Number(payload.to);
      const give = (payload.give || []).map(Number);
      const get = (payload.get || []).map(Number);
      const cash = Number(payload.cash) || 0;
      const rival = g.players[to];
      if (!rival || rival.bankrupt || to === seat) throw new Error('Bad trade target');
      if (!give.length && !get.length) throw new Error('Offer something first');
      if (cash > 0 && p.cash < cash) throw new Error("You don't have that cash");
      if (cash < 0 && rival.cash < -cash) throw new Error('Rival cannot pay that');
      if ([...give, ...get].some((i) => (g.props[i]?.houses || 0) > 0)) {
        throw new Error('Sell buildings before trading that set');
      }
      if (give.some((i) => g.props[i]?.owner !== seat)) throw new Error('You do not own those deeds');
      if (get.some((i) => g.props[i]?.owner !== to)) throw new Error('Rival does not own those deeds');

      if (!rival.human) {
        const before = stratWorth(g.props, to);
        const hBefore = stratWorth(g.props, seat);
        const sim: Game['props'] = {};
        for (const k of Object.keys(g.props)) sim[+k] = { ...g.props[+k] };
        give.forEach((i) => (sim[i].owner = to));
        get.forEach((i) => (sim[i].owner = seat));
        const aiDelta = stratWorth(sim, to) - before + cash;
        const hDelta = stratWorth(sim, seat) - hBefore - cash;
        const accepted = aiDelta > 20 && aiDelta >= hDelta * 0.75;
        if (!accepted) {
          pushLog(rt, `${rival.name} rejects the trade.`, '#ff8f8f');
          break;
        }
        applyTradeDeal(rt, seat, to, give, get, cash);
        break;
      }

      rt.pendingTrade = { from: seat, to, give, get, cash };
      pushLog(rt, `${p.name} offers a trade to ${rival.name}.`, '#e9c46a');
      break;
    }
    case 'tradeRespond': {
      const payload = (action.payload || {}) as { accept: boolean };
      const t = rt.pendingTrade;
      if (!t || t.to !== seat) throw new Error('No trade for you');
      if (!payload.accept) {
        pushLog(rt, `${p.name} declines the trade.`, '#ff8f8f');
        rt.pendingTrade = null;
        break;
      }
      const from = g.players[t.from];
      if (!from || from.bankrupt) {
        rt.pendingTrade = null;
        throw new Error('Offer expired');
      }
      if (t.cash > 0 && from.cash < t.cash) throw new Error('Offer no longer affordable');
      if (t.cash < 0 && p.cash < -t.cash) throw new Error('You cannot pay that');
      applyTradeDeal(rt, t.from, t.to, t.give, t.get, t.cash);
      rt.pendingTrade = null;
      break;
    }
    default:
      throw new Error('Unknown action');
  }

  // After human action, if phase is ai somehow, continue
  let guard = 0;
  while (g.phase === 'ai' && guard++ < 5) {
    const cur = g.players[g.turn];
    if (cur.human) {
      g.phase = 'roll';
      break;
    }
    performRoll(rt, cur);
  }

  if (g.phase === 'over') {
    // mark ended by caller
  }

  return rt;
}
