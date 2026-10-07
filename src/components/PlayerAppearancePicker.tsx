import { useState } from 'react';
import {
  ACHIEVEMENTS,
  getEquippedTitle,
  isUnlocked,
  listUnlocked,
  setEquippedTitle,
  titleLabel,
} from '../game/achievements';
import {
  COLOR_CHOICES,
  TOKEN_CHOICES,
  type PlayerAppearance,
} from '../game/playerProfile';

export default function PlayerAppearancePicker({
  value,
  onChange,
  compact,
}: {
  value: PlayerAppearance;
  onChange: (next: PlayerAppearance) => void;
  compact?: boolean;
}) {
  const unlocked = listUnlocked();
  const [equipped, setEquipped] = useState(() => getEquippedTitle());
  const equip = (id: string | null) => {
    setEquippedTitle(id);
    setEquipped(id);
  };
  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      <div className="flex items-center gap-2.5">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg sm:h-12 sm:w-12"
          style={{
            background: `${value.color}33`,
            boxShadow: `0 0 0 2px ${value.color}`,
          }}
          aria-hidden
        >
          {value.token}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[12px] font-medium text-[var(--mist)]">Your look</div>
          <p className="text-[11px] leading-snug text-[var(--mist)]/75">Pick a token and color for the board.</p>
        </div>
      </div>

      <div className="grid grid-cols-6 gap-1" role="listbox" aria-label="Game token">
        {TOKEN_CHOICES.map((token) => {
          const on = value.token === token;
          return (
            <button
              key={token}
              type="button"
              role="option"
              aria-selected={on}
              onClick={() => onChange({ ...value, token })}
              className={`flex aspect-square min-h-[40px] items-center justify-center rounded-lg text-lg transition-all sm:min-h-[44px] sm:text-xl ${
                on
                  ? 'bg-[var(--brass)]/25 ring-2 ring-[var(--brass)]'
                  : 'bg-black/25 hover:bg-black/35'
              }`}
            >
              <span aria-hidden>{token}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-1.5 sm:gap-2" role="listbox" aria-label="Player color">
        {COLOR_CHOICES.map((color) => {
          const on = value.color === color;
          return (
            <button
              key={color}
              type="button"
              role="option"
              aria-selected={on}
              onClick={() => onChange({ ...value, color })}
              className={`h-8 w-8 rounded-full transition-transform sm:h-10 sm:w-10 ${
                on ? 'scale-110 ring-2 ring-[var(--ivory)] ring-offset-1 ring-offset-[#0a1412] sm:ring-offset-2' : ''
              }`}
              style={{ background: color }}
              title="Color"
            />
          );
        })}
      </div>

      {unlocked.length > 0 && (
        <div>
          <div className="mb-1 text-[11px] font-medium text-[var(--mist)]">
            Title{equipped ? ` · ${titleLabel(equipped)}` : ''}
          </div>
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              className={`btn px-2 py-1 text-[10px] ${!equipped ? 'btn-gold' : 'btn-dark'}`}
              onClick={() => equip(null)}
            >
              None
            </button>
            {ACHIEVEMENTS.filter((a) => isUnlocked(a.id)).map((a) => (
              <button
                key={a.id}
                type="button"
                title={a.blurb}
                className={`btn px-2 py-1 text-[10px] ${equipped === a.id ? 'btn-gold' : 'btn-dark'}`}
                onClick={() => equip(a.id)}
              >
                {a.title}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
