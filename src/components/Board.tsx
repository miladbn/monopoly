import { memo, useEffect, useRef, useState } from 'react';
import { GROUP_COLORS, SPACES, Space, cellCenterPx, edgeOf, gridPos } from '../game/data';
import { Game } from '../game/engine';

const ICONS: Record<string, string> = {
  go: '→',
  jail: '🔒',
  parking: '🅿️',
  gotojail: '🚔',
  chance: '❓',
  chest: '🎁',
  rr: '🚂',
};

function tileIcon(sp: Space) {
  if (sp.type === 'util') return sp.i === 12 ? '💡' : '🚰';
  if (sp.type === 'tax') return '💸';
  return ICONS[sp.type] || '';
}

interface TileProps {
  sp: Space;
  owner: number | null;
  ownerColor?: string;
  houses: number;
  mortgaged: boolean;
  highlight: boolean;
  onClick: (i: number) => void;
  small: boolean;
}

const Tile = memo(function Tile({ sp, owner, ownerColor, houses, mortgaged, highlight, onClick, small }: TileProps) {
  const { row, col } = gridPos(sp.i);
  const edge = edgeOf(sp.i);
  const corner = edge === 'corner';
  const color = sp.group ? GROUP_COLORS[sp.group] : undefined;
  const barPos =
    edge === 'bottom'
      ? 'top-0 left-0 right-0 h-[24%]'
      : edge === 'left'
        ? 'top-0 bottom-0 right-0 w-[26%]'
        : edge === 'top'
          ? 'bottom-0 left-0 right-0 h-[24%]'
          : 'top-0 bottom-0 left-0 w-[26%]';
  const pad =
    edge === 'bottom' ? 'pt-[24%]' : edge === 'left' ? 'pr-[26%]' : edge === 'top' ? 'pb-[24%]' : 'pl-[26%]';

  return (
    <button
      data-space={sp.i}
      onClick={() => onClick(sp.i)}
      style={{
        gridRow: row,
        gridColumn: col,
        boxShadow: owner !== null ? `inset 0 0 0 2px ${ownerColor}, 0 0 14px -4px ${ownerColor}` : undefined,
        background: highlight ? 'linear-gradient(180deg,#2b3a63,#1b2644)' : undefined,
      }}
      className={`tile relative flex items-center justify-center overflow-hidden rounded-[3px] transition-[box-shadow,background] duration-200 ${
        highlight ? 'z-10 ring-1 ring-amber-300/70' : ''
      }`}
    >
      {color && (
        <div
          className={`absolute ${barPos} flex items-center justify-center gap-[1px] border-black/40`}
          style={{ background: color, boxShadow: 'inset 0 -2px 6px rgba(0,0,0,.35)' }}
        >
          {houses > 0 &&
            (houses === 5 ? (
              <div className="h-[55%] w-[34%] rounded-[1px] bg-red-600 shadow-[0_0_6px_#ff000099]" />
            ) : (
              Array.from({ length: houses }).map((_, k) => (
                <div key={k} className="h-[42%] w-[16%] rounded-[1px] bg-emerald-400 shadow-[0_0_4px_#34d39999]" />
              ))
            ))}
        </div>
      )}
      <div className={`relative flex h-full w-full flex-col items-center justify-center px-[2px] ${color ? pad : ''}`}>
        {corner ? (
          <>
            <div className="text-[clamp(10px,2.4vmin,20px)] leading-none">{tileIcon(sp)}</div>
            <div className="deco mt-[2px] text-center text-[clamp(5px,1.05vmin,11px)] font-semibold uppercase leading-[1.05] text-amber-100/90">
              {sp.short}
            </div>
          </>
        ) : (
          <>
            {!color && <div className="text-[clamp(7px,1.5vmin,14px)] leading-none">{tileIcon(sp)}</div>}
            {!small && (
              <div className="deco text-center text-[clamp(4px,0.92vmin,10px)] font-medium uppercase leading-[1.04] text-slate-200/90">
                {sp.short}
              </div>
            )}
            {sp.price && (
              <div className="text-[clamp(4px,0.85vmin,9px)] font-bold leading-none text-amber-200/80">${sp.price}</div>
            )}
            {sp.tax && <div className="text-[clamp(4px,0.85vmin,9px)] font-bold text-rose-300/90">${sp.tax}</div>}
          </>
        )}
      </div>
      {mortgaged && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/55">
          <span className="deco text-[clamp(6px,1.3vmin,13px)] font-bold text-rose-300">MTG</span>
        </div>
      )}
    </button>
  );
});

