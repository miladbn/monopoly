import { useCallback, useEffect, useRef, useState } from 'react';
import { CHANCE, CHEST, Card, GROUP_MEMBERS, SPACES } from './data';
import {
  AuctionState,
  Game,
  Player,
  canBuild,
  canMortgage,
  canSellHouse,
  hasMonopoly,
  liveCount,
  money,
  netWorth,
  newGame,
  playerProps,
  rentFor,
} from './engine';
import { elCenter, fx } from './fx';
import { sfx } from './sfx';

class Abort extends Error {}

export interface HighScore {
  name: string;
  score: number;
  worth: number;
  rounds: number;
  won: boolean;
  date: string;
}

const HS_KEY = 'deco-city-highscores-v1';

export function loadScores(): HighScore[] {
  try {
    const raw = localStorage.getItem(HS_KEY);
    if (!raw) return [];
    return (JSON.parse(raw) as HighScore[]).slice(0, 10);
  } catch {
    return [];
  }
}

function saveScore(s: HighScore): HighScore[] {
  const all = [...loadScores(), s].sort((a, b) => b.score - a.score).slice(0, 10);
  try {
    localStorage.setItem(HS_KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
  return all;
}

function emptyGame(): Game {
  const g = newGame('You', 3);
  g.started = false;
  g.phase = 'menu';
  return g;
}

function shuffled(n: number): number[] {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = a.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function useGame() {
  const G = useRef<Game>(emptyGame());
  const [, force] = useState(0);
  const sync = useCallback(() => force((v) => v + 1), []);
  const gen = useRef(0);
  const paused = useRef(false);
  const speed = useRef(1);
  const logId = useRef(2);
  const pending = useRef<{ type: string; resolve: (v: unknown) => void; reject: (e: unknown) => void } | null>(null);
  const chanceDeck = useRef<number[]>(shuffled(16));
  const chestDeck = useRef<number[]>(shuffled(16));
  const [scores, setScores] = useState<HighScore[]>(() => loadScores());
  const [lastScore, setLastScore] = useState<HighScore | null>(null);

  const S = () => G.current;

  const log = useCallback((text: string, color?: string) => {
    const g = G.current;
    g.log = [{ id: logId.current++, text, color }, ...g.log].slice(0, 40);
  }, []);

  /* ---------------- timing ---------------- */
  const sleep = (ms: number) =>
    new Promise<void>((res, rej) => {
      const start = gen.current;
      let left = ms * speed.current;
      const t = setInterval(() => {
        if (gen.current !== start) {
          clearInterval(t);
          rej(new Abort());
          return;
        }
        if (paused.current) return;
        left -= 40;
        if (left <= 0) {
          clearInterval(t);
          res();
        }
      }, 40);
    });

  const waitFor = <T,>(type: string, timeout?: number) =>
    new Promise<T | null>((res, rej) => {
      const start = gen.current;
      let done = false;
      const handle = {
        type,
        resolve: (v: unknown) => {
          if (done) return;
          done = true;
          if (pending.current === handle) pending.current = null;
          res(v as T);
        },
        reject: (e: unknown) => {
          if (done) return;
          done = true;
          if (pending.current === handle) pending.current = null;
          rej(e);
        },
      };
      pending.current = handle;
      const t = setInterval(() => {
        if (done) {
          clearInterval(t);
          return;
        }
        if (gen.current !== start) {
          clearInterval(t);
          handle.reject(new Abort());
          return;
        }
        if (paused.current) return;
        if (timeout !== undefined) {
          timeout -= 60;
          if (timeout <= 0) {
            clearInterval(t);
            handle.resolve(null);
          }
        }
      }, 60);
    });

  const respond = useCallback((type: string, value: unknown) => {
    if (pending.current && pending.current.type === type) pending.current.resolve(value);
  }, []);

  /* ---------------- fx helpers ---------------- */
  const atToken = (p: Player) => elCenter(`#tok-${p.id}`);
  const atSpace = (i: number) => elCenter(`[data-space="${i}"]`);

  const popText = (p: Player, text: string, color: string) => {
    const { x, y } = atToken(p);
    fx.text(x, y - 18, text, color, 24);
  };

  /* ---------------- money ---------------- */
  function gain(p: Player, amt: number, label?: string) {
    p.cash += amt;
    p.netPeak = Math.max(p.netPeak, netWorth(S(), p.id));
    sfx.cash();
    popText(p, label || `+${money(amt)}`, '#7ee787');
    const { x, y } = atToken(p);
    fx.burst(x, y, { count: 12, colors: ['#7ee787', '#e9c46a', '#fff3cf'], speed: 4, size: 4 });
  }

  function raiseFunds(p: Player, needed: number) {
    const g = S();
    const mine = playerProps(g, p.id);
    // sell houses, most expensive developments first
    let guard = 0;
    while (p.cash < needed && guard++ < 120) {
      const sellable = mine.filter((i) => canSellHouse(g, i));
      if (!sellable.length) break;
      sellable.sort((a, b) => (SPACES[b].houseCost || 0) - (SPACES[a].houseCost || 0));
      const i = sellable[0];
      g.props[i].houses--;
      p.cash += (SPACES[i].houseCost || 0) / 2;
      log(`${p.name} sells a building on ${SPACES[i].short} for ${money((SPACES[i].houseCost || 0) / 2)}.`, '#ffb4a2');
    }
    guard = 0;
    while (p.cash < needed && guard++ < 60) {
      const m = mine.filter((i) => canMortgage(g, i));
      if (!m.length) break;
      m.sort((a, b) => (SPACES[a].price || 0) - (SPACES[b].price || 0));
      const i = m[0];
      g.props[i].mortgaged = true;
      p.cash += (SPACES[i].price || 0) / 2;
      log(`${p.name} mortgages ${SPACES[i].short} for ${money((SPACES[i].price || 0) / 2)}.`, '#ffb4a2');
    }
  }

  function bankrupt(p: Player, creditor: Player | null) {
    const g = S();
    p.bankrupt = true;
    const mine = playerProps(g, p.id);
    if (creditor) {
      creditor.cash += p.cash;
      for (const i of mine) {
        const st = g.props[i];
        creditor.cash += (st.houses * (SPACES[i].houseCost || 0)) / 2;
        st.houses = 0;
        st.owner = creditor.id;
      }
      log(`💀 ${p.name} is BANKRUPT! All assets go to ${creditor.name}.`, '#ff6b6b');
    } else {
      for (const i of mine) g.props[i] = { owner: null, houses: 0, mortgaged: false };
      log(`💀 ${p.name} is BANKRUPT! Assets return to the Bank.`, '#ff6b6b');
    }
    p.cash = 0;
    const { x, y } = atToken(p);
    sfx.bust();
    fx.burst(x, y, { count: 40, colors: ['#ff6b6b', '#8b0000', '#333'], speed: 8, size: 7 });
    fx.shake(22);
    fx.flash('255,80,80', 0.3);
  }

  /** returns false if the payer went bankrupt */
  function charge(p: Player, amt: number, creditor: Player | null, reason: string): boolean {
    const g = S();
    if (p.cash < amt) raiseFunds(p, amt);
    if (p.cash < amt) {
      const owed = Math.min(p.cash, amt);
      if (creditor) creditor.cash += owed;
      p.cash -= owed;
      bankrupt(p, creditor);
      sync();
      return false;
    }
    p.cash -= amt;
    if (creditor) creditor.cash += amt;
    sfx.pay();
    popText(p, `-${money(amt)}`, '#ff8f8f');
    const { x, y } = atToken(p);
    fx.burst(x, y, { count: 14, colors: ['#ff6b6b', '#ffb4a2'], speed: 5, size: 5 });
    fx.shake(Math.min(18, 5 + amt / 45));
    if (creditor) {
      const c = atToken(creditor);
      fx.text(c.x, c.y - 18, `+${money(amt)}`, '#7ee787', 22);
      fx.ring(c.x, c.y, creditor.color);
    }
    log(`${p.name} pays ${money(amt)} ${reason}.`, '#ffd6d6');
    void g;
    return true;
  }

  /* ---------------- movement ---------------- */
  async function stepMove(p: Player, steps: number, collectGo = true) {
    const g = S();
    g.phase = 'moving';
    const dir = steps >= 0 ? 1 : -1;
    const n = Math.abs(steps);
    const per = Math.max(60, 170 - n * 4);
    for (let k = 0; k < n; k++) {
      p.pos = (p.pos + dir + 40) % 40;
      if (dir === 1 && p.pos === 0 && collectGo) {
        gain(p, 200, 'GO +$200');
        log(`${p.name} passes GO and collects $200.`, '#7ee787');
        fx.flash('233,196,106', 0.16);
      }
      sync();
      sfx.step();
      const c = atToken(p);
      fx.burst(c.x, c.y, { count: 2, colors: [p.color], speed: 1.6, size: 3, grav: 0.02 });
      await sleep(per);
    }
    const c = atSpace(p.pos);
    fx.ring(c.x, c.y, p.color);
  }

  async function moveTo(p: Player, target: number, collectGo = true) {
    const steps = (target - p.pos + 40) % 40;
    await stepMove(p, steps === 0 ? 40 : steps, collectGo);
  }

  function goToJail(p: Player) {
    p.pos = 10;
    p.inJail = true;
    p.jailTurns = 0;
    S().doubles = 0;
    log(`🚨 ${p.name} is sent to JAIL!`, '#ff9f68');
    sfx.jail();
    fx.shake(16);
    fx.flash('255,120,60', 0.22);
    const c = atSpace(10);
    fx.burst(c.x, c.y, { count: 26, colors: ['#ff9f68', '#e9c46a'], speed: 6, size: 5 });
    sync();
  }

  /* ---------------- cards ---------------- */
  async function drawCard(p: Player, deck: 'CHANCE' | 'CHEST', diceTotal: number) {
    const g = S();
    const list = deck === 'CHANCE' ? CHANCE : CHEST;
    const ref = deck === 'CHANCE' ? chanceDeck : chestDeck;
    if (!ref.current.length) ref.current = shuffled(16);
    const idx = ref.current.shift()!;
    const card: Card = list[idx];
    g.card = { deck, text: card.text };
    g.phase = 'card';
    sync();
    sfx.card();
    const c = atSpace(p.pos);
    fx.burst(c.x, c.y, {
      count: 20,
      colors: deck === 'CHANCE' ? ['#f2873b', '#ffd166'] : ['#8fd3f4', '#7ee787'],
      speed: 6,
      size: 5,
    });
    log(`${p.name} draws ${deck === 'CHANCE' ? 'Chance' : 'Community Chest'}: ${card.text}`, '#8fd3f4');
    if (p.human) await waitFor('ack', 6000);
    else await sleep(1500);
    g.card = null;
    sync();
    await applyCard(p, card, diceTotal);
  }

  async function applyCard(p: Player, card: Card, diceTotal: number) {
    const g = S();
    const a = card.act;
    switch (a.k) {
      case 'move':
        await moveTo(p, a.to, !!a.collectGo);
        await resolveLanding(p, diceTotal);
        break;
      case 'moveBack':
        await stepMove(p, -a.n, false);
        await resolveLanding(p, diceTotal);
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
        await moveTo(p, target, true);
        await resolveLanding(p, diceTotal, 2);
        break;
      }
      case 'cash':
        if (a.amt >= 0) {
          gain(p, a.amt);
          log(`${p.name} collects ${money(a.amt)}.`, '#7ee787');
        } else charge(p, -a.amt, null, 'to the Bank');
        break;
      case 'jail':
        goToJail(p);
        break;
      case 'getout':
        p.getOut++;
        popText(p, 'JAIL FREE!', '#e9c46a');
        break;
      case 'repairs': {
        let houses = 0;
        let hotels = 0;
        for (const i of playerProps(g, p.id)) {
          if (g.props[i].houses === 5) hotels++;
          else houses += g.props[i].houses;
        }
        const total = houses * a.house + hotels * a.hotel;
        if (total > 0) charge(p, total, null, `for repairs (${houses}h/${hotels}H)`);
        else log(`${p.name} has nothing to repair.`);
        break;
      }
      case 'each': {
        for (const q of g.players) {
          if (q.id === p.id || q.bankrupt) continue;
          if (a.amt > 0) {
            if (charge(q, a.amt, p, `to ${p.name}`)) popText(p, `+${money(a.amt)}`, '#7ee787');
          } else {
            if (!charge(p, -a.amt, q, `to ${q.name}`)) break;
          }
        }
        break;
      }
    }
    sync();
  }

  /* ---------------- landing ---------------- */
  async function resolveLanding(p: Player, diceTotal: number, mult = 1) {
    const g = S();
    const sp = SPACES[p.pos];
    sync();
    await sleep(220);
    switch (sp.type) {
      case 'tax': {
        log(`${p.name} lands on ${sp.name}.`, '#ffd6d6');
        charge(p, sp.tax!, null, `in ${sp.name}`);
        break;
      }
      case 'gotojail':
        goToJail(p);
        break;
      case 'chance':
        await drawCard(p, 'CHANCE', diceTotal);
        break;
      case 'chest':
        await drawCard(p, 'CHEST', diceTotal);
        break;
      case 'parking':
        log(`${p.name} rests at Free Parking.`, '#9ad7c5');
        popText(p, 'FREE PARKING', '#9ad7c5');
        break;
      case 'go':
        popText(p, 'GO!', '#e9c46a');
        break;
      case 'jail':
        if (!p.inJail) log(`${p.name} is just visiting the jail.`);
        break;
      case 'prop':
      case 'rr':
      case 'util': {
        const st = g.props[sp.i];
        if (st.owner === null) {
          await offerPurchase(p, sp.i);
        } else if (st.owner === p.id) {
          log(`${p.name} lands on their own ${sp.short}.`);
        } else if (st.mortgaged) {
          log(`${sp.short} is mortgaged — no rent due.`, '#9ad7c5');
        } else {
          const owner = g.players[st.owner];
          const rent = rentFor(g, sp.i, diceTotal, mult);
          log(`${sp.short} is owned by ${owner.name}. Rent is ${money(rent)}.`, '#ffd166');
          fx.flash('255,107,107', 0.12);
          charge(p, rent, owner, `rent to ${owner.name}`);
        }
        break;
      }
    }
    sync();
  }

  /* ---------------- buying & auction ---------------- */
  async function offerPurchase(p: Player, i: number) {
    const g = S();
    const sp = SPACES[i];
    if (p.human) {
      g.phase = 'buy';
      g.buySpace = i;
      sync();
      const ans = (await waitFor<string>('buy')) || 'auction';
      g.buySpace = null;
      if (ans === 'buy') {
        doBuy(p, i);
        return;
      }
      log(`${p.name} declines ${sp.short} — going to auction!`, '#ffd166');
      await runAuction(i);
    } else {
      await sleep(600);
      if (aiWantsBuy(p, i)) doBuy(p, i);
      else {
        log(`${p.name} declines ${sp.short} — auction time!`, '#ffd166');
        await runAuction(i);
      }
    }
  }

  function doBuy(p: Player, i: number) {
    const g = S();
    const sp = SPACES[i];
    p.cash -= sp.price!;
    g.props[i].owner = p.id;
    log(`🏷️ ${p.name} buys ${sp.name} for ${money(sp.price!)}.`, p.color);
    sfx.buy();
    const c = atSpace(i);
    fx.confetti(c.x, c.y);
    fx.ring(c.x, c.y, p.color);
    fx.text(c.x, c.y - 26, 'BOUGHT!', p.color, 22);
    fx.shake(6);
    if (sp.group && hasMonopoly(g, sp.group, p.id)) {
      log(`🎉 ${p.name} completes the ${sp.group.toUpperCase()} monopoly!`, '#e9c46a');
      fx.flash('233,196,106', 0.25);
      fx.shake(12);
      for (const j of GROUP_MEMBERS[sp.group]) {
        const cc = atSpace(j);
        fx.confetti(cc.x, cc.y);
      }
    }
    sync();
  }

  function aiValue(p: Player, i: number): number {
    const g = S();
    const sp = SPACES[i];
    let v = sp.price!;
    if (sp.group) {
      const owned = GROUP_MEMBERS[sp.group].filter((x) => g.props[x].owner === p.id).length;
      const total = GROUP_MEMBERS[sp.group].length;
      if (owned === total - 1) v *= 1.75;
      else if (owned > 0) v *= 1.3;
      const rivals = GROUP_MEMBERS[sp.group].filter((x) => g.props[x].owner !== null && g.props[x].owner !== p.id).length;
      if (rivals === total - 1) v *= 1.25; // block the rival
    }
    return Math.round(v);
  }

  function aiWantsBuy(p: Player, i: number): boolean {
    const sp = SPACES[i];
    const value = aiValue(p, i);
    const reserve = S().round < 4 ? 40 : 160;
    if (p.cash - sp.price! < reserve) return value > sp.price! * 1.5 && p.cash >= sp.price!;
    return value >= sp.price!;
  }

  async function runAuction(i: number) {
    const g = S();
    const active = g.players.map((p) => !p.bankrupt);
    const caps = g.players.map((p) => (p.human ? 0 : Math.min(p.cash, Math.round(aiValue(p, i) * (0.55 + Math.random() * 0.4)))));
    let bid = 0;
    let high: number | null = null;
    let cur = 0;
    const a: AuctionState = { space: i, price: 10, high: null, active, current: 0, message: 'Bidding opens at $10' };
    g.auction = a;
    g.phase = 'auction';
    sync();
    let guard = 0;
    while (active.some(Boolean) && guard++ < 160) {
      if (!active[cur]) {
        cur = (cur + 1) % g.players.length;
        continue;
      }
      if (high === cur) break;
      const p = g.players[cur];
      const next = bid + 10;
      a.price = next;
      a.high = high;
      a.current = cur;
      sync();
      if (p.human) {
        const ans = (await waitFor<string>('auction')) || 'pass';
        if (ans === 'bid' && p.cash >= next) {
          bid = next;
          high = cur;
          a.message = `${p.name} bids ${money(bid)}`;
          fx.shake(4);
        } else {
          active[cur] = false;
          a.message = `${p.name} drops out`;
        }
      } else {
        await sleep(520);
        if (next <= caps[cur] && p.cash >= next) {
          bid = next;
          high = cur;
          a.message = `${p.name} bids ${money(bid)}`;
        } else {
          active[cur] = false;
          a.message = `${p.name} drops out`;
        }
      }
      a.high = high;
      sync();
      cur = (cur + 1) % g.players.length;
    }
    await sleep(500);
    g.auction = null;
    if (high !== null) {
      const w = g.players[high];
      w.cash -= bid;
      g.props[i].owner = w.id;
      log(`🔨 SOLD! ${w.name} wins ${SPACES[i].short} at auction for ${money(bid)}.`, w.color);
      const c = atSpace(i);
      fx.confetti(c.x, c.y);
      fx.shake(8);
    } else {
      log(`No bids — ${SPACES[i].short} stays with the Bank.`);
    }
    sync();
  }

  /* ---------------- jail ---------------- */
  async function handleJail(p: Player): Promise<boolean> {
    // returns true if the player may move this turn
    const g = S();
    p.jailTurns++;
    if (p.human) {
      g.jailChoice = true;
      g.phase = 'roll';
      sync();
      const ans = (await waitFor<string>('jail')) || 'roll';
      g.jailChoice = false;
      sync();
      if (ans === 'card' && p.getOut > 0) {
        p.getOut--;
        p.inJail = false;
        log(`${p.name} uses a Get Out of Jail Free card.`, '#e9c46a');
        popText(p, 'FREE!', '#e9c46a');
        return true;
      }
      if (ans === 'pay' && p.cash >= 50) {
        charge(p, 50, null, 'bail');
        p.inJail = false;
        return true;
      }
    } else {
      await sleep(500);
      if (p.getOut > 0) {
        p.getOut--;
        p.inJail = false;
        log(`${p.name} uses a Get Out of Jail Free card.`, '#e9c46a');
        return true;
      }
      if (p.cash > 300 && p.jailTurns >= 2) {
        charge(p, 50, null, 'bail');
        p.inJail = false;
        return true;
      }
    }
    // roll for doubles
    const d = await rollDiceAnim(p);
    if (d[0] === d[1]) {
      p.inJail = false;
      p.jailTurns = 0;
      log(`${p.name} rolls doubles and escapes jail!`, '#7ee787');
      popText(p, 'ESCAPE!', '#7ee787');
      await stepMove(p, d[0] + d[1]);
      await resolveLanding(p, d[0] + d[1]);
      return false;
    }
    if (p.jailTurns >= 3) {
      log(`${p.name} must pay the $50 fine after three tries.`, '#ffd166');
      charge(p, 50, null, 'the jail fine');
      p.inJail = false;
      p.jailTurns = 0;
      if (p.bankrupt) return false;
      await stepMove(p, d[0] + d[1]);
      await resolveLanding(p, d[0] + d[1]);
      return false;
    }
    log(`${p.name} stays in jail (${p.jailTurns}/3).`, '#ff9f68');
    return false;
  }

  /* ---------------- dice ---------------- */
  async function rollDiceAnim(p: Player): Promise<[number, number]> {
    const g = S();
    g.rolling = true;
    sync();
    sfx.dice();
    for (let k = 0; k < 9; k++) {
      g.dice = [1 + ((Math.random() * 6) | 0), 1 + ((Math.random() * 6) | 0)];
      sync();
      await sleep(55);
    }
    const d: [number, number] = [1 + ((Math.random() * 6) | 0), 1 + ((Math.random() * 6) | 0)];
    g.dice = d;
    g.rolling = false;
    sync();
    const c = elCenter('#dice-box');
    fx.burst(c.x, c.y, { count: 14, colors: ['#e9c46a', '#fff'], speed: 5, size: 4 });
    fx.shake(d[0] === d[1] ? 10 : 5);
    log(`${p.name} rolls ${d[0]} + ${d[1]} = ${d[0] + d[1]}${d[0] === d[1] ? ' (doubles!)' : ''}.`, p.color);
    await sleep(260);
    return d;
  }

  /* ---------------- AI development ---------------- */
  async function aiDevelop(p: Player) {
    const g = S();
    let guard = 0;
    while (guard++ < 20) {
      const options = playerProps(g, p.id).filter((i) => canBuild(g, i) && p.cash - (SPACES[i].houseCost || 0) > 180);
      if (!options.length) break;
      options.sort((a, b) => (SPACES[b].rents![1] || 0) - (SPACES[a].rents![1] || 0));
      const i = options[0];
      p.cash -= SPACES[i].houseCost!;
      g.props[i].houses++;
      log(`${p.name} builds on ${SPACES[i].short} (${g.props[i].houses === 5 ? 'HOTEL' : g.props[i].houses + ' house'}).`, p.color);
      const c = atSpace(i);
      fx.burst(c.x, c.y, { count: 10, colors: ['#7ee787', '#2fa85b'], speed: 4, size: 4 });
      sync();
      await sleep(260);
    }
    // unmortgage when rich
    for (const i of playerProps(g, p.id)) {
      const st = g.props[i];
      const cost = Math.round((SPACES[i].price! / 2) * 1.1);
      if (st.mortgaged && p.cash - cost > 400) {
        p.cash -= cost;
        st.mortgaged = false;
        log(`${p.name} lifts the mortgage on ${SPACES[i].short}.`, p.color);
        sync();
        await sleep(160);
      }
    }
  }

  /* ---------------- turn ---------------- */
  async function takeTurn(p: Player) {
    const g = S();
    g.doubles = 0;
    let again = true;
    while (again) {
      again = false;
      if (p.bankrupt) return;
      if (p.inJail) {
        const canMove = await handleJail(p);
        if (!canMove) return;
      }
      g.phase = p.human ? 'roll' : 'ai';
      sync();
      if (p.human) await waitFor('roll');
      else await sleep(600);
      const d = await rollDiceAnim(p);
      if (d[0] === d[1]) {
        g.doubles++;
        if (g.doubles === 3) {
          log(`${p.name} rolls a third double — straight to jail!`, '#ff6b6b');
          goToJail(p);
          return;
        }
        again = true;
      }
      await stepMove(p, d[0] + d[1]);
      await resolveLanding(p, d[0] + d[1]);
      if (p.bankrupt) return;
      if (p.inJail) return;
      if (again) {
        log(`${p.name} rolls again (doubles).`, '#e9c46a');
        await sleep(400);
      }
    }
  }

  function computeScore(won: boolean): HighScore {
    const g = S();
    const human = g.players[0];
    const worth = human.bankrupt ? 0 : netWorth(g, 0);
    const busted = g.players.filter((p) => p.id !== 0 && p.bankrupt).length;
    const score = Math.max(0, Math.round(worth + busted * 500 + (won ? 2500 : 0) + human.netPeak * 0.2 - g.round * 8));
    return {
      name: human.name,
      score,
      worth,
      rounds: g.round,
      won,
      date: new Date().toLocaleDateString(),
    };
  }

  function endGame(won: boolean, winnerId: number | null) {
    const g = S();
    g.phase = 'over';
    g.winner = winnerId;
    const hs = computeScore(won);
    setLastScore(hs);
    setScores(saveScore(hs));
    if (won) {
      sfx.win();
      for (let k = 0; k < 7; k++)
        fx.confetti(window.innerWidth * (0.15 + Math.random() * 0.7), window.innerHeight * (0.2 + Math.random() * 0.3));
      fx.flash('233,196,106', 0.35);
    } else {
      fx.flash('255,70,70', 0.3);
    }
    fx.shake(20);
    sync();
  }

  async function turnLoop() {
    const g = S();
    try {
      for (;;) {
        const p = g.players[g.turn];
        if (!p.bankrupt) {
          log(`— ${p.name}'s turn —`, '#8aa0c8');
          sync();
          await takeTurn(p);
          if (!p.human && !p.bankrupt) await aiDevelop(p);
          if (liveCount(g) <= 1) {
            const w = g.players.find((q) => !q.bankrupt) || null;
            endGame(!!w && w.human, w ? w.id : null);
            return;
          }
          if (g.players[0].bankrupt) {
            const best = [...g.players].filter((q) => !q.bankrupt).sort((a, b) => netWorth(g, b.id) - netWorth(g, a.id))[0];
            endGame(false, best ? best.id : null);
            return;
          }
          if (p.human) {
            g.phase = 'manage';
            sync();
            await waitFor('endturn');
          } else {
            await sleep(400);
          }
        }
        let guard = 0;
        do {
          g.turn = (g.turn + 1) % g.players.length;
          if (g.turn === 0) g.round++;
        } while (g.players[g.turn].bankrupt && guard++ < 10);
        sync();
      }
    } catch (e) {
      if (!(e instanceof Abort)) throw e;
    }
  }

  /* ---------------- public actions ---------------- */
  const start = useCallback((name: string, opponents: number) => {
    gen.current++;
    if (pending.current) pending.current.reject(new Abort());
    chanceDeck.current = shuffled(16);
    chestDeck.current = shuffled(16);
    logId.current = 2;
    G.current = newGame(name, opponents);
    paused.current = false;
    setLastScore(null);
    sync();
    setTimeout(() => void turnLoop(), 60);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toMenu = useCallback(() => {
    gen.current++;
    if (pending.current) pending.current.reject(new Abort());
    G.current = emptyGame();
    paused.current = false;
    sync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const togglePause = useCallback(() => {
    const g = G.current;
    if (!g.started || g.phase === 'over' || g.phase === 'menu') return;
    paused.current = !paused.current;
    g.paused = paused.current;
    sync();
  }, [sync]);

  const setSpeed = useCallback(
    (v: number) => {
      speed.current = v;
      sync();
    },
    [sync],
  );

  const build = useCallback(
    (i: number) => {
      const g = G.current;
      const p = g.players[0];
      if (!canBuild(g, i)) return;
      p.cash -= SPACES[i].houseCost!;
      g.props[i].houses++;
      const c = atSpace(i);
      sfx.build();
      fx.burst(c.x, c.y, { count: 16, colors: ['#7ee787', '#2fa85b', '#e9c46a'], speed: 5, size: 5 });
      fx.text(c.x, c.y - 20, g.props[i].houses === 5 ? 'HOTEL!' : 'BUILT', '#7ee787', 20);
      fx.shake(5);
      log(`You build on ${SPACES[i].short} (${g.props[i].houses === 5 ? 'HOTEL' : g.props[i].houses + 'h'}).`, '#7ee787');
      sync();
    },
    [log, sync],
  );

  const sellHouse = useCallback(
    (i: number) => {
      const g = G.current;
      if (!canSellHouse(g, i)) return;
      g.props[i].houses--;
      g.players[0].cash += SPACES[i].houseCost! / 2;
      log(`You sell a building on ${SPACES[i].short}.`, '#ffd166');
      sync();
    },
    [log, sync],
  );

  const mortgage = useCallback(
    (i: number) => {
      const g = G.current;
      if (!canMortgage(g, i)) return;
      g.props[i].mortgaged = true;
      g.players[0].cash += SPACES[i].price! / 2;
      log(`You mortgage ${SPACES[i].short} for ${money(SPACES[i].price! / 2)}.`, '#ffd166');
      sync();
    },
    [log, sync],
  );

  const unmortgage = useCallback(
    (i: number) => {
      const g = G.current;
      const st = g.props[i];
      const cost = Math.round((SPACES[i].price! / 2) * 1.1);
      if (!st.mortgaged || st.owner !== 0 || g.players[0].cash < cost) return;
      st.mortgaged = false;
      g.players[0].cash -= cost;
      log(`You lift the mortgage on ${SPACES[i].short} for ${money(cost)}.`, '#7ee787');
      sync();
    },
    [log, sync],
  );

  /* ---------------- trading ---------------- */
  function stratWorth(props: Game['props'], pid: number): number {
    let v = 0;
    for (const sp of SPACES) {
      if (!sp.price) continue;
      const st = props[sp.i];
      if (st.owner !== pid) continue;
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

  /** human offers: `give` (human -> rival), `get` (rival -> human), cash > 0 = human pays rival */
  const proposeTrade = useCallback(
    (rival: number, give: number[], get: number[], cash: number): { ok: boolean; msg: string } => {
      const g = G.current;
      const me = g.players[0];
      const ai = g.players[rival];
      if (!give.length && !get.length) return { ok: false, msg: 'Offer something first.' };
      if (cash > 0 && me.cash < cash) return { ok: false, msg: "You don't have that cash." };
      if (cash < 0 && ai.cash < -cash) return { ok: false, msg: `${ai.name} can't pay that much.` };
      if ([...give, ...get].some((i) => g.props[i].houses > 0))
        return { ok: false, msg: 'Sell buildings before trading that set.' };

      const before = stratWorth(g.props, rival);
      const hBefore = stratWorth(g.props, 0);
      const sim: Game['props'] = {};
      for (const k of Object.keys(g.props)) sim[+k] = { ...g.props[+k] };
      give.forEach((i) => (sim[i].owner = rival));
      get.forEach((i) => (sim[i].owner = 0));
      const aiDelta = stratWorth(sim, rival) - before + cash;
      const hDelta = stratWorth(sim, 0) - hBefore - cash;

      const accepted = aiDelta > 20 && aiDelta >= hDelta * 0.75;
      if (!accepted) {
        log(`${ai.name} rejects your offer.`, '#ff8f8f');
        sfx.pay();
        fx.shake(6);
        sync();
        return { ok: false, msg: `${ai.name} says: "Not a chance."` };
      }
      give.forEach((i) => (g.props[i].owner = rival));
      get.forEach((i) => (g.props[i].owner = 0));
      me.cash -= cash;
      ai.cash += cash;
      log(
        `🤝 Trade with ${ai.name}: you give ${give.map((i) => SPACES[i].short).join(', ') || '—'}${
          cash > 0 ? ` + ${money(cash)}` : ''
        } for ${get.map((i) => SPACES[i].short).join(', ') || '—'}${cash < 0 ? ` + ${money(-cash)}` : ''}.`,
        '#e9c46a',
      );
      sfx.buy();
      fx.flash('233,196,106', 0.2);
      fx.shake(8);
      [...give, ...get].forEach((i) => {
        const c = atSpace(i);
        fx.confetti(c.x, c.y);
      });
      sync();
      return { ok: true, msg: `${ai.name} accepts the deal!` };
    },
    [log, sync],
  );

  useEffect(() => {
    return () => {
      gen.current++;
    };
  }, []);

  return {
    g: G.current,
    sync,
    respond,
    start,
    toMenu,
    togglePause,
    setSpeed,
    speed: speed.current,
    build,
    sellHouse,
    mortgage,
    unmortgage,
    proposeTrade,
    scores,
    lastScore,
    paused: paused.current,
  };
}
