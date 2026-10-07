import { useEffect, type ReactNode } from 'react';

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
  useEffect(() => {
    if (!onClose) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  return (
    <div
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