export default function Board({
  g,
  onTile,
  onCenter,
  children,
}: {
  g: Game;
  onTile: (i: number) => void;
  onCenter?: () => void;
  children?: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(600);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const tokenSize = Math.max(12, Math.min(30, w / 26));
  const spread = tokenSize * 0.42;
  const current = g.players[g.turn];

  return (
    <div
      ref={ref}
      className="relative aspect-square w-full select-none rounded-xl p-[3px]"
      style={{
        background:
          'radial-gradient(circle at 50% 40%, #17233f 0%, #0c1324 60%, #080d1a 100%)',
        border: '1px solid rgba(233,196,106,.25)',
        boxShadow: '0 20px 60px rgba(0,0,0,.6), inset 0 0 60px rgba(0,0,0,.6)',
      }}
    >
      <div
        className="grid h-full w-full gap-[2px]"
        style={{ gridTemplateColumns: '2fr repeat(9,1fr) 2fr', gridTemplateRows: '2fr repeat(9,1fr) 2fr' }}
      >
        {SPACES.map((sp) => {
          const st = g.props[sp.i];
          const ownerId = st ? st.owner : null;
          return (
            <Tile
              key={sp.i}
              sp={sp}
              owner={ownerId}
              ownerColor={ownerId !== null ? g.players[ownerId].color : undefined}
              houses={st ? st.houses : 0}
              mortgaged={!!st && st.mortgaged}
              highlight={!!current && current.pos === sp.i}
              onClick={onTile}
              small={w < 380}
            />
          );
        })}

        {/* center */}
        <div
          onClick={onCenter}
          className="relative flex cursor-pointer flex-col items-center justify-center overflow-hidden rounded-lg"
          style={{ gridRow: '2 / 11', gridColumn: '2 / 11' }}
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-70"
            style={{
              background:
                'repeating-linear-gradient(135deg, rgba(233,196,106,.045) 0 10px, transparent 10px 20px)',
            }}
          />
          {children}
        </div>
      </div>

      {/* tokens */}
      {g.players.map((p, idx) => {
        if (p.bankrupt) return null;
        const c = cellCenterPx(p.pos, w);
        const dx = (idx % 2 === 0 ? -1 : 1) * spread;
        const dy = (idx < 2 ? -1 : 1) * spread;
        return (
          <div
            key={p.id}
            id={`tok-${p.id}`}
            className="pointer-events-none absolute z-20 flex items-center justify-center rounded-full"
            style={{
              left: c.x,
              top: c.y,
              width: tokenSize,
              height: tokenSize,
              marginLeft: dx - tokenSize / 2,
              marginTop: dy - tokenSize / 2,
              fontSize: tokenSize * 0.62,
              background: `radial-gradient(circle at 35% 30%, #ffffff33, ${p.color}dd)`,
              boxShadow: `0 0 0 2px ${p.color}, 0 4px 10px rgba(0,0,0,.6)${
                g.turn === p.id ? `, 0 0 16px 2px ${p.color}` : ''
              }`,
              transition: 'left .16s linear, top .16s linear, box-shadow .2s ease',
            }}
          >
            <span style={{ filter: p.inJail ? 'grayscale(1)' : undefined }}>{p.token}</span>
          </div>
        );
      })}
    </div>
  );
}
