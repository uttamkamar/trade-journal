import { useEffect, useRef } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  SquaresFour,
  Pulse,
  Notebook,
  ChartBar,
  Warning,
  Gear,
  Plus,
  Sun,
  Moon,
} from '@phosphor-icons/react';
import { cn, formatDate, hasJournalContent, todayISO } from '../lib/utils';
import { useJournalEntries } from '../hooks/useJournal';
import { useSettings, useUpdateSettings } from '../hooks/useTrades';
import { useTheme } from './ThemeProvider';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', shortLabel: 'Home', icon: SquaresFour, end: true },
  { to: '/trades', label: 'Trades', shortLabel: 'Trades', icon: Pulse, end: false },
  { to: '/journal', label: 'Daily Journal', shortLabel: 'Journal', icon: Notebook, end: false },
  { to: '/performance', label: 'Performance', shortLabel: 'Stats', icon: ChartBar, end: false },
  { to: '/mistakes', label: 'Mistake Analysis', shortLabel: 'Mistakes', icon: Warning, end: false },
] as const;

/** Shared application shell: top bar, desktop sidebar, and mobile bottom nav. */
export function Layout() {
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const today = todayISO();
  const todayLabel = formatDate(today);

  const { data: settings } = useSettings();
  const updateSettings = useUpdateSettings();
  const syncedThemeOnce = useRef(false);

  // Sync persisted theme from SQLite settings on initial app load
  useEffect(() => {
    if (!syncedThemeOnce.current && settings?.theme) {
      syncedThemeOnce.current = true;
      if (settings.theme === 'light' || settings.theme === 'dark') {
        setTheme(settings.theme);
      }
    }
  }, [settings?.theme, setTheme]);

  const handleToggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    updateSettings.mutate({ theme: next });
  };

  const { data: journalEntries = [], isLoading: journalLoading } = useJournalEntries();
  const todayJournalComplete =
    journalLoading || hasJournalContent(journalEntries.find((e) => e.journal_date === today));

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col overflow-x-clip">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 h-14 bg-card border-b border-border px-3 sm:px-6 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg bg-primary text-on-primary flex items-center justify-center font-extrabold text-sm tracking-tight shrink-0"
            aria-hidden="true"
          >
            TL
          </div>
          <span className="font-bold text-[17px] tracking-tight text-primary">
            TradeLog
          </span>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <span className="hidden sm:inline text-xs font-medium text-muted-fg">
            {todayLabel}
          </span>

          <button
            type="button"
            onClick={handleToggleTheme}
            aria-label={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
            title={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
            className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-sm border border-border bg-background text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            {theme === 'light' ? (
              <Moon size={18} weight="regular" aria-hidden="true" />
            ) : (
              <Sun size={18} weight="regular" aria-hidden="true" />
            )}
          </button>

          <NavLink
            to="/settings"
            aria-label="Settings"
            className={({ isActive }) =>
              cn(
                'md:hidden min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-sm border border-border transition-colors',
                isActive
                  ? 'nav-active-bg text-primary border-primary/30'
                  : 'bg-background text-muted-fg hover:bg-muted hover:text-foreground',
              )
            }
          >
            <Gear size={18} weight="regular" aria-hidden="true" />
          </NavLink>

          <button
            type="button"
            onClick={() => navigate('/trades/new')}
            className="min-h-[40px] inline-flex items-center gap-1.5 px-2.5 sm:px-3.5 py-2 rounded-sm bg-accent hover:bg-accent-hover text-white text-xs sm:text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap"
          >
            <Plus size={16} weight="bold" aria-hidden="true" />
            <span>Add Trade</span>
          </button>
        </div>
      </header>

      <div className="flex-1 flex">
        {/* Desktop Sidebar */}
        <aside
          aria-label="Main navigation"
          className="hidden md:flex md:w-[224px] md:shrink-0 md:flex-col md:sticky md:top-14 md:h-[calc(100vh-3.5rem)] md:overflow-y-auto bg-card border-r border-border px-3 py-5"
        >
          <div className="px-2.5 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-fg">
            Journal
          </div>

          <nav className="flex flex-col gap-1 flex-1">
            {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2.5 px-2.5 py-2 rounded-sm text-sm font-medium transition-colors',
                    isActive
                      ? 'nav-active-bg text-primary font-semibold'
                      : 'text-muted-fg hover:bg-muted hover:text-foreground',
                  )
                }
              >
                <Icon size={18} weight="regular" aria-hidden="true" className="shrink-0" />
                <span>{label}</span>
                {to === '/journal' && !todayJournalComplete && (
                  <span
                    title="Today's journal is not complete yet"
                    aria-label="incomplete"
                    className="ml-auto px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 text-[10px] font-bold"
                  >
                    !
                  </span>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="pt-3 mt-3 border-t border-border">
            <NavLink
              to="/settings"
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 px-2.5 py-2 rounded-sm text-sm font-medium transition-colors',
                  isActive
                    ? 'nav-active-bg text-primary font-semibold'
                    : 'text-muted-fg hover:bg-muted hover:text-foreground',
                )
              }
            >
              <Gear size={18} weight="regular" aria-hidden="true" className="shrink-0" />
              <span>Settings</span>
            </NavLink>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0 px-4 py-5 pb-24 md:px-8 md:py-7 md:pb-8">
          <div className="max-w-6xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Mobile Bottom Tab Bar */}
      <nav
        aria-label="Mobile navigation"
        className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-card border-t border-border grid grid-cols-5 h-16"
      >
        {NAV_ITEMS.map(({ to, shortLabel, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'relative flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors',
                isActive ? 'text-primary font-semibold' : 'text-muted-fg',
              )
            }
          >
            <Icon size={20} weight="regular" aria-hidden="true" />
            <span>{shortLabel}</span>
            {to === '/journal' && !todayJournalComplete && (
              <span
                aria-hidden="true"
                className="absolute top-2 right-4 w-2 h-2 rounded-full bg-accent"
              />
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
