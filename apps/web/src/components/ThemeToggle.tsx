import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from '../lib/theme';
import { IconButton } from './Button';

const ICONS = { light: Sun, dark: Moon, system: Monitor } as const;

export function ThemeToggle() {
  const { theme, cycle } = useTheme();
  const Icon = ICONS[theme];
  return (
    <IconButton label={`Theme: ${theme} (click to change)`} onClick={cycle}>
      <Icon className="size-5" />
    </IconButton>
  );
}
