import { useEffect, useState } from 'react';
import {
  inviteUrl,
  roomCodeFromInput,
  type PlayerAppearance,
  type PublicRoom,
} from '../telegram/api';
import { loadPlayerProfile, savePlayerProfile } from '../game/playerProfile';
import { getWebApp } from '../telegram/webapp';
import PlayerAppearancePicker from './PlayerAppearancePicker';
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
  onAppearance,
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
  onAppearance?: (appearance: PlayerAppearance) => void;
}) {
  const [code, setCode] = useState('');
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);
  const [appearance, setAppearance] = useState(loadPlayerProfile);

  useEffect(() => {
    if (!room) return;
    const me = room.players.find((p) => p.telegramId === getWebApp()?.initDataUnsafe?.user?.id);
    if (me?.pieceToken && me?.pieceColor) {
      setAppearance({ token: me.pieceToken, color: me.pieceColor });
    }
  }, [room?.id, room?.version]);

  const setLook = (next: PlayerAppearance) => {
    setAppearance(next);
    savePlayerProfile(next);
    onAppearance?.(next);
  };

  if (!room) {
    return (
      <Modal dim={0.9}>
        <div className="popin panel step-frame scroll relative max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-xl p-4 sm:p-6">
          <div className="sunburst" aria-hidden />
          <div className="relative text-center">
            <h1 className="deco brand-in text-3xl font-bold gold-text">Lobby</h1>
            <p className="mt-2 text-[13px] text-[var(--mist)]">Pick your look, then create or join a room.</p>
          </div>
          {error && (
            <div className="relative mt-4 rounded-lg bg-[var(--wine)]/25 px-3 py-2 text-[12px] text-[#f0b4bb]">{error}</div>
          )}
          <div className="relative mt-4">
            <PlayerAppearancePicker value={appearance} onChange={setLook} compact />
          </div>
          <div className="relative mt-5 space-y-2">
            <button type="button" disabled={busy} onClick={onCreate} className="btn btn-gold w-full py-3.5 text-base">
              {busy ? 'Creating…' : 'Create room'}
            </button>
            <div className="flex gap-2">
              <input
                value={code}
                onChange={(e) => setCode(roomCodeFromInput(e.target.value))}
                placeholder="Room code"
                inputMode="text"
                autoCapitalize="characters"
                spellCheck={false}
                aria-label="Room code"
                className="field flex-1 tracking-[0.18em]"
              />
              <button
                type="button"
                disabled={busy || code.length < 4}
                onClick={() => onJoin(code)}
                className="btn btn-dark min-w-[72px] px-4"
              >
                Join
              </button>
            </div>
            <button type="button" onClick={onLeave} className="btn btn-dark w-full py-3 text-sm">
              Back to solo
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  const copy = async (kind: 'code' | 'link') => {
    const text = kind === 'code' ? room.id : inviteUrl(room.id);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const el = document.createElement('textarea');
      el.value = text;
      el.setAttribute('readonly', '');
      el.style.position = 'fixed';
      el.style.left = '-9999px';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      el.remove();
    }
    setCopied(kind);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <Modal dim={0.9}>
      <div className="popin panel scroll max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-xl p-4 sm:p-6">
        <div className="text-center">
          <h1 className="deco text-3xl font-bold gold-text">Room {room.id}</h1>
          <p className="mt-2 text-[13px] text-[var(--mist)]">
            {room.players.length}/{room.maxPlayers} players · empty seats fill with AI
          </p>
        </div>

        {error && (
          <div className="mt-4 rounded-lg bg-[var(--wine)]/25 px-3 py-2 text-[12px] text-[#f0b4bb]">{error}</div>
        )}

        <div className="mt-4 space-y-1.5">
          {room.players.map((p) => (
            <div key={p.telegramId} className="flex items-center gap-2 rounded-lg bg-black/25 px-3 py-2.5 text-sm">
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-base"
                style={{
                  background: `${p.pieceColor || '#c9a84c'}33`,
                  boxShadow: `0 0 0 1.5px ${p.pieceColor || '#c9a84c'}`,
                }}
                aria-hidden
              >
                {p.pieceToken || '🎩'}
              </span>
              <span className="min-w-0 flex-1 truncate font-semibold">
                {p.name}
                {p.telegramId === room.hostTelegramId ? (
                  <span className="ml-1.5 text-[11px] font-medium text-[var(--brass)]">host</span>
                ) : null}
              </span>
              <span className={`text-[12px] font-semibold ${p.ready ? 'text-emerald-300/90' : 'text-[var(--mist)]'}`}>
                {p.ready ? 'Ready' : 'Waiting'}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-4 border-t border-[var(--brass)]/15 pt-4">
          <PlayerAppearancePicker value={appearance} onChange={setLook} compact />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" onClick={() => void copy('code')} className="btn btn-dark py-3 text-sm">
            {copied === 'code' ? 'Copied' : 'Copy code'}
          </button>
          <button type="button" onClick={() => void copy('link')} className="btn btn-dark py-3 text-sm">
            {copied === 'link' ? 'Copied' : 'Copy link'}
          </button>
        </div>
        <button
          type="button"
          onClick={() => onReady(!meReady)}
          className={`btn mt-2 w-full py-3 text-sm ${meReady ? 'btn-dark' : 'btn-gold'}`}
        >
          {meReady ? 'Not ready' : 'Ready up'}
        </button>

        {isHost && (
          <button type="button" disabled={busy} onClick={onStart} className="btn btn-gold pulse-glow mt-3 w-full py-3.5 text-base">
            {busy ? 'Starting…' : 'Start game'}
          </button>
        )}

        <button type="button" onClick={onLeave} className="btn btn-dark mt-2 w-full py-3 text-sm">
          Leave room
        </button>
      </div>
    </Modal>
  );
}
