import { useEffect, useLayoutEffect, useState } from 'react';

export type Theme = 'light' | 'dark';
export type ThemePreference = 'system' | Theme;
const storageKey = 'map4child.theme';

function savedPreference(): ThemePreference {
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch { /* The system theme also works when storage is unavailable. */ }
  return 'system';
}

export function useTheme() {
  const [preference, setPreference] = useState(savedPreference);
  const [systemDark, setSystemDark] = useState(() => matchMedia('(prefers-color-scheme: dark)').matches);
  const theme: Theme = preference === 'system' ? (systemDark ? 'dark' : 'light') : preference;

  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)');
    const update = () => setSystemDark(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useLayoutEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);

  const changePreference = (value: ThemePreference) => {
    setPreference(value);
    try {
      if (value === 'system') localStorage.removeItem(storageKey);
      else localStorage.setItem(storageKey, value);
    } catch { /* Keep the selected theme for this session. */ }
  };
  return { theme, preference, changePreference };
}
