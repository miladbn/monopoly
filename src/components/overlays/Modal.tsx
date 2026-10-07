import { useEffect, useRef, type ReactNode } from 'react';

export function Modal({
  children,
  z = 40,
  dim = 0.72,
  sheet = false,
  onClose,
  label,
}: {
  children: ReactNode;
  z?: number;
  dim?: number;
  /** Bottom sheet on narrow screens; centered on sm+ */
  sheet?: boolean;
  /** Escape / backdrop click dismisses when provided */
  onClose?: () => void;
  /** Accessible name for the dialog */
  label?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const focusables = () =>
      Array.from(
        root.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => !el.hasAttribute('disabled') && el.tabIndex !== -1);

    const first = focusables()[0];
    first?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const list = focusables();
      if (!list.length) return;
      const firstEl = list[0];
      const lastEl = list[list.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };

    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      ref={rootRef}
      className={`fadein fixed inset-0 flex p-2 sm:items-center sm:justify-center sm:p-3 ${
        sheet ? 'items-end justify-center' : 'items-center justify-center'
      }`}
      style={{
        zIndex: z,
        background: `rgba(6,14,12,${dim})`,
        backdropFilter: 'blur(6px)',
        paddingTop: 'max(0.5rem, env(safe-area-inset-top))',
        paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))',
      }}
      role="dialog"
      aria-modal="true"
      aria-label={label || 'Dialog'}
      onMouseDown={(e) => {
        if (onClose && e.target === e.currentTarget) onClose();
      }}
    >
      {children}
    </div>
  );
}
