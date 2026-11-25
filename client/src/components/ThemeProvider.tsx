import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'light' | 'dark';

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'light',
      setTheme: (theme) => set({ theme }),
      toggleTheme: () =>
        set((state) => ({ theme: state.theme === 'light' ? 'dark' : 'light' })),
    }),
    { name: 'tradelog-theme' },
  ),
);

const ThemeContext = createContext<ThemeState | null>(null);

/** Applies the active theme class to <html> and exposes theme controls. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const store = useThemeStore();

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', store.theme === 'dark');
  }, [store.theme]);

  return (
    <ThemeContext.Provider value={store}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeState {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
}
