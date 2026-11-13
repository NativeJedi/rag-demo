import { useCallback, useEffect, useState } from 'react';

export type Theme = 'system' | 'light' | 'dark';
const ORDER: Theme[] = ['light', 'dark', 'system'];

function read(): Theme {
  try {
    const v = localStorage.getItem('theme');
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

function apply(theme: Theme): void {
  const dark = theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
}

/** Follows the system preference by default; the toggle cycles light → dark → system. */
export function useTheme(): { theme: Theme; cycle: () => void } {
  const [theme, setTheme] = useState<Theme>(read);

  useEffect(() => {
    apply(theme);
    if (theme !== 'system') return;
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => apply('system');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [theme]);

  const cycle = useCallback(() => {
    setTheme((current) => {
      const next = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length] ?? 'system';
      try {
        localStorage.setItem('theme', next);
      } catch {
        /* storage unavailable */
      }
      return next;
    });
  }, []);

  return { theme, cycle };
}
