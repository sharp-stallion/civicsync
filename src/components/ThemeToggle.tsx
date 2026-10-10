import { useEffect, useState } from 'react';
import { Icon } from './Icon';

type Theme = 'light' | 'dark';

// Reads the current theme: explicit choice wins, else the OS preference.
function currentTheme(): Theme {
  try {
    const saved = localStorage.getItem('cs:theme');
    if (saved === 'light' || saved === 'dark') return saved;
  } catch { /* ignore */ }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyStoredTheme() {
  try {
    const saved = localStorage.getItem('cs:theme');
    if (saved === 'light' || saved === 'dark') document.documentElement.dataset.theme = saved;
  } catch { /* ignore — fall back to OS preference via CSS */ }
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(currentTheme);

  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);

  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    try { localStorage.setItem('cs:theme', next); } catch { /* ignore */ }
  };

  return (
    <button className="theme-toggle" onClick={toggle} aria-label="Toggle light or dark mode">
      <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={16} />
      {theme === 'dark' ? 'Light mode' : 'Dark mode'}
    </button>
  );
}
