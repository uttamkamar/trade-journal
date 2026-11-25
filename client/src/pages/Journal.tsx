import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowDown,
  ArrowUp,
  CalendarBlank,
  CaretLeft,
  CaretRight,
  CheckCircle,
  FloppyDisk,
  Minus,
  Notebook,
  Trash,
  WarningCircle,
} from '@phosphor-icons/react';
import { PLAN_FOLLOWED_OPTIONS } from '../lib/constants';
import {
  cn,
  computeDayTradeSummary,
  formatDate,
  formatSignedCurrency,
  hasJournalContent,
  todayISO,
} from '../lib/utils';
import { useSettings, useTrades } from '../hooks/useTrades';
import {
  useDeleteJournalEntry,
  useJournalEntries,
  useSaveJournalEntry,
  type JournalInput,
} from '../hooks/useJournal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import type { DailyJournal, PlanFollowed } from '../types';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const EMPTY_FORM: JournalInput = {
  trading_summary: '',
  what_went_well: '',
  mistakes_today: '',
  lessons_learned: '',
  plan_followed: null,
  improvement_for_tomorrow: '',
  general_notes: '',
};

function draftStorageKey(date: string): string {
  return `tradelog-journal-draft:${date}`;
}

function readLocalDraft(date: string): JournalInput | null {
  try {
    const raw = localStorage.getItem(draftStorageKey(date));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<JournalInput>;
    return {
      trading_summary: parsed.trading_summary ?? '',
      what_went_well: parsed.what_went_well ?? '',
      mistakes_today: parsed.mistakes_today ?? '',
      lessons_learned: parsed.lessons_learned ?? '',
      plan_followed: parsed.plan_followed ?? null,
      improvement_for_tomorrow: parsed.improvement_for_tomorrow ?? '',
      general_notes: parsed.general_notes ?? '',
    };
  } catch {
    return null;
  }
}

function writeLocalDraft(date: string, form: JournalInput): void {
  try {
    localStorage.setItem(draftStorageKey(date), JSON.stringify(form));
  } catch {
    // ignore storage quota errors
  }
}

function clearLocalDraft(date: string): void {
  try {
    localStorage.removeItem(draftStorageKey(date));
  } catch {
    // ignore
  }
}

function entryToForm(entry: DailyJournal | undefined): JournalInput {
  if (!entry) return { ...EMPTY_FORM };
  return {
    trading_summary: entry.trading_summary ?? '',
    what_went_well: entry.what_went_well ?? '',
    mistakes_today: entry.mistakes_today ?? '',
    lessons_learned: entry.lessons_learned ?? '',
    plan_followed: entry.plan_followed ?? null,
    improvement_for_tomorrow: entry.improvement_for_tomorrow ?? '',
    general_notes: entry.general_notes ?? '',
  };
}

function formsEqual(a: JournalInput, b: JournalInput): boolean {
  return (
    (a.trading_summary ?? '') === (b.trading_summary ?? '') &&
    (a.what_went_well ?? '') === (b.what_went_well ?? '') &&
    (a.mistakes_today ?? '') === (b.mistakes_today ?? '') &&
    (a.lessons_learned ?? '') === (b.lessons_learned ?? '') &&
    (a.plan_followed ?? null) === (b.plan_followed ?? null) &&
    (a.improvement_for_tomorrow ?? '') === (b.improvement_for_tomorrow ?? '') &&
    (a.general_notes ?? '') === (b.general_notes ?? '')
  );
}

