import { useState } from 'react';
import { inviteUrl, type PublicRoom } from '../telegram/api';
import { Modal } from './Overlays';

export default function LobbyOverlay({
  room,
  busy,
  error,
  isHost,
  meReady,
  onReady,
  onStart,
  onLeave,
  onCreate,
  onJoin,
}: {
  room: PublicRoom | null;
  busy: boolean;
  error: string | null;
  isHost: boolean;
  meReady: boolean;
  onReady: (v: boolean) => void;
  onStart: () => void;
  onLeave: () => void;
  onCreate: () => void;
  onJoin: (code: string) => void;
}) {
  const [code, setCode] = useState('');
  const [copied, setCopied] = useState(false);

  if (!room) {
    return (
      <Modal dim={0.9}>
        <div className="popin panel w-full max-w-md rounded-2xl p-5">
          <div className="text-center">
            <div className="deco text-3xl font-bold gold-text">TELEGRAM LOBBY</div>
            <div className="mt-1 text-[11px] tracking-widest text-amber-200/50">PLAY WITH FRIENDS</div>
          </div>
          {error && <div className="mt-3 rounded-lg bg-red-500/15 px-3 py-2 text-[12px] text-red-200">{error}</div>}
          <div className="mt-5 space-y-2">
            <button disabled={busy} onClick={onCreate} className="btn btn-gold w-full py-3 deco">
              {busy ? '…' : 'CREATE ROOM'}
            </button>
            <div className="flex gap-2">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 8))}
                placeholder="ROOM CODE"
                className="flex-1 rounded-lg border border-amber-300/20 bg-black/40 px-3 py-2 text-sm tracking-widest text-amber-50 outline-none"
              />
              <button disabled={busy || code.length < 4} onClick={() => onJoin(code)} className="btn btn-dark px-4">
                JOIN
              </button>
            </div>
            <button onClick={onLeave} className="btn btn-dark w-full py-2 text-xs">
              BACK / SOLO
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl(room.id));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  return (
    <Modal dim={0.9}>
      <div className="popin panel w-full max-w-md rounded-2xl p-5">
        <div className="text-center">
          <div className="deco text-3xl font-bold gold-text">ROOM {room.id}</div>
          <div className="mt-1 text-[11px] text-slate-400">
            {room.players.length}/{room.maxPlayers} players · AI fills empty seats
          </div>
        </div>

        {error && <div className="mt-3 rounded-lg bg-red-500/15 px-3 py-2 text-[12px] text-red-200">{error}</div>}

        <div className="mt-4 space-y-1.5">
          {room.players.map((p) => (
            <div key={p.telegramId} className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-sm">
              <span className="flex-1 truncate font-semibold">
                {p.name}
                {p.telegramId === room.hostTelegramId ? ' · host' : ''}
              </span>
              <span className={p.ready ? 'text-emerald-300' : 'text-slate-500'}>{p.ready ? 'READY' : '…'}</span>
            </div>
          ))}
        </div>

        <div className="mt-4 flex gap-2">
          <button onClick={copy} className="btn btn-dark flex-1 py-2 text-xs">
            {copied ? 'COPIED' : 'COPY INVITE'}
          </button>
          <button onClick={() => onReady(!meReady)} className={`btn flex-1 py-2 text-xs ${meReady ? 'btn-dark' : 'btn-gold'}`}>
            {meReady ? 'UNREADY' : 'READY'}
          </button>
        </div>

        {isHost && (
          <button disabled={busy} onClick={onStart} className="btn btn-gold pulse-glow mt-3 w-full py-3 deco">
            {busy ? 'STARTING…' : 'START GAME'}
          </button>
        )}

        <button onClick={onLeave} className="btn btn-dark mt-2 w-full py-2 text-xs">
          LEAVE
        </button>
      </div>
    </Modal>
  );
}
