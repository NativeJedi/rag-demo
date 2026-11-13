import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { IconButton } from './Button';
import { cn } from '../lib/cn';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  side?: 'left' | 'right';
  children: ReactNode;
  className?: string;
}

/** Modal side panel with backdrop, Escape to close. */
export function Drawer({ open, onClose, title, side = 'right', children, className }: DrawerProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <div className={cn('fixed inset-0 z-40', !open && 'pointer-events-none')} aria-hidden={!open}>
      <div
        onClick={onClose}
        className={cn('absolute inset-0 bg-black/40 transition-opacity', open ? 'opacity-100' : 'opacity-0')}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'absolute top-0 flex h-full w-[min(26rem,100vw)] flex-col border-line bg-surface shadow-xl transition-transform duration-200',
          side === 'right' ? 'right-0 border-l' : 'left-0 border-r',
          open ? 'translate-x-0' : side === 'right' ? 'translate-x-full' : '-translate-x-full',
          className,
        )}
      >
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-line px-4">
          <h2 className="font-semibold">{title}</h2>
          <IconButton label="Close" onClick={onClose}>
            <X className="size-5" />
          </IconButton>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">{open && children}</div>
      </aside>
    </div>
  );
}
