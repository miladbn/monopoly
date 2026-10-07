import { useEffect, useState } from 'react';
import type { LogEntry } from '../game/engine';

/** Surfaces the latest meaningful log line as a brief toast. */
export default function Toast({ log }: { log: LogEntry[] }) {
  const [toast, setToast] = useState<{ id: number; text: string; color?: string } | null>(null);

  useEffect(() => {
    const top = log[0];
    if (!top) return;
    const t = top.text.toLowerCase();
    const interesting =
      t.includes('pays') ||
      t.includes('rent') ||
      t.includes('buys') ||
      t.includes('sold') ||
      t.includes('bankrupt') ||
      t.includes('collects') ||
      t.includes('auction') ||
      t.includes('jail') ||
      t.includes('trade') ||
      t.includes('builds') ||
      t.includes('passes go');
    if (!interesting) return;
    setToast({ id: top.id, text: top.text.replace(/^[^\w]+/, ''), color: top.color });
    const timer = window.setTimeout(() => setToast((cur) => (cur?.id === top.id ? null : cur)), 2800);
    return () => window.clearTimeout(timer);
  }, [log]);

  if (!toast) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-[max(0.75rem,env(safe-area-inset-top))] z-[60] flex justify-center px-3"
      role="status"
      aria-live="polite"
    >
      <div
        className="popin max-w-sm rounded-lg border border-[var(--brass)]/25 bg-[#0f1f1a]/95 px-3 py-2 text-center text-[12px] font-semibold shadow-lg backdrop-blur-sm sm:text-[13px]"
        style={{ color: toast.color || 'var(--champagne)' }}
      >
        {toast.text}
      </div>
    </div>
  );
}