function shiftDate(dateStr: string, deltaDays: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d + deltaDays);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function shiftMonth(ym: string, deltaMonths: number): string {
  const [y, m] = ym.split('-').map(Number);
  const dt = new Date(y, m - 1 + deltaMonths, 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
}

export function Journal() {
  const navigate = useNavigate();
  const { date: paramDate } = useParams<{ date: string }>();
  const today = todayISO();

  const selectedDate =
    paramDate && DATE_RE.test(paramDate) ? paramDate : today;

  const [calendarMonth, setCalendarMonth] = useState(selectedDate.slice(0, 7));
  const [form, setForm] = useState<JournalInput>({ ...EMPTY_FORM });
  const [draftRestored, setDraftRestored] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const {
    data: entries = [],
    isLoading: entriesLoading,
    isError: entriesError,
    refetch: refetchEntries,
  } = useJournalEntries();
  const { data: trades = [] } = useTrades({ sort: 'newest' });
  const { data: settings } = useSettings();
  const saveEntry = useSaveJournalEntry();
  const deleteEntry = useDeleteJournalEntry();

  const currency = settings?.currency || 'USD';

  const savedEntry = useMemo(
    () => entries.find((e) => e.journal_date === selectedDate),
    [entries, selectedDate],
  );

  // Sync calendar month & form whenever selectedDate or savedEntry changes
  useEffect(() => {
    setCalendarMonth(selectedDate.slice(0, 7));
    setStatusMsg(null);
    setErrorMsg(null);

    const baseForm = entryToForm(savedEntry);
    const localDraft = readLocalDraft(selectedDate);
    if (localDraft && !formsEqual(localDraft, baseForm)) {
      setForm(localDraft);
      setDraftRestored(true);
    } else {
      setForm(baseForm);
      setDraftRestored(false);
    }
  }, [selectedDate, savedEntry]);

  const savedForm = useMemo(() => entryToForm(savedEntry), [savedEntry]);
  const isDirty = !formsEqual(form, savedForm);

  // Day's trade summary (open trades excluded from realized P/L)
  const daySummary = useMemo(
    () => computeDayTradeSummary(trades, selectedDate),
    [trades, selectedDate],
  );

  // Map of journal dates & closed-trade P/L per date for calendar indicators
  const entryDateSet = useMemo(
    () => new Set(entries.filter((e) => hasJournalContent(e)).map((e) => e.journal_date)),
    [entries],
  );

  const dayPnlByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of trades) {
      if (t.status !== 'Closed' || t.realized_pnl === null) continue;
      map.set(t.trade_date, (map.get(t.trade_date) ?? 0) + t.realized_pnl);
    }
    return map;
  }, [trades]);

  // Calendar grid cells (Monday-first)
  const calendarCells = useMemo(() => {
    const [y, m] = calendarMonth.split('-').map(Number);
    const firstDay = new Date(y, m - 1, 1);
    const daysInMonth = new Date(y, m, 0).getDate();
    // Convert Sunday=0..Saturday=6 to Monday=0..Sunday=6
    const leadingBlanks = (firstDay.getDay() + 6) % 7;

    const cells: Array<{ date: string | null; dayNum?: number }> = [];
    for (let i = 0; i < leadingBlanks; i++) cells.push({ date: null });
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({
        date: `${calendarMonth}-${String(d).padStart(2, '0')}`,
        dayNum: d,
      });
    }
    return cells;
  }, [calendarMonth]);

  const calendarMonthLabel = useMemo(() => {
    const [y, m] = calendarMonth.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString(undefined, {
      month: 'long',
      year: 'numeric',
    });
  }, [calendarMonth]);

  const goToDate = (date: string) => {
    if (!DATE_RE.test(date)) return;
    navigate(date === today ? '/journal' : `/journal/${date}`);
  };

  const updateField = <K extends keyof JournalInput>(key: K, value: JournalInput[K]) => {
    setStatusMsg(null);
    setErrorMsg(null);
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (formsEqual(next, savedForm)) {
        clearLocalDraft(selectedDate);
        setDraftRestored(false);
      } else {
        writeLocalDraft(selectedDate, next);
      }
      return next;
    });
  };

  const handleDiscardDraft = () => {
    clearLocalDraft(selectedDate);
    setForm(savedForm);
    setDraftRestored(false);
    setStatusMsg('Discarded unsaved draft changes.');
  };

  const persistEntry = async (e?: FormEvent) => {
    e?.preventDefault();
    setStatusMsg(null);
    setErrorMsg(null);

    try {
      await saveEntry.mutateAsync({
        date: selectedDate,
        payload: {
          trading_summary: form.trading_summary?.trim() ? form.trading_summary : null,
          what_went_well: form.what_went_well?.trim() ? form.what_went_well : null,
          mistakes_today: form.mistakes_today?.trim() ? form.mistakes_today : null,
          lessons_learned: form.lessons_learned?.trim() ? form.lessons_learned : null,
          plan_followed: form.plan_followed || null,
          improvement_for_tomorrow: form.improvement_for_tomorrow?.trim()
            ? form.improvement_for_tomorrow
            : null,
          general_notes: form.general_notes?.trim() ? form.general_notes : null,
        },
      });
      clearLocalDraft(selectedDate);
      setDraftRestored(false);
      setStatusMsg(`Saved journal entry for ${formatDate(selectedDate)}.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save journal entry.');
    }
  };

  const handleDelete = async () => {
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      await deleteEntry.mutateAsync(selectedDate);
      clearLocalDraft(selectedDate);
      setForm({ ...EMPTY_FORM });
      setDraftRestored(false);
      setConfirmDeleteOpen(false);
      setStatusMsg(`Deleted journal entry for ${formatDate(selectedDate)}.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to delete journal entry.');
      setConfirmDeleteOpen(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header + Date Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Daily Journal</h1>
          <p className="text-sm text-muted-fg mt-0.5">
            One reflection entry per date. Save drafts anytime; no field is mandatory.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => goToDate(shiftDate(selectedDate, -1))}
            aria-label="Previous day"
            title="Previous day"
            className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-sm border border-border bg-card hover:bg-muted transition-colors cursor-pointer"
          >
            <CaretLeft size={16} weight="bold" aria-hidden="true" />
          </button>

          <label htmlFor="journal-date-picker" className="sr-only">
            Select journal date
          </label>
          <input
            id="journal-date-picker"
            type="date"
            value={selectedDate}
            onChange={(e) => {
              if (e.target.value) goToDate(e.target.value);
            }}
            className="min-h-[40px] px-3 py-1.5 rounded-sm border border-border bg-card text-sm font-semibold"
          />

          <button
            type="button"
            onClick={() => goToDate(shiftDate(selectedDate, 1))}
            aria-label="Next day"
            title="Next day"
            className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-sm border border-border bg-card hover:bg-muted transition-colors cursor-pointer"
          >
            <CaretRight size={16} weight="bold" aria-hidden="true" />
          </button>

          {selectedDate !== today && (
            <button
              type="button"
              onClick={() => goToDate(today)}
              className="min-h-[40px] px-3 py-1.5 rounded-sm border border-primary text-primary text-xs font-semibold hover:bg-muted transition-colors cursor-pointer"
            >
              Today
            </button>
          )}
        </div>
      </div>

      {/* Automatic Day P/L & Trade Count Summary Banner */}
      <section
        aria-label="Selected day trading summary"
        className="bg-card border border-border rounded-md p-4 md:p-5 shadow-card flex flex-wrap items-center justify-between gap-4"
      >
        <div className="flex flex-wrap items-center gap-6">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-fg">
              Date
            </div>
            <div className="text-base font-bold mt-0.5 flex items-center gap-1.5">
              <CalendarBlank size={16} className="text-primary" aria-hidden="true" />
              <span>{formatDate(selectedDate)}</span>
              {selectedDate === today && (
                <span className="px-2 py-0.5 rounded-full bg-nav-active-bg text-primary text-[11px] font-semibold">
                  Today
                </span>
              )}
            </div>
          </div>

          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-fg">
              Day&apos;s Realized P/L ({currency})
            </div>
            <div
              className={cn(
                'text-lg font-bold mt-0.5 flex items-center gap-1',
                daySummary.netPnl > 0
                  ? 'text-profit'
                  : daySummary.netPnl < 0
                  ? 'text-loss'
                  : 'text-foreground',
              )}
            >
              {daySummary.netPnl > 0 && <ArrowUp size={16} weight="bold" aria-hidden="true" />}
              {daySummary.netPnl < 0 && <ArrowDown size={16} weight="bold" aria-hidden="true" />}
              {daySummary.netPnl === 0 && <Minus size={14} weight="bold" aria-hidden="true" />}
              <span>{formatSignedCurrency(daySummary.netPnl, currency)}</span>
            </div>
          </div>

          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-fg">
              Trades Taken
            </div>
            <div className="text-base font-bold mt-0.5">
              {daySummary.totalTrades}
              <span className="text-xs font-normal text-muted-fg ml-2">
                {daySummary.totalTrades === 0
                  ? 'No trades recorded'
                  : daySummary.openTrades > 0
                  ? `(${daySummary.wins}W / ${daySummary.losses}L · ${daySummary.openTrades} open excluded)`
                  : `(${daySummary.wins}W / ${daySummary.losses}L)`}
              </span>
            </div>
          </div>
        </div>

        <Link
          to="/trades"
          className="text-xs font-semibold text-primary hover:underline whitespace-nowrap"
        >
          View trades →
        </Link>
      </section>

      {entriesError && (
        <div role="alert" className="bg-loss-bg border border-loss/30 rounded-md p-4 flex items-center justify-between gap-3">
          <span className="text-sm text-loss font-medium">Could not load journal entries.</span>
          <button
            type="button"
            onClick={() => refetchEntries()}
            className="px-3 py-1.5 rounded-sm border border-border bg-card text-xs font-semibold cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Main Two-Column Layout: Browser (left) + Reflection Form (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-[310px_1fr] gap-6 items-start">
        {/* Left: Calendar + Past Entries List */}
        <aside className="space-y-4">
          {/* Month Calendar */}
          <section className="bg-card border border-border rounded-md p-4 shadow-card space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold">{calendarMonthLabel}</h2>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setCalendarMonth((m) => shiftMonth(m, -1))}
                  aria-label="Previous month"
                  className="w-8 h-8 inline-flex items-center justify-center rounded-sm hover:bg-muted text-muted-fg hover:text-foreground cursor-pointer"
                >
                  <CaretLeft size={15} weight="bold" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => setCalendarMonth((m) => shiftMonth(m, 1))}
                  aria-label="Next month"
                  className="w-8 h-8 inline-flex items-center justify-center rounded-sm hover:bg-muted text-muted-fg hover:text-foreground cursor-pointer"
                >
                  <CaretRight size={15} weight="bold" aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center">
              {WEEKDAYS.map((w) => (
                <div key={w} className="text-[10px] font-semibold uppercase text-muted-fg py-1">
                  {w}
                </div>
              ))}

              {calendarCells.map((cell, i) => {
                if (!cell.date) {
                  return <div key={`blank-${i}`} aria-hidden="true" />;
                }
                const date = cell.date;
                const isSelected = date === selectedDate;
                const isToday = date === today;
                const hasJournal = entryDateSet.has(date);
                const dayPnl = dayPnlByDate.get(date);

                return (
                  <button
                    key={date}
                    type="button"
                    onClick={() => goToDate(date)}
                    aria-label={`${formatDate(date)}${hasJournal ? ' (journal saved)' : ''}`}
                    aria-current={isSelected ? 'date' : undefined}
                    className={cn(
                      'relative h-9 rounded-sm text-xs font-medium flex flex-col items-center justify-center transition-colors cursor-pointer',
                      isSelected
                        ? 'bg-primary text-on-primary font-bold'
                        : isToday
                        ? 'border border-primary text-primary font-bold hover:bg-muted'
                        : 'text-foreground hover:bg-muted',
                    )}
                  >
                    <span>{cell.dayNum}</span>
                    {(hasJournal || dayPnl !== undefined) && (
                      <span className="flex items-center gap-0.5 mt-0.5" aria-hidden="true">
                        {hasJournal && (
                          <span
                            className={cn(
                              'w-1.5 h-1.5 rounded-full',
                              isSelected ? 'bg-on-primary' : 'bg-accent',
                            )}
                          />
                        )}
                        {dayPnl !== undefined && (
                          <span
                            className={cn(
                              'w-1.5 h-1.5 rounded-full',
                              isSelected
                                ? 'bg-white/80'
                                : dayPnl >= 0
                                ? 'bg-profit'
                                : 'bg-loss',
                            )}
                          />
                        )}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-border text-[11px] text-muted-fg">
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-accent inline-block" aria-hidden="true" />
                Journal
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-profit inline-block" aria-hidden="true" />
                Profit day
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-loss inline-block" aria-hidden="true" />
                Loss day
              </span>
            </div>
          </section>

          {/* Saved Entries Date List */}
          <section className="bg-card border border-border rounded-md shadow-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <h2 className="text-sm font-bold">Saved Entries</h2>
              <span className="text-xs text-muted-fg">{entries.length}</span>
            </div>

            {entriesLoading ? (
              <div className="p-4 text-xs text-muted-fg">Loading entries…</div>
            ) : entries.length === 0 ? (
              <div className="p-5 text-center space-y-1.5">
                <Notebook size={24} className="mx-auto text-primary/70" aria-hidden="true" />
                <p className="text-xs font-medium">No journal entries yet</p>
                <p className="text-[11px] text-muted-fg">
                  Write your first reflection on the right and save it.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border max-h-80 overflow-y-auto">
                {entries.map((entry) => {
                  const summary = computeDayTradeSummary(trades, entry.journal_date);
                  const active = entry.journal_date === selectedDate;
                  const snippet =
                    entry.trading_summary ||
                    entry.lessons_learned ||
                    entry.what_went_well ||
                    entry.general_notes ||
                    'Draft saved';

                  return (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => goToDate(entry.journal_date)}
                      className={cn(
                        'w-full text-left px-4 py-3 transition-colors cursor-pointer space-y-1',
                        active ? 'nav-active-bg' : 'hover:bg-background/80',
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-foreground">
                          {formatDate(entry.journal_date)}
                        </span>
                        <span
                          className={cn(
                            'text-[11px] font-semibold',
                            summary.netPnl > 0
                              ? 'text-profit'
                              : summary.netPnl < 0
                              ? 'text-loss'
                              : 'text-muted-fg',
                          )}
                        >
                          {summary.closedTrades > 0
                            ? formatSignedCurrency(summary.netPnl, currency)
                            : `${summary.totalTrades} trade${summary.totalTrades === 1 ? '' : 's'}`}
                        </span>
                      </div>
                      <p className="text-xs text-muted-fg truncate">{snippet}</p>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        </aside>

        {/* Right: Reflection Editor */}
        <form
          onSubmit={persistEntry}
          className="bg-card border border-border rounded-md p-5 md:p-6 shadow-card space-y-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
            <div>
              <h2 className="text-base font-bold">
                Reflection for {formatDate(selectedDate)}
              </h2>
              <p className="text-xs text-muted-fg mt-0.5">
                {isDirty
                  ? draftRestored
                    ? 'Local unsaved draft restored — click Save Entry to persist to database.'
                    : 'Unsaved changes (backed up as local draft).'
                  : savedEntry
                  ? 'Saved in your journal.'
                  : 'New entry — fill what helps you today.'}
              </p>
            </div>

            <span
              className={cn(
                'px-2.5 py-1 rounded-full text-xs font-semibold',
                isDirty
                  ? 'bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
                  : savedEntry
                  ? 'bg-profit-bg text-profit'
                  : 'bg-muted text-muted-fg',
              )}
            >
              {isDirty ? 'Unsaved draft' : savedEntry ? 'Saved' : 'Not saved yet'}
            </span>
          </div>

          {statusMsg && (
            <div
              role="status"
              className="flex items-center gap-2 rounded-md border border-profit/30 bg-profit-bg px-4 py-2.5 text-sm font-medium text-profit"
            >
              <CheckCircle size={18} weight="bold" aria-hidden="true" />
              <span>{statusMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div
              role="alert"
              className="flex items-center gap-2 rounded-md border border-loss/30 bg-loss-bg px-4 py-2.5 text-sm font-medium text-loss"
            >
              <WarningCircle size={18} weight="bold" aria-hidden="true" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label htmlFor="journal-summary" className="block text-xs font-semibold uppercase tracking-wider text-muted-fg mb-1.5">
              How was my trading today?
            </label>
            <textarea
              id="journal-summary"
              rows={3}
              value={form.trading_summary ?? ''}
              onChange={(e) => updateField('trading_summary', e.target.value)}
              placeholder="Overall market conditions, execution quality, mindset..."
              className="w-full px-3 py-2 rounded-sm border border-border bg-background text-foreground text-sm"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="journal-well" className="block text-xs font-semibold uppercase tracking-wider text-muted-fg mb-1.5">
                What did I do well?
              </label>
              <textarea
                id="journal-well"
                rows={3}
                value={form.what_went_well ?? ''}
                onChange={(e) => updateField('what_went_well', e.target.value)}
                placeholder="Patience, waiting for confirmation, respecting stop loss..."
                className="w-full px-3 py-2 rounded-sm border border-border bg-background text-foreground text-sm"
              />
            </div>

            <div>
              <label htmlFor="journal-mistakes" className="block text-xs font-semibold uppercase tracking-wider text-muted-fg mb-1.5">
                What mistakes did I make?
              </label>
              <textarea
                id="journal-mistakes"
                rows={3}
                value={form.mistakes_today ?? ''}
                onChange={(e) => updateField('mistakes_today', e.target.value)}
                placeholder="FOMO, overtrading, sizing up, breaking rules..."
                className="w-full px-3 py-2 rounded-sm border border-border bg-background text-foreground text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="journal-lessons" className="block text-xs font-semibold uppercase tracking-wider text-muted-fg mb-1.5">
                What did I learn today?
              </label>
              <textarea
                id="journal-lessons"
                rows={3}
                value={form.lessons_learned ?? ''}
                onChange={(e) => updateField('lessons_learned', e.target.value)}
                placeholder="Key insight from today's session..."
                className="w-full px-3 py-2 rounded-sm border border-border bg-background text-foreground text-sm"
              />
            </div>

            <div>
              <label htmlFor="journal-improve" className="block text-xs font-semibold uppercase tracking-wider text-muted-fg mb-1.5">
                What will I improve tomorrow?
              </label>
              <textarea
                id="journal-improve"
                rows={3}
                value={form.improvement_for_tomorrow ?? ''}
                onChange={(e) => updateField('improvement_for_tomorrow', e.target.value)}
                placeholder="One concrete focus for the next session..."
                className="w-full px-3 py-2 rounded-sm border border-border bg-background text-foreground text-sm"
              />
            </div>
          </div>

          <div>
            <span className="block text-xs font-semibold uppercase tracking-wider text-muted-fg mb-1.5">
              Did I follow my trading plan?
            </span>
            <div className="grid grid-cols-3 gap-2 max-w-md">
              {PLAN_FOLLOWED_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  aria-pressed={form.plan_followed === opt}
                  onClick={() =>
                    updateField(
                      'plan_followed',
                      form.plan_followed === opt ? null : (opt as PlanFollowed),
                    )
                  }
                  className={cn(
                    'min-h-[42px] rounded-sm border text-sm font-semibold transition-colors cursor-pointer',
                    form.plan_followed === opt
                      ? 'bg-primary text-on-primary border-primary'
                      : 'bg-background border-border text-muted-fg hover:text-foreground',
                  )}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="journal-notes" className="block text-xs font-semibold uppercase tracking-wider text-muted-fg mb-1.5">
              General notes
            </label>
            <textarea
              id="journal-notes"
              rows={3}
              value={form.general_notes ?? ''}
              onChange={(e) => updateField('general_notes', e.target.value)}
              placeholder="Sleep, energy, news events, or anything else worth noting..."
              className="w-full px-3 py-2 rounded-sm border border-border bg-background text-foreground text-sm"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border">
            <div className="flex items-center gap-2">
              {savedEntry && (
                <button
                  type="button"
                  onClick={() => setConfirmDeleteOpen(true)}
                  className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-sm border border-loss/30 bg-loss-bg text-loss text-xs font-semibold hover:opacity-90 cursor-pointer"
                >
                  <Trash size={15} aria-hidden="true" />
                  <span>Delete Entry</span>
                </button>
              )}
              {isDirty && (
                <button
                  type="button"
                  onClick={handleDiscardDraft}
                  className="min-h-[40px] px-3 py-2 rounded-sm border border-border text-xs font-semibold text-muted-fg hover:text-foreground hover:bg-muted cursor-pointer"
                >
                  Discard Draft
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={saveEntry.isPending}
              className="min-h-[42px] inline-flex items-center gap-1.5 px-5 py-2 rounded-sm bg-accent hover:bg-accent-hover text-white text-sm font-semibold transition-colors cursor-pointer disabled:opacity-60"
            >
              <FloppyDisk size={16} weight="bold" aria-hidden="true" />
              <span>{saveEntry.isPending ? 'Saving…' : 'Save Entry'}</span>
            </button>
          </div>
        </form>
      </div>

      <ConfirmDialog
        open={confirmDeleteOpen}
        title="Delete journal entry?"
        description={`This will permanently delete your journal entry for ${formatDate(selectedDate)}. Your trade records for this date will not be affected.`}
        isLoading={deleteEntry.isPending}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDeleteOpen(false)}
      />
    </div>
  );
}
