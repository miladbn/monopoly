import { useEffect, useState } from 'react';
import { REACTION_EMOJIS, type RoomReaction } from '../telegram/api';

export default function ReactionBar({
  reactions,
  disabled,
  onReact,
}: {
  reactions: RoomReaction[];
  disabled?: boolean;
  onReact: (emoji: string) => void;
}) {
  const [floats, setFloats] = useState<RoomReaction[]>([]);

  useEffect(() => {
    if (!reactions?.length) return;
    const latest = reactions[reactions.length - 1];
    setFloats((prev) => {
      if (prev.some((r) => r.id === latest.id)) return prev;
      return [...prev.slice(-6), latest];
    });
    const t = setTimeout(() => {
      setFloats((prev) => prev.filter((r) => r.id !== latest.id));
    }, 2800);
    return () => clearTimeout(t);
  }, [reactions]);

  return (
    <div className="relative shrink-0">
      <div className="pointer-events-none absolute bottom-full left-0 right-0 mb-1 flex h-16 items-end justify-center gap-2 overflow-visible">
        {floats.map((r, i) => (
          <div
            key={r.id}
            className="popin flex flex-col items-center"
            style={{ animationDelay: `${i * 40}ms` }}
          >
            <span className="text-2xl drop-shadow-md" aria-hidden>
              {r.emoji}
            </span>
            <span className="max-w-[72px] truncate text-[9px] text-[var(--mist)]">{r.fromName}</span>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap justify-center gap-1 rounded-lg bg-black/30 p-1">
        {REACTION_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            disabled={disabled}
            className="btn btn-dark min-h-[36px] min-w-[36px] px-1.5 py-1 text-base disabled:opacity-40"
            onClick={() => onReact(emoji)}
            aria-label={`React ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
