import { GROUP_COLORS, SPACES } from '../game/data';
import { Game, canBuild, canMortgage, canSellHouse, money, netWorth, playerProps } from '../game/engine';

const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

export function Die({ v, rolling, size = 44 }: { v: number; rolling: boolean; size?: number }) {
  return (
    <div
      className={`relative grid grid-cols-3 grid-rows-3 rounded-[22%] p-[12%] ${rolling ? 'dice-spin' : ''}`}
      style={{
        width: size,
        height: size,
        background: 'linear-gradient(145deg,#fffdf5,#e4dcc6)',
        boxShadow: '0 4px 12px rgba(0,0,0,.55), inset 0 -3px 6px rgba(0,0,0,.18)',
      }}
    >
      {Array.from({ length: 9 }).map((_, i) => (
        <div key={i} className="flex items-center justify-center">
          {PIPS[v]?.includes(i) && (
            <div className="rounded-full bg-[#1b1c22]" style={{ width: size * 0.15, height: size * 0.15 }} />
          )}
        </div>
      ))}
    </div>
  );
}

export function CenterPiece({ g, meId = 0 }: { g: Game; meId?: number }) {
  const cur = g.players[g.turn];
  const total = g.dice[0] + g.dice[1];
  const mine = cur?.id === meId;
  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center gap-[3%] px-3 text-center">
      <div className="deco text-[clamp(14px,3.6vmin,38px)] font-bold leading-none gold-text">DECO CITY</div>
      <div className="deco text-[clamp(6px,1.1vmin,11px)] tracking-[0.42em] text-amber-200/50">TYCOON EDITION</div>
      <div id="dice-box" className="my-[2%] flex items-center gap-[4%]">
        <Die v={g.dice[0]} rolling={g.rolling} size={Math.min(52, Math.max(26, window.innerWidth / 16))} />
        <Die v={g.dice[1]} rolling={g.rolling} size={Math.min(52, Math.max(26, window.innerWidth / 16))} />
      </div>
      {!g.rolling && (
        <div className="deco text-[clamp(9px,1.6vmin,16px)] font-bold text-amber-200/80">
          {total} {g.dice[0] === g.dice[1] ? '• DOUBLES' : ''}
        </div>
      )}
      <div
        className="mt-[2%] flex items-center gap-2 rounded-full px-3 py-1 text-[clamp(8px,1.4vmin,14px)] font-semibold"
        style={{ background: `${cur.color}22`, boxShadow: `inset 0 0 0 1px ${cur.color}66` }}
      >
        <span>{cur.token}</span>
        <span style={{ color: cur.color }}>{mine ? 'Your turn' : `${cur.name} playing…`}</span>
      </div>
      <div className="deco text-[clamp(7px,1.2vmin,12px)] tracking-widest text-slate-400/70">ROUND {g.round}</div>
    </div>
  );
}

