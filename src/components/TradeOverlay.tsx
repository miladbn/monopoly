import { useState } from 'react';
import { GROUP_COLORS, SPACES } from '../game/data';
import { Game, money, playerProps } from '../game/engine';
import { Modal } from './Overlays';

export default function TradeOverlay({
  g,
  onClose,
  onOffer,
}: {
  g: Game;
  onClose: () => void;
  onOffer: (rival: number, give: number[], get: number[], cash: number) => { ok: boolean; msg: string };
}) {
  const rivals = g.players.filter((p) => p.id !== 0 && !p.bankrupt);
  const [rival, setRival] = useState(rivals[0]?.id ?? 1);
  const [give, setGive] = useState<number[]>([]);
  const [get, setGet] = useState<number[]>([]);
  const [cash, setCash] = useState(0);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const mine = playerProps(g, 0);
  const theirs = playerProps(g, rival);

  const toggle = (list: number[], set: (v: number[]) => void, i: number) => {
    setMsg(null);
    set(list.includes(i) ? list.filter((x) => x !== i) : [...list, i]);
  };

  const chip = (i: number, selected: boolean, onClick: () => void) => {
    const sp = SPACES[i];
    const blocked = g.props[i].houses > 0;
    return (
      <button
        key={i}
        disabled={blocked}
        onClick={onClick}
        className={`flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-[11px] transition-colors ${
          selected ? 'bg-amber-300/25 ring-1 ring-amber-300/70' : 'bg-white/5'
        } ${blocked ? 'opacity-35' : ''}`}
      >
        <span className="h-4 w-1.5 shrink-0 rounded-sm" style={{ background: GROUP_COLORS[sp.group!] }} />
        <span className="flex-1 truncate">{sp.short}</span>
        <span className="text-[9px] text-slate-400">${sp.price}</span>
      </button>
    );
  };

  const submit = () => {
    const r = onOffer(rival, give, get, cash);
    setMsg({ ok: r.ok, text: r.msg });
    if (r.ok) {
      setGive([]);
      setGet([]);
      setCash(0);
      setTimeout(onClose, 900);
    }
  };

  const maxPay = g.players[0].cash;
  const maxRecv = g.players[rival]?.cash ?? 0;

  return (
    <Modal z={47} dim={0.75}>
      <div className="popin panel scroll flex max-h-full w-full max-w-md flex-col gap-2 overflow-y-auto rounded-2xl p-3">
        <div className="deco text-center text-lg tracking-[0.25em] gold-text">🤝 TRADE DESK</div>

        <div className="flex gap-1">
          {rivals.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                setRival(p.id);
                setGet([]);
                setMsg(null);
              }}
              className={`btn flex-1 py-1.5 text-[11px] ${rival === p.id ? 'btn-gold' : 'btn-dark'}`}
            >
              {p.token} {p.name}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="mb-1 text-[9px] font-bold uppercase tracking-widest text-slate-400">You give</div>
            <div className="scroll max-h-40 space-y-1 overflow-y-auto pr-1">
              {mine.length ? mine.map((i) => chip(i, give.includes(i), () => toggle(give, setGive, i))) : (
                <div className="text-[10px] text-slate-500">no deeds</div>
              )}
            </div>
          </div>
          <div>
            <div className="mb-1 text-[9px] font-bold uppercase tracking-widest text-slate-400">You get</div>
            <div className="scroll max-h-40 space-y-1 overflow-y-auto pr-1">
              {theirs.length ? theirs.map((i) => chip(i, get.includes(i), () => toggle(get, setGet, i))) : (
                <div className="text-[10px] text-slate-500">no deeds</div>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-black/30 p-2">
          <div className="flex items-center justify-between text-[10px] text-slate-400">
            <span>They pay you</span>
            <span className="text-[12px] font-bold text-amber-200">
              {cash === 0 ? 'no cash' : cash > 0 ? `You pay ${money(cash)}` : `You receive ${money(-cash)}`}
            </span>
            <span>You pay</span>
          </div>
          <input
            type="range"
            min={-maxRecv}
            max={maxPay}
            step={25}
            value={cash}
            onChange={(e) => {
              setCash(+e.target.value);
              setMsg(null);
            }}
            className="mt-1 w-full accent-amber-400"
          />
          <div className="flex justify-center gap-1">
            {[-200, -50, 0, 50, 200].map((d) => (
              <button
                key={d}
                onClick={() => setCash((c) => Math.max(-maxRecv, Math.min(maxPay, d === 0 ? 0 : c + d)))}
                className="btn btn-dark px-2 py-0.5 text-[10px]"
              >
                {d === 0 ? 'reset' : d > 0 ? `+${d}` : d}
              </button>
            ))}
          </div>
        </div>

        {msg && (
          <div className={`text-center text-[12px] font-bold ${msg.ok ? 'text-emerald-300' : 'text-rose-300'}`}>{msg.text}</div>
        )}

        <div className="flex gap-2">
          <button onClick={submit} className="btn btn-gold flex-1 py-2.5 text-sm">OFFER DEAL</button>
          <button onClick={onClose} className="btn btn-dark flex-1 py-2.5 text-sm">CLOSE</button>
        </div>
      </div>
    </Modal>
  );
}
