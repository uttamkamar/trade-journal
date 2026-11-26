import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  CheckCircle,
  DownloadSimple,
  FloppyDisk,
  Moon,
  Plus,
  Sun,
  UploadSimple,
  Warning,
  WarningCircle,
  X,
} from '@phosphor-icons/react';
import { CURRENCIES, DEFAULT_MISTAKES, DEFAULT_SYMBOLS } from '../lib/constants';
import { cn, formatDate } from '../lib/utils';
import {
  useApplyImport,
  usePreviewImport,
  useSettings,
  useUpdateSettings,
  type ImportPreviewResponse,
} from '../hooks/useTrades';
import { useTheme, type Theme } from '../components/ThemeProvider';
import { ConfirmDialog } from '../components/ConfirmDialog';

export function Settings() {
  const { theme, setTheme } = useTheme();
  const { data: settings, isLoading, isError, refetch } = useSettings();
  const updateSettings = useUpdateSettings();
  const previewImport = usePreviewImport();
  const applyImport = useApplyImport();

  // Preferences form
  const [currency, setCurrency] = useState('USD');
  const [startingBalance, setStartingBalance] = useState('');
  const [prefStatus, setPrefStatus] = useState<string | null>(null);
  const [prefError, setPrefError] = useState<string | null>(null);

  // Custom symbols & mistakes
  const [newSymbol, setNewSymbol] = useState('');
  const [symbolMsg, setSymbolMsg] = useState<string | null>(null);
  const [newMistake, setNewMistake] = useState('');
  const [mistakeMsg, setMistakeMsg] = useState<string | null>(null);

  // Import / Restore state
  const [backupData, setBackupData] = useState<unknown>(null);
  const [backupFileName, setBackupFileName] = useState<string | null>(null);
  const [previewResult, setPreviewResult] = useState<ImportPreviewResponse['preview'] | null>(null);
  const [importMode, setImportMode] = useState<'merge_skip' | 'merge_overwrite'>('merge_skip');
  const [confirmRestoreOpen, setConfirmRestoreOpen] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  useEffect(() => {
    if (!settings) return;
    setCurrency(settings.currency || 'USD');
    setStartingBalance(
      settings.starting_balance !== null && settings.starting_balance !== undefined
        ? String(settings.starting_balance)
        : '',
    );
    if (settings.theme === 'light' || settings.theme === 'dark') {
      setTheme(settings.theme);
    }
  }, [settings, setTheme]);

  const handleSavePreferences = async (e: FormEvent) => {
    e.preventDefault();
    setPrefStatus(null);
    setPrefError(null);

    let parsedBalance: number | null = null;
    if (startingBalance.trim() !== '') {
      const n = Number(startingBalance);
      if (!Number.isFinite(n)) {
        setPrefError('Starting balance must be a valid number.');
        return;
      }
      parsedBalance = n;
    }

    try {
      await updateSettings.mutateAsync({
        currency,
        starting_balance: parsedBalance,
      });
      setPrefStatus('Preferences saved.');
    } catch (err) {
      setPrefError(err instanceof Error ? err.message : 'Failed to save preferences.');
    }
  };

  const handleThemeChange = async (next: Theme) => {
    setTheme(next);
    setPrefError(null);
    try {
      await updateSettings.mutateAsync({ theme: next });
    } catch (err) {
      setPrefError(err instanceof Error ? err.message : 'Failed to save theme.');
    }
  };

  const handleAddSymbol = async (e: FormEvent) => {
    e.preventDefault();
    setSymbolMsg(null);
    const cleaned = newSymbol.trim().toUpperCase();
    if (!cleaned) return;

    const existingCustom = settings?.custom_symbols ?? [];
    if (
      (DEFAULT_SYMBOLS as readonly string[]).includes(cleaned) ||
      existingCustom.includes(cleaned)
    ) {
      setSymbolMsg(`${cleaned} is already in your symbols list.`);
      return;
    }

    try {
      await updateSettings.mutateAsync({
        custom_symbols: [...existingCustom, cleaned],
      });
      setNewSymbol('');
      setSymbolMsg(`Added ${cleaned}.`);
    } catch (err) {
      setSymbolMsg(err instanceof Error ? err.message : 'Failed to add symbol.');
    }
  };

  const handleRemoveSymbol = async (sym: string) => {
    setSymbolMsg(null);
    const existingCustom = settings?.custom_symbols ?? [];
    try {
      await updateSettings.mutateAsync({
        custom_symbols: existingCustom.filter((s) => s !== sym),
      });
    } catch (err) {
      setSymbolMsg(err instanceof Error ? err.message : 'Failed to remove symbol.');
    }
  };

  const handleAddMistake = async (e: FormEvent) => {
    e.preventDefault();
    setMistakeMsg(null);
    const cleaned = newMistake.trim();
    if (!cleaned) return;

    const existingCustom = settings?.custom_mistakes ?? [];
    const allLower = [
      ...DEFAULT_MISTAKES.map((m) => m.toLowerCase()),
      ...existingCustom.map((m) => m.toLowerCase()),
    ];
    if (allLower.includes(cleaned.toLowerCase())) {
      setMistakeMsg(`"${cleaned}" is already in your mistakes list.`);
      return;
    }

    try {
      await updateSettings.mutateAsync({
        custom_mistakes: [...existingCustom, cleaned],
      });
      setNewMistake('');
      setMistakeMsg(`Added "${cleaned}".`);
    } catch (err) {
      setMistakeMsg(err instanceof Error ? err.message : 'Failed to add mistake.');
    }
  };

  const handleRemoveMistake = async (tag: string) => {
    setMistakeMsg(null);
    const existingCustom = settings?.custom_mistakes ?? [];
    try {
      await updateSettings.mutateAsync({
        custom_mistakes: existingCustom.filter((m) => m !== tag),
      });
    } catch (err) {
      setMistakeMsg(err instanceof Error ? err.message : 'Failed to remove mistake.');
    }
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    setImportError(null);
    setImportStatus(null);
    setPreviewResult(null);
    setBackupData(null);
    setBackupFileName(null);
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const res = await previewImport.mutateAsync(parsed);
      setBackupData(parsed);
      setBackupFileName(file.name);
      setPreviewResult(res.preview);
    } catch (err) {
      setImportError(
        err instanceof SyntaxError
          ? 'Selected file is not valid JSON.'
          : err instanceof Error
          ? err.message
          : 'Failed to preview backup file.',
      );
    }
  };

  const handleConfirmRestore = async () => {
    if (!backupData) return;
    setImportError(null);
    setImportStatus(null);
    try {
      const res = await applyImport.mutateAsync({
        data: backupData,
        mode: importMode,
      });
      const { trades, journal } = res.summary;
      setConfirmRestoreOpen(false);
      setPreviewResult(null);
      setBackupData(null);
      setBackupFileName(null);
      setImportStatus(
        `Restore complete (${res.mode === 'merge_skip' ? 'Safe Merge' : 'Updated Duplicates'}): ` +
          `Trades (+${trades.inserted} added, ${trades.updated} updated, ${trades.skipped} skipped); ` +
          `Journal (+${journal.inserted} added, ${journal.updated} updated, ${journal.skipped} skipped).`,
      );
    } catch (err) {
      setConfirmRestoreOpen(false);
      setImportError(err instanceof Error ? err.message : 'Restore failed.');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-4xl">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-fg mt-0.5">Loading settings…</p>
        </div>
        <div className="h-44 rounded-lg bg-card border border-border animate-pulse" />
      </div>
    );
  }

  if (isError) {
    return (
      <div role="alert" className="bg-loss-bg border border-loss/30 rounded-lg p-6 text-center space-y-3 max-w-4xl">
        <p className="text-sm text-loss font-medium">Failed to load settings.</p>
        <button
          type="button"
          onClick={() => refetch()}
          className="px-4 py-2 rounded-md border border-border bg-card text-sm font-semibold cursor-pointer"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-fg mt-0.5">
          Manage your journal preferences, custom lists, exports, and backups.
        </p>
      </div>

      {/* 1. Preferences: Currency, Starting Balance, Theme */}
      <section className="bg-card border border-border rounded-lg p-5 md:p-6 shadow-card space-y-5">
        <div className="border-b border-border pb-3">
          <h2 className="text-base font-semibold">Preferences</h2>
          <p className="text-xs text-muted-fg mt-0.5">
            Stored persistently in your local database.
          </p>
        </div>

        <form onSubmit={handleSavePreferences} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="pref-currency" className="block text-[11px] font-semibold uppercase tracking-wider text-muted-fg mb-1.5">
                Preferred Currency
              </label>
              <select
                id="pref-currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full min-h-[42px] px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm font-medium"
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <p className="text-[11px] text-muted-fg mt-1.5 leading-relaxed">
                Used for dashboard/performance totals and default currency on new trades. Existing trades keep their saved currency.
              </p>
            </div>

            <div>
              <label htmlFor="pref-balance" className="block text-[11px] font-semibold uppercase tracking-wider text-muted-fg mb-1.5">
                Starting Balance (Optional)
              </label>
              <input
                id="pref-balance"
                type="number"
                step="any"
                value={startingBalance}
                onChange={(e) => setStartingBalance(e.target.value)}
                placeholder="Leave blank to hide balance card"
                className="w-full min-h-[42px] px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm font-num"
              />
              <p className="text-[11px] text-muted-fg mt-1.5 leading-relaxed">
                Shows journal-calculated balance on Dashboard when all closed trades match {currency}.
              </p>
            </div>
          </div>

          {prefStatus && (
            <div role="status" className="flex items-center gap-2 text-xs font-semibold text-profit">
              <CheckCircle size={16} weight="bold" aria-hidden="true" />
              <span>{prefStatus}</span>
            </div>
          )}
          {prefError && (
            <div role="alert" className="flex items-center gap-2 text-xs font-semibold text-loss">
              <WarningCircle size={16} weight="bold" aria-hidden="true" />
              <span>{prefError}</span>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-border">
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-fg">
                Appearance
              </span>
              <div className="inline-flex rounded-md border border-border p-0.5 bg-background">
                {(['light', 'dark'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    aria-pressed={theme === mode}
                    onClick={() => handleThemeChange(mode)}
                    className={cn(
                      'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] text-xs font-semibold capitalize cursor-pointer transition-colors',
                      theme === mode
                        ? 'bg-card text-foreground shadow-sm'
                        : 'text-muted-fg hover:text-foreground',
                    )}
                  >
                    {mode === 'light' ? (
                      <Sun size={14} weight="regular" aria-hidden="true" />
                    ) : (
                      <Moon size={14} weight="regular" aria-hidden="true" />
                    )}
                    <span>{mode}</span>
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={updateSettings.isPending}
              className="min-h-[40px] inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-accent hover:bg-accent-hover text-on-accent text-sm font-semibold transition-colors cursor-pointer disabled:opacity-60"
            >
              <FloppyDisk size={16} weight="bold" aria-hidden="true" />
              <span>{updateSettings.isPending ? 'Saving…' : 'Save Preferences'}</span>
            </button>
          </div>
        </form>
      </section>

      {/* 2. Custom Symbols & Custom Mistakes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Custom Symbols */}
        <section className="bg-card border border-border rounded-lg p-5 shadow-card space-y-4">
          <div>
            <h2 className="text-base font-semibold">Custom Instruments</h2>
            <p className="text-xs text-muted-fg mt-0.5">
              {DEFAULT_SYMBOLS.length} common instruments are pre-loaded. Add your own symbols here.
            </p>
          </div>

          <form onSubmit={handleAddSymbol} className="flex gap-2">
            <label htmlFor="add-custom-symbol" className="sr-only">
              New custom symbol
            </label>
            <input
              id="add-custom-symbol"
              type="text"
              value={newSymbol}
              onChange={(e) => setNewSymbol(e.target.value.toUpperCase())}
              placeholder="e.g. NIFTY50, SOLUSD"
              className="flex-1 min-h-[40px] px-3 py-2 rounded-md border border-border bg-background text-sm font-num uppercase font-semibold placeholder:normal-case placeholder:font-sans placeholder:font-normal"
            />
            <button
              type="submit"
              disabled={updateSettings.isPending}
              className="min-h-[40px] inline-flex items-center gap-1 px-3.5 py-2 rounded-md bg-primary hover:bg-primary-hover text-on-primary text-xs font-semibold cursor-pointer transition-colors"
            >
              <Plus size={14} weight="bold" aria-hidden="true" />
              <span>Add</span>
            </button>
          </form>

          {symbolMsg && <p className="text-xs text-muted-fg">{symbolMsg}</p>}

          {(settings?.custom_symbols ?? []).length === 0 ? (
            <p className="text-xs text-muted-fg">No custom symbols added yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {(settings?.custom_symbols ?? []).map((sym) => (
                <span
                  key={sym}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted text-foreground text-xs font-num font-semibold"
                >
                  <span>{sym}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveSymbol(sym)}
                    aria-label={`Remove symbol ${sym}`}
                    className="p-0.5 text-muted-fg hover:text-loss cursor-pointer"
                  >
                    <X size={13} weight="bold" aria-hidden="true" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </section>

        {/* Custom Mistakes */}
        <section className="bg-card border border-border rounded-lg p-5 shadow-card space-y-4">
          <div>
            <h2 className="text-base font-semibold">Custom Mistakes</h2>
            <p className="text-xs text-muted-fg mt-0.5">
              {DEFAULT_MISTAKES.length} standard mistake tags are built in. Add personal tags here.
            </p>
          </div>

          <form onSubmit={handleAddMistake} className="flex gap-2">
            <label htmlFor="add-custom-mistake" className="sr-only">
              New custom mistake tag
            </label>
            <input
              id="add-custom-mistake"
              type="text"
              value={newMistake}
              onChange={(e) => setNewMistake(e.target.value)}
              placeholder="e.g. Traded during news"
              className="flex-1 min-h-[40px] px-3 py-2 rounded-md border border-border bg-background text-sm"
            />
            <button
              type="submit"
              disabled={updateSettings.isPending}
              className="min-h-[40px] inline-flex items-center gap-1 px-3.5 py-2 rounded-md bg-primary hover:bg-primary-hover text-on-primary text-xs font-semibold cursor-pointer transition-colors"
            >
              <Plus size={14} weight="bold" aria-hidden="true" />
              <span>Add</span>
            </button>
          </form>

          {mistakeMsg && <p className="text-xs text-muted-fg">{mistakeMsg}</p>}

          {(settings?.custom_mistakes ?? []).length === 0 ? (
            <p className="text-xs text-muted-fg">No custom mistakes added yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {(settings?.custom_mistakes ?? []).map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted text-foreground text-xs font-medium"
                >
                  <span>{tag}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveMistake(tag)}
                    aria-label={`Remove mistake ${tag}`}
                    className="p-0.5 text-muted-fg hover:text-loss cursor-pointer"
                  >
                    <X size={13} weight="bold" aria-hidden="true" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* 3. Export & Backup */}
      <section className="bg-card border border-border rounded-lg p-5 md:p-6 shadow-card space-y-4">
        <div className="border-b border-border pb-3">
          <h2 className="text-base font-semibold">Export &amp; Backup</h2>
          <p className="text-xs text-muted-fg mt-0.5">
            Dates in CSV and JSON backups use ISO YYYY-MM-DD format for reliable portability.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="border border-border rounded-md p-4 space-y-3 bg-background/50">
            <div>
              <h3 className="text-sm font-semibold">Trades CSV</h3>
              <p className="text-xs text-muted-fg mt-1 leading-relaxed">
                Exports all saved trades with signed P/L, currency, mistakes, notes, and screenshot references.
              </p>
            </div>
            <a
              href="/api/export/trades.csv"
              download="trades.csv"
              className="min-h-[38px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md border border-border bg-card text-foreground text-xs font-semibold hover:bg-muted transition-colors"
            >
              <DownloadSimple size={16} weight="bold" aria-hidden="true" />
              <span>Download trades.csv</span>
            </a>
          </div>

          <div className="border border-border rounded-md p-4 space-y-3 bg-background/50">
            <div>
              <h3 className="text-sm font-semibold">Full Backup (JSON)</h3>
              <p className="text-xs text-muted-fg mt-1 leading-relaxed">
                Complete versioned backup containing all trades, daily journal entries, and settings.
              </p>
            </div>
            <a
              href="/api/export/backup.json"
              download="tradelog-backup.json"
              className="min-h-[38px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-accent hover:bg-accent-hover text-on-accent text-xs font-semibold transition-colors"
            >
              <DownloadSimple size={16} weight="bold" aria-hidden="true" />
              <span>Download Backup JSON</span>
            </a>
          </div>
        </div>
      </section>

      {/* 4. Import / Restore JSON (Danger Zone clearly framed) */}
      <section className="bg-card border border-border rounded-lg p-5 md:p-6 shadow-card space-y-4">
        <div className="border-b border-border pb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Restore from JSON Backup</h2>
            <p className="text-xs text-muted-fg mt-0.5">
              Validates your backup and previews every change before modifying existing records.
            </p>
          </div>
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30 text-[11px] font-semibold shrink-0">
            <Warning size={12} weight="bold" aria-hidden="true" />
            Caution
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="min-h-[40px] inline-flex items-center gap-2 px-4 py-2 rounded-md border border-primary/50 text-primary text-xs font-semibold hover:bg-nav-active-bg transition-colors cursor-pointer">
            <UploadSimple size={16} weight="bold" aria-hidden="true" />
            <span>Select Backup JSON</span>
            <input
              type="file"
              accept="application/json,.json"
              onChange={handleFileChange}
              className="sr-only"
            />
          </label>
          {backupFileName && (
            <span className="text-xs font-num text-muted-fg font-medium">{backupFileName}</span>
          )}
        </div>

        {importError && (
          <div role="alert" className="flex items-center gap-2 rounded-lg border border-loss/30 bg-loss-bg px-4 py-3 text-xs font-medium text-loss">
            <WarningCircle size={16} weight="bold" aria-hidden="true" />
            <span>{importError}</span>
          </div>
        )}

        {importStatus && (
          <div role="status" className="flex items-center gap-2 rounded-lg border border-profit/30 bg-profit-bg px-4 py-3 text-xs font-medium text-profit">
            <CheckCircle size={16} weight="bold" aria-hidden="true" />
            <span>{importStatus}</span>
          </div>
        )}

        {previewResult && (
          <div className="rounded-lg border border-border bg-background/60 p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">Import Preview</h3>
              <span className="text-xs font-num text-muted-fg">
                Backup v{previewResult.version}
                {previewResult.exported_at
                  ? ` · Exported ${formatDate(previewResult.exported_at.slice(0, 10))}`
                  : ''}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="bg-card border border-border rounded-md p-3">
                <div className="font-semibold text-muted-fg uppercase text-[10px]">Trades</div>
                <div className="text-sm font-num font-bold mt-1">{previewResult.trades.total} in file</div>
                <div className="text-muted-fg font-num mt-0.5">
                  {previewResult.trades.new} new · {previewResult.trades.duplicate} existing
                </div>
              </div>

              <div className="bg-card border border-border rounded-md p-3">
                <div className="font-semibold text-muted-fg uppercase text-[10px]">Daily Journal</div>
                <div className="text-sm font-num font-bold mt-1">{previewResult.journal.total} in file</div>
                <div className="text-muted-fg font-num mt-0.5">
                  {previewResult.journal.new} new · {previewResult.journal.duplicate} existing
                </div>
              </div>

              <div className="bg-card border border-border rounded-md p-3">
                <div className="font-semibold text-muted-fg uppercase text-[10px]">Settings</div>
                <div className="text-sm font-bold mt-1">
                  {previewResult.settings.included ? 'Included' : 'Not included'}
                </div>
                {previewResult.settings.included && (
                  <div className="text-muted-fg font-num mt-0.5">
                    {previewResult.settings.currency ?? 'USD'} · +{previewResult.settings.customSymbolsCount} symbols · +{previewResult.settings.customMistakesCount} mistakes
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2.5 pt-2 border-t border-border">
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-muted-fg">
                Restore Strategy
              </span>

              <label
                className={cn(
                  'flex items-start gap-2.5 text-xs p-3 rounded-md border cursor-pointer transition-colors',
                  importMode === 'merge_skip'
                    ? 'bg-card border-primary/50'
                    : 'bg-card/50 border-border',
                )}
              >
                <input
                  type="radio"
                  name="import-mode"
                  checked={importMode === 'merge_skip'}
                  onChange={() => setImportMode('merge_skip')}
                  className="mt-0.5"
                />
                <span>
                  <strong className="text-foreground">Safe Merge — Keep Existing Records (Recommended):</strong>{' '}
                  Adds only new trades and new journal dates; merges custom symbols/mistakes. Existing trades, journal entries, and preferences are never overwritten.
                </span>
              </label>

              <label
                className={cn(
                  'flex items-start gap-2.5 text-xs p-3 rounded-md border cursor-pointer transition-colors',
                  importMode === 'merge_overwrite'
                    ? 'bg-loss-bg border-loss/50'
                    : 'bg-card/50 border-border',
                )}
              >
                <input
                  type="radio"
                  name="import-mode"
                  checked={importMode === 'merge_overwrite'}
                  onChange={() => setImportMode('merge_overwrite')}
                  className="mt-0.5"
                />
                <span>
                  <strong className="text-loss">Merge &amp; Overwrite Duplicates (Destructive on matching IDs):</strong>{' '}
                  Adds new records and replaces matching trade IDs, matching journal dates, and saved settings from the backup.
                </span>
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setPreviewResult(null);
                  setBackupData(null);
                  setBackupFileName(null);
                }}
                className="min-h-[38px] px-3.5 py-1.5 rounded-md border border-border text-xs font-semibold hover:bg-muted cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setConfirmRestoreOpen(true)}
                className={cn(
                  'min-h-[38px] px-4 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-colors',
                  importMode === 'merge_overwrite'
                    ? 'bg-destructive text-white hover:opacity-90'
                    : 'bg-accent hover:bg-accent-hover text-on-accent',
                )}
              >
                Apply Restore
              </button>
            </div>
          </div>
        )}
      </section>

      <ConfirmDialog
        open={confirmRestoreOpen}
        title={
          importMode === 'merge_overwrite'
            ? 'Update duplicates from backup?'
            : 'Apply safe merge restore?'
        }
        confirmLabel="Confirm Restore"
        description={
          previewResult
            ? importMode === 'merge_overwrite'
              ? `This will add ${previewResult.trades.new} new trade(s) and ${previewResult.journal.new} new journal entry/entries, AND overwrite ${previewResult.trades.duplicate} existing trade(s), ${previewResult.journal.duplicate} journal entry/entries, and settings.`
              : `This will safely add ${previewResult.trades.new} new trade(s) and ${previewResult.journal.new} new journal entry/entries, and merge custom symbols/mistakes without overwriting any existing records.`
            : ''
        }
        isLoading={applyImport.isPending}
        onConfirm={handleConfirmRestore}
        onCancel={() => setConfirmRestoreOpen(false)}
      />
    </div>
  );
}