export function PlayerCard({ g, pid, active }: { g: Game; pid: number; active: boolean }) {
  const p = g.players[pid];
  const props = playerProps(g, pid);
  const groups: Record<string, number> = {};
  props.forEach((i) => {
    const gr = SPACES[i].group!;
    groups[gr] = (groups[gr] || 0) + 1;
  });
  return (
    <div
      className={`relative rounded-lg px-2 py-1.5 transition-all duration-200 ${p.bankrupt ? 'opacity-40 grayscale' : ''}`}
      style={{
        background: active ? `linear-gradient(90deg, ${p.color}26, transparent)` : 'rgba(255,255,255,.03)',
        boxShadow: active ? `inset 0 0 0 1px ${p.color}aa` : 'inset 0 0 0 1px rgba(255,255,255,.06)',
      }}
    >
      <div className="flex items-center gap-2">
        <div
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm"
          style={{ background: `${p.color}33`, boxShadow: `0 0 0 1.5px ${p.color}` }}
        >
          {p.token}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-1">
            <span className="truncate text-[12px] font-bold" style={{ color: p.color }}>
              {p.name}
              {p.inJail && <span className="ml-1 text-[9px] text-orange-300">🔒JAIL</span>}
              {p.getOut > 0 && <span className="ml-1 text-[9px] text-amber-300">🎟️{p.getOut}</span>}
            </span>
            <span className="shrink-0 text-[12px] font-extrabold tabular-nums text-emerald-300">{money(p.cash)}</span>
          </div>
          <div className="flex items-center justify-between gap-1">
            <div className="flex flex-wrap items-center gap-[2px]">
              {Object.entries(groups).map(([gr, n]) => (
                <span
                  key={gr}
                  className="rounded-[2px] px-1 text-[8px] font-bold text-black/80"
                  style={{ background: GROUP_COLORS[gr] }}
                >
                  {n}
                </span>
              ))}
              {!props.length && <span className="text-[9px] text-slate-500">no deeds</span>}
            </div>
            <span className="text-[9px] tabular-nums text-slate-400">net {money(netWorth(g, pid))}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function LogPanel({ g }: { g: Game }) {
  return (
    <div className="scroll flex-1 space-y-1 overflow-y-auto pr-1 text-[11px] leading-snug">
      {g.log.map((l, idx) => (
        <div
          key={l.id}
          className={idx === 0 ? 'slide-up' : ''}
          style={{ color: l.color || '#93a3c4', opacity: idx > 6 ? 0.45 : 1 }}
        >
          {l.text}
        </div>
      ))}
    </div>
  );
}

export function DeedList({
  g,
  onBuild,
  onSell,
  onMortgage,
  onUnmortgage,
  onInspect,
  meId = 0,
}: {
  g: Game;
  onBuild: (i: number) => void;
  onSell: (i: number) => void;
  onMortgage: (i: number) => void;
  onUnmortgage: (i: number) => void;
  onInspect: (i: number) => void;
  meId?: number;
}) {
  const mine = playerProps(g, meId);
  if (!mine.length)
    return <div className="py-4 text-center text-[11px] text-slate-500">You own no deeds yet. Land & buy!</div>;
  return (
    <div className="scroll max-h-full space-y-1 overflow-y-auto pr-1">
      {mine.map((i) => {
        const sp = SPACES[i];
        const st = g.props[i];
        const unmCost = Math.round((sp.price! / 2) * 1.1);
        return (
          <div key={i} className="flex items-center gap-1.5 rounded-md bg-white/[0.04] px-1.5 py-1">
            <span className="h-5 w-1.5 shrink-0 rounded-sm" style={{ background: GROUP_COLORS[sp.group!] }} />
            <button onClick={() => onInspect(i)} className="min-w-0 flex-1 text-left">
              <div className="truncate text-[11px] font-semibold text-slate-200">{sp.short}</div>
              <div className="text-[9px] text-slate-400">
                {st.mortgaged ? 'MORTGAGED' : st.houses === 5 ? '🏨 Hotel' : st.houses > 0 ? '🏠'.repeat(st.houses) : 'undeveloped'}
              </div>
            </button>
            {sp.type === 'prop' && (
              <>
                <button
                  className="btn btn-green h-6 w-6 text-[13px] leading-none disabled:opacity-25"
                  disabled={!canBuild(g, i)}
                  onClick={() => onBuild(i)}
                  title={`Build ($${sp.houseCost})`}
                >
                  +
                </button>
                <button
                  className="btn btn-dark h-6 w-6 text-[13px] leading-none disabled:opacity-25"
                  disabled={!canSellHouse(g, i)}
                  onClick={() => onSell(i)}
                  title="Sell building"
                >
                  −
                </button>
              </>
            )}
            {st.mortgaged ? (
              <button
                className="btn btn-gold h-6 px-1.5 text-[9px] disabled:opacity-25"
                disabled={g.players[meId].cash < unmCost}
                onClick={() => onUnmortgage(i)}
                title={`Unmortgage $${unmCost}`}
              >
                LIFT
              </button>
            ) : (
              <button
                className="btn btn-dark h-6 px-1.5 text-[9px] disabled:opacity-25"
                disabled={!canMortgage(g, i)}
                onClick={() => onMortgage(i)}
                title={`Mortgage $${sp.price! / 2}`}
              >
                MTG
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
