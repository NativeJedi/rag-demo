import { useEffect, useRef, useState, type ReactNode } from 'react';

interface PopoverProps {
  trigger: (props: { onClick: () => void; open: boolean }) => ReactNode;
  children: ReactNode;
}

/** Minimal click-toggle popover; closes on outside click and Escape. */
export function Popover({ trigger, children }: PopoverProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <span ref={ref} className="relative inline-block">
      {trigger({ onClick: () => setOpen((o) => !o), open })}
      {open && (
        <div role="dialog" className="absolute bottom-full left-0 z-30 mb-2 w-72 max-w-[80vw] rounded-xl border border-line bg-surface p-3 text-left text-sm shadow-lg">
          {children}
        </div>
      )}
    </span>
  );
}
