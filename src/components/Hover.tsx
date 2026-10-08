import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  content: ReactNode;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  delay?: number;
  width?: number;
  /** Preferred side; falls back automatically when there's no room. */
  side?: 'bottom' | 'right';
}

/** Hover card rendered in a portal so it never gets clipped by the scrolling grid. */
export function Hover({ content, children, className, disabled, delay = 250, width = 300, side = 'bottom' }: Props) {
  const anchor = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const timer = useRef<number>();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => () => window.clearTimeout(timer.current), []);
  useEffect(() => {
    if (disabled) {
      window.clearTimeout(timer.current);
      setOpen(false);
    }
  }, [disabled]);

  useLayoutEffect(() => {
    if (!open || !anchor.current || !card.current) return;
    const a = anchor.current.getBoundingClientRect();
    const c = card.current.getBoundingClientRect();
    const margin = 8;
    let top: number;
    let left: number;
    if (side === 'right') {
      top = Math.min(a.top, window.innerHeight - c.height - margin);
      left = a.right + 6;
    } else {
      top = a.bottom + 6;
      if (top + c.height > window.innerHeight - margin) top = a.top - c.height - 6;
      left = a.left;
    }
    top = Math.max(margin, top);
    if (left + c.width > window.innerWidth - margin) left = window.innerWidth - c.width - margin;
    setPos({ top, left: Math.max(margin, left) });
  }, [open, side]);

  return (
    <div
      ref={anchor}
      className={className}
      onMouseEnter={() => {
        if (disabled) return;
        timer.current = window.setTimeout(() => setOpen(true), delay);
      }}
      onMouseLeave={() => {
        window.clearTimeout(timer.current);
        setOpen(false);
      }}
      onDragStart={() => {
        window.clearTimeout(timer.current);
        setOpen(false);
      }}
    >
      {children}
      {open &&
        createPortal(
          <div
            ref={card}
            style={{ top: pos.top, left: pos.left, width }}
            className="animate-pop pointer-events-none fixed z-[60] rounded-xl border border-stone-200 bg-white p-3 text-xs text-slate-700 shadow-xl shadow-stone-900/10"
          >
            {content}
          </div>,
          document.body,
        )}
    </div>
  );
}
