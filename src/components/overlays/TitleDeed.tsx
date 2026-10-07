import { GROUP_COLORS, SPACES } from '../../game/data';
import { Game, money, rentFor } from '../../game/engine';

export function TitleDeed({ g, i }: { g: Game; i: number }) {
  const sp = SPACES[i];
  const st = g.props[i];
  const color = sp.group ? GROUP_COLORS[sp.group] : '#8fa3c8';
  const owner = st?.owner !== null && st?.owner !== undefined ? g.players[st.owner] : null;
  return (
    <div className="w-full overflow-hidden rounded-lg bg-[#f4efe4] text-[#1a2018] shadow-2xl">
      <div className="px-3 py-2.5 text-center" style={{ background: color }}>
        <div className="text-[10px] font-semibold tracking-wide text-black/55">Title deed</div>
        <div className="deco text-lg font-bold leading-tight text-black/90">{sp.name}</div>
      </div>
      <div className="space-y-0.5 px-4 py-3 text-[12px]">
        {sp.type === 'prop' && (
          <>
            <Row l="Rent" r={money(sp.rents![0])} />
            <Row l="With colour set" r={money(sp.rents![0] * 2)} />
            {[1, 2, 3, 4].map((h) => (
              <Row key={h} l={`With ${h} house${h > 1 ? 's' : ''}`} r={money(sp.rents![h])} />
            ))}
            <Row l="With hotel" r={money(sp.rents![5])} bold />
            <div className="my-1 border-t border-black/15" />
            <Row l="House cost" r={`${money(sp.houseCost!)} each`} />
            <Row l="Hotel cost" r={`${money(sp.houseCost!)} + 4 houses`} />
          </>
        )}
        {sp.type === 'rr' && (
          <>
            <Row l="1 railroad" r="$25" />
            <Row l="2 railroads" r="$50" />
            <Row l="3 railroads" r="$100" />
            <Row l="4 railroads" r="$200" bold />
          </>
        )}
        {sp.type === 'util' && (
          <>
            <Row l="1 utility" r="4 × dice roll" />
            <Row l="2 utilities" r="10 × dice roll" bold />
          </>
        )}
        <div className="my-1 border-t border-black/15" />
        <Row l="Mortgage value" r={money(sp.price! / 2)} />
        <Row l="Price" r={money(sp.price!)} bold />
        {owner && (
          <div className="mt-2 rounded-md px-2 py-1 text-center text-[11px] font-semibold" style={{ background: `${owner.color}33` }}>
            Owned by {owner.name}
            {st.houses > 0 && ` · ${st.houses === 5 ? 'hotel' : `${st.houses} house${st.houses > 1 ? 's' : ''}`}`}
            {st.mortgaged && ' · mortgaged'}
            {!st.mortgaged && <> · rent {money(rentFor(g, i, 7))}</>}
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ l, r, bold }: { l: string; r: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 ${bold ? 'font-extrabold' : ''}`}>
      <span className="opacity-75">{l}</span>
      <span className="tabular-nums">{r}</span>
    </div>
  );
}
