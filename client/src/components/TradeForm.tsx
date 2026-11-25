import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  Image as ImageIcon,
  Trash,
  UploadSimple,
  WarningCircle,
} from '@phosphor-icons/react';
import {
  CURRENCIES,
  DEFAULT_MISTAKES,
  DEFAULT_SYMBOLS,
  EMOTIONS,
  PLAN_FOLLOWED_OPTIONS,
} from '../lib/constants';
import { cn, todayISO } from '../lib/utils';
import {
  useCreateTrade,
  useDeleteScreenshot,
  useSettings,
  useUpdateTrade,
  useUploadScreenshots,
} from '../hooks/useTrades';
import type { Direction, PlanFollowed, Trade, TradeStatus } from '../types';

const QUICK_SYMBOLS = ['XAUUSD', 'EURUSD', 'GBPUSD', 'USDJPY', 'GBPJPY', 'BTCUSD'];

interface TradeFormProps {
  existingTrade?: Trade;
}

interface PendingFile {
  file: File;
  previewUrl: string;
}

export function TradeForm({ existingTrade }: TradeFormProps) {
  const navigate = useNavigate();
  const isEdit = Boolean(existingTrade);
  const { data: settings } = useSettings();

  const createTrade = useCreateTrade();
  const updateTrade = useUpdateTrade();
  const uploadScreenshots = useUploadScreenshots();
  const deleteScreenshot = useDeleteScreenshot();

  // Form fields
  const [tradeDate, setTradeDate] = useState(existingTrade?.trade_date ?? todayISO());
  const [symbol, setSymbol] = useState(existingTrade?.symbol ?? '');
  const [direction, setDirection] = useState<Direction>(existingTrade?.direction ?? 'Buy');
  const [status, setStatus] = useState<TradeStatus>(existingTrade?.status ?? 'Closed');
  const [entryPrice, setEntryPrice] = useState(
    existingTrade?.entry_price !== null && existingTrade?.entry_price !== undefined
      ? String(existingTrade.entry_price)
      : '',
  );
  const [exitPrice, setExitPrice] = useState(
    existingTrade?.exit_price !== null && existingTrade?.exit_price !== undefined
      ? String(existingTrade.exit_price)
      : '',
  );
  const [lotSize, setLotSize] = useState(
    existingTrade?.quantity_or_lot_size !== null && existingTrade?.quantity_or_lot_size !== undefined
      ? String(existingTrade.quantity_or_lot_size)
      : '',
  );
  const [realizedPnl, setRealizedPnl] = useState(
    existingTrade?.realized_pnl !== null && existingTrade?.realized_pnl !== undefined
      ? String(existingTrade.realized_pnl)
      : '',
  );
  const [currency, setCurrency] = useState(existingTrade?.currency ?? settings?.currency ?? 'USD');

  // Sync default currency once settings load on a brand-new trade
  useEffect(() => {
    if (!isEdit && settings?.currency) {
      setCurrency((prev) => (prev === 'USD' ? settings.currency : prev));
    }
  }, [isEdit, settings?.currency]);

  // Journaling fields (optional)
  const [setup, setSetup] = useState(existingTrade?.setup ?? '');
  const [entryReason, setEntryReason] = useState(existingTrade?.entry_reason ?? '');
  const [exitReason, setExitReason] = useState(existingTrade?.exit_reason ?? '');
  const [mistakes, setMistakes] = useState<string[]>(existingTrade?.mistakes ?? []);
  const [customMistake, setCustomMistake] = useState(existingTrade?.custom_mistake ?? '');
  const [showOtherMistake, setShowOtherMistake] = useState(
    Boolean(existingTrade?.custom_mistake) || (existingTrade?.mistakes ?? []).includes('Other'),
  );
  const [emotion, setEmotion] = useState<string>(existingTrade?.emotion ?? '');
  const [planFollowed, setPlanFollowed] = useState<PlanFollowed | ''>(existingTrade?.plan_followed ?? '');
  const [lesson, setLesson] = useState(existingTrade?.lesson ?? '');

  // Screenshots
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [existingScreenshots, setExistingScreenshots] = useState<string[]>(
    existingTrade?.screenshot_references ?? [],
  );

  // Sync if existingTrade arrives/updates
  useEffect(() => {
    if (existingTrade) {
      setExistingScreenshots(existingTrade.screenshot_references);
    }
  }, [existingTrade]);

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      pendingFiles.forEach((pf) => URL.revokeObjectURL(pf.previewUrl));
    };
  }, [pendingFiles]);

  // Errors & validation
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const errorSummaryRef = useRef<HTMLDivElement>(null);

  const allSymbols = useMemo(() => {
    const combined = [...DEFAULT_SYMBOLS, ...(settings?.custom_symbols ?? [])];
    return Array.from(new Set(combined));
  }, [settings?.custom_symbols]);

  const allMistakes = useMemo(() => {
    const combined = [...DEFAULT_MISTAKES, ...(settings?.custom_mistakes ?? [])];
    return Array.from(new Set(combined));
  }, [settings?.custom_mistakes]);

  const toggleMistake = (tag: string) => {
    setMistakes((prev) =>
      prev.includes(tag) ? prev.filter((m) => m !== tag) : [...prev, tag],
    );
  };

  const toggleOtherMistake = () => {
    if (showOtherMistake) {
      setShowOtherMistake(false);
      setCustomMistake('');
      setMistakes((prev) => prev.filter((m) => m !== 'Other'));
    } else {
      setShowOtherMistake(true);
      setMistakes((prev) => (prev.includes('Other') ? prev : [...prev, 'Other']));
    }
  };

  const handleFileSelect = (files: FileList | null) => {
    if (!files) return;
    const validImages: PendingFile[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) {
        setSubmitError(`"${file.name}" is not a supported image file.`);
        continue;
      }
      if (file.size > 10 * 1024 * 1024) {
        setSubmitError(`"${file.name}" exceeds the 10 MB size limit.`);
        continue;
      }
      validImages.push({ file, previewUrl: URL.createObjectURL(file) });
    }
    if (validImages.length > 0) {
      setPendingFiles((prev) => [...prev, ...validImages]);
    }
  };

  const removePendingFile = (idx: number) => {
    setPendingFiles((prev) => {
      const target = prev[idx];
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const handleDeleteExistingScreenshot = async (refPath: string) => {
    if (!existingTrade) return;
    setSubmitError(null);
    try {
      const updated = await deleteScreenshot.mutateAsync({
        tradeId: existingTrade.id,
        path: refPath,
      });
      setExistingScreenshots(updated.screenshot_references);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to remove screenshot');
    }
  };

  const validate = (): Record<string, string> => {
    const errors: Record<string, string> = {};
    if (!tradeDate) errors.tradeDate = 'Trade date is required.';
    if (!symbol.trim()) errors.symbol = 'Instrument / symbol is required.';

    const entryNum = Number(entryPrice);
    if (!entryPrice.trim() || !Number.isFinite(entryNum) || entryNum <= 0) {
      errors.entryPrice = 'Enter a valid positive entry price.';
    }

    if (status === 'Closed') {
      const exitNum = Number(exitPrice);
      if (!exitPrice.trim() || !Number.isFinite(exitNum) || exitNum <= 0) {
        errors.exitPrice = 'Exit price is required for a closed trade.';
      }
      const pnlNum = Number(realizedPnl);
      if (!realizedPnl.trim() || !Number.isFinite(pnlNum)) {
        errors.realizedPnl = 'Enter realized profit/loss (use 0 for breakeven).';
      }
    } else if (exitPrice.trim()) {
      const exitNum = Number(exitPrice);
      if (!Number.isFinite(exitNum) || exitNum <= 0) {
        errors.exitPrice = 'Exit price must be a positive number.';
      }
    }

    if (lotSize.trim()) {
      const lotNum = Number(lotSize);
      if (!Number.isFinite(lotNum) || lotNum <= 0) {
        errors.lotSize = 'Lot size / quantity must be greater than 0.';
      }
    }

    return errors;
  };

  const isSaving =
    createTrade.isPending || updateTrade.isPending || uploadScreenshots.isPending;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setTimeout(() => errorSummaryRef.current?.focus(), 0);
      return;
    }

    const cleanedMistakes = mistakes.filter((m) => m !== 'Other');
    const trimmedCustom = customMistake.trim();
    if (showOtherMistake && trimmedCustom) {
      cleanedMistakes.push('Other');
    }

    const payload = {
      trade_date: tradeDate,
      symbol: symbol.trim().toUpperCase(),
      direction,
      status,
      entry_price: Number(entryPrice),
      exit_price: exitPrice.trim() ? Number(exitPrice) : null,
      quantity_or_lot_size: lotSize.trim() ? Number(lotSize) : null,
      realized_pnl: status === 'Closed' ? Number(realizedPnl) : null,
      currency,
      setup: setup.trim() || null,
      entry_reason: entryReason.trim() || null,
      exit_reason: exitReason.trim() || null,
      mistakes: cleanedMistakes,
      custom_mistake: showOtherMistake && trimmedCustom ? trimmedCustom : null,
      emotion: emotion || null,
      plan_followed: planFollowed || null,
      lesson: lesson.trim() || null,
    };

    try {
      let savedTrade: Trade;
      if (isEdit && existingTrade) {
        savedTrade = await updateTrade.mutateAsync({
          id: existingTrade.id,
          payload,
        });
      } else {
        savedTrade = await createTrade.mutateAsync(payload);
      }

      if (pendingFiles.length > 0) {
        savedTrade = await uploadScreenshots.mutateAsync({
          tradeId: savedTrade.id,
          files: pendingFiles.map((pf) => pf.file),
        });
      }

      navigate(`/trades/${savedTrade.id}`, {
        state: {
          successMessage: isEdit
            ? 'Trade updated successfully.'
            : 'Trade saved to your journal.',
        },
      });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Unable to save trade.');
    }
  };

  const errorList = Object.entries(fieldErrors);

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(isEdit && existingTrade ? `/trades/${existingTrade.id}` : '/trades')}
            className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-sm border border-border bg-card hover:bg-muted transition-colors cursor-pointer"
            aria-label="Back to trades"
          >
            <ArrowLeft size={18} aria-hidden="true" />
          </button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {isEdit ? `Edit Trade — ${existingTrade?.symbol}` : 'Add Trade'}
            </h1>
            <p className="text-sm text-muted-fg">
              {isEdit
                ? 'Updates the existing trade record and all summaries.'
                : 'Log primary trade details fast; journaling notes are optional.'}
            </p>
          </div>
        </div>
      </div>

      {/* Validation Summary / Server Error */}
      {(errorList.length > 0 || submitError) && (
        <div
          ref={errorSummaryRef}
          tabIndex={-1}
          role="alert"
          className="bg-loss-bg border border-loss/30 rounded-md p-4 text-sm text-loss space-y-1.5"
        >
          <div className="flex items-center gap-2 font-semibold">
            <WarningCircle size={18} weight="bold" aria-hidden="true" />
            <span>{submitError || 'Please fix the highlighted fields:'}</span>
          </div>
          {errorList.length > 0 && (
            <ul className="list-disc pl-6 space-y-0.5 text-xs">
              {errorList.map(([key, msg]) => {
                const targetId: Record<string, string> = {
                  tradeDate: 'trade-date',
                  symbol: 'trade-symbol',
                  entryPrice: 'entry-price',
                  exitPrice: 'exit-price',
                  lotSize: 'lot-size',
                  realizedPnl: 'realized-pnl',
                };
                return (
                  <li key={key}>
                    <a href={`#${targetId[key] || ''}`} className="underline hover:opacity-80">
                      {msg}
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* Section 1: Trade Details */}
      <section className="bg-card border border-border rounded-md p-5 md:p-6 shadow-card space-y-5">
        <div className="border-b border-border pb-3">
          <h2 className="text-base font-bold">1. Trade Details</h2>
          <p className="text-xs text-muted-fg mt-0.5">
            Core execution details. Open trades are saved without realized P/L.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Trade Date */}
          <div>
            <label htmlFor="trade-date" className="block text-xs font-semibold uppercase tracking-wider text-muted-fg mb-1.5">
              Trade Date <span className="text-loss">*</span>
            </label>
            <input
              id="trade-date"
              type="date"
              value={tradeDate}
              onChange={(e) => setTradeDate(e.target.value)}
              aria-invalid={Boolean(fieldErrors.tradeDate)}
              className="w-full min-h-[42px] px-3 py-2 rounded-sm border border-border bg-background text-foreground text-sm"
            />
            {fieldErrors.tradeDate && (
              <p className="text-xs text-loss mt-1">{fieldErrors.tradeDate}</p>
            )}
          </div>

          {/* Direction */}
          <div>
            <span className="block text-xs font-semibold uppercase tracking-wider text-muted-fg mb-1.5">
              Direction <span className="text-loss">*</span>
            </span>
            <div className="grid grid-cols-2 gap-2">
              {(['Buy', 'Sell'] as const).map((dir) => (
                <button
                  key={dir}
                  type="button"
                  aria-pressed={direction === dir}
                  onClick={() => setDirection(dir)}
                  className={cn(
                    'min-h-[42px] rounded-sm border text-sm font-semibold transition-colors cursor-pointer',
                    direction === dir
                      ? dir === 'Buy'
                        ? 'bg-profit-bg border-profit text-profit'
                        : 'bg-loss-bg border-loss text-loss'
                      : 'bg-background border-border text-muted-fg hover:text-foreground',
                  )}
                >
                  {dir}
                </button>
              ))}
            </div>
          </div>

          {/* Result Status */}
          <div>
            <span className="block text-xs font-semibold uppercase tracking-wider text-muted-fg mb-1.5">
              Result Status <span className="text-loss">*</span>
            </span>
            <div className="grid grid-cols-2 gap-2">
              {(['Closed', 'Open'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  aria-pressed={status === st}
                  onClick={() => setStatus(st)}
                  className={cn(
                    'min-h-[42px] rounded-sm border text-sm font-semibold transition-colors cursor-pointer',
                    status === st
                      ? 'bg-primary text-on-primary border-primary'
                      : 'bg-background border-border text-muted-fg hover:text-foreground',
                  )}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Instrument / Symbol */}
        <div className="space-y-2">
          <label htmlFor="trade-symbol" className="block text-xs font-semibold uppercase tracking-wider text-muted-fg">
            Instrument / Symbol <span className="text-loss">*</span>
          </label>
          <input
            id="trade-symbol"
            list="trade-symbols-list"
            type="text"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            placeholder="Type or select (e.g. XAUUSD, EURUSD)"
            aria-invalid={Boolean(fieldErrors.symbol)}
            className="w-full min-h-[42px] px-3 py-2 rounded-sm border border-border bg-background text-foreground text-sm font-semibold uppercase placeholder:normal-case placeholder:font-normal"
          />
          <datalist id="trade-symbols-list">
            {allSymbols.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_SYMBOLS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSymbol(s)}
                className={cn(
                  'px-2.5 py-1 rounded-sm text-xs font-semibold border transition-colors cursor-pointer',
                  symbol === s
                    ? 'bg-primary text-on-primary border-primary'
                    : 'bg-muted/70 border-border text-foreground hover:bg-muted',
                )}
              >
                {s}
              </button>
            ))}
          </div>
          {fieldErrors.symbol && (
            <p className="text-xs text-loss">{fieldErrors.symbol}</p>
          )}
        </div>

        {/* Prices, Lots, P/L, Currency */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label htmlFor="entry-price" className="block text-xs font-semibold uppercase tracking-wider text-muted-fg mb-1.5">
              Entry Price <span className="text-loss">*</span>
            </label>
            <input
              id="entry-price"
              type="number"
              step="any"
              value={entryPrice}
              onChange={(e) => setEntryPrice(e.target.value)}
              placeholder="0.00"
              aria-invalid={Boolean(fieldErrors.entryPrice)}
              className="w-full min-h-[42px] px-3 py-2 rounded-sm border border-border bg-background text-foreground text-sm"
            />
            {fieldErrors.entryPrice && (
              <p className="text-xs text-loss mt-1">{fieldErrors.entryPrice}</p>
            )}
          </div>

          <div>
            <label htmlFor="exit-price" className="block text-xs font-semibold uppercase tracking-wider text-muted-fg mb-1.5">
              Exit Price {status === 'Closed' && <span className="text-loss">*</span>}
            </label>
            <input
              id="exit-price"
              type="number"
              step="any"
              value={exitPrice}
              onChange={(e) => setExitPrice(e.target.value)}
              placeholder={status === 'Open' ? 'Optional while open' : '0.00'}
              aria-invalid={Boolean(fieldErrors.exitPrice)}
              className="w-full min-h-[42px] px-3 py-2 rounded-sm border border-border bg-background text-foreground text-sm"
            />
            {fieldErrors.exitPrice && (
              <p className="text-xs text-loss mt-1">{fieldErrors.exitPrice}</p>
            )}
          </div>

          <div>
            <label htmlFor="lot-size" className="block text-xs font-semibold uppercase tracking-wider text-muted-fg mb-1.5">
              Lot / Qty
            </label>
            <input
              id="lot-size"
              type="number"
              step="any"
              value={lotSize}
              onChange={(e) => setLotSize(e.target.value)}
              placeholder="Optional"
              aria-invalid={Boolean(fieldErrors.lotSize)}
              className="w-full min-h-[42px] px-3 py-2 rounded-sm border border-border bg-background text-foreground text-sm"
            />
            {fieldErrors.lotSize && (
              <p className="text-xs text-loss mt-1">{fieldErrors.lotSize}</p>
            )}
          </div>

          <div>
            <label htmlFor="realized-pnl" className="block text-xs font-semibold uppercase tracking-wider text-muted-fg mb-1.5">
              Net P/L {status === 'Closed' && <span className="text-loss">*</span>}
            </label>
            <input
              id="realized-pnl"
              type="number"
              step="any"
              disabled={status === 'Open'}
              value={status === 'Open' ? '' : realizedPnl}
              onChange={(e) => setRealizedPnl(e.target.value)}
              placeholder={status === 'Open' ? 'Excluded while open' : '+150 or -75'}
              aria-invalid={Boolean(fieldErrors.realizedPnl)}
              className="w-full min-h-[42px] px-3 py-2 rounded-sm border border-border bg-background text-foreground text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            />
            {fieldErrors.realizedPnl && (
              <p className="text-xs text-loss mt-1">{fieldErrors.realizedPnl}</p>
            )}
          </div>

          <div>
            <label htmlFor="trade-currency" className="block text-xs font-semibold uppercase tracking-wider text-muted-fg mb-1.5">
              Currency
            </label>
            <select
              id="trade-currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full min-h-[42px] px-3 py-2 rounded-sm border border-border bg-background text-foreground text-sm font-medium"
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Section 2: Journaling & Mistakes */}
      <section className="bg-card border border-border rounded-md p-5 md:p-6 shadow-card space-y-5">
        <div className="border-b border-border pb-3">
          <h2 className="text-base font-bold">2. Journaling &amp; Mistakes (Optional)</h2>
          <p className="text-xs text-muted-fg mt-0.5">
            Capture your reasoning, emotions, mistakes, and chart screenshots.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="trade-setup" className="block text-xs font-semibold uppercase tracking-wider text-muted-fg mb-1.5">
              Setup / Strategy
            </label>
            <input
              id="trade-setup"
              type="text"
              value={setup}
              onChange={(e) => setSetup(e.target.value)}
              placeholder="e.g. London Breakout, Pullback to VWAP"
              className="w-full min-h-[42px] px-3 py-2 rounded-sm border border-border bg-background text-foreground text-sm"
            />
          </div>

          <div>
            <span className="block text-xs font-semibold uppercase tracking-wider text-muted-fg mb-1.5">
              Did I follow my trading plan?
            </span>
            <div className="grid grid-cols-3 gap-2">
              {PLAN_FOLLOWED_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  aria-pressed={planFollowed === opt}
                  onClick={() => setPlanFollowed((prev) => (prev === opt ? '' : opt))}
                  className={cn(
                    'min-h-[42px] rounded-sm border text-xs sm:text-sm font-semibold transition-colors cursor-pointer',
                    planFollowed === opt
                      ? 'bg-primary text-on-primary border-primary'
                      : 'bg-background border-border text-muted-fg hover:text-foreground',
                  )}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="entry-reason" className="block text-xs font-semibold uppercase tracking-wider text-muted-fg mb-1.5">
              Why did I enter this trade?
            </label>
            <textarea
              id="entry-reason"
              rows={3}
              value={entryReason}
              onChange={(e) => setEntryReason(e.target.value)}
              placeholder="Confluence, market structure, trigger..."
              className="w-full px-3 py-2 rounded-sm border border-border bg-background text-foreground text-sm"
            />
          </div>

          <div>
            <label htmlFor="exit-reason" className="block text-xs font-semibold uppercase tracking-wider text-muted-fg mb-1.5">
              Why did I exit this trade?
            </label>
            <textarea
              id="exit-reason"
              rows={3}
              value={exitReason}
              onChange={(e) => setExitReason(e.target.value)}
              placeholder="Hit TP, hit SL, manual close..."
              className="w-full px-3 py-2 rounded-sm border border-border bg-background text-foreground text-sm"
            />
          </div>
        </div>

        {/* Mistakes Multi-Select */}
        <div className="space-y-2.5">
          <span className="block text-xs font-semibold uppercase tracking-wider text-muted-fg">
            Mistakes Made (Select all that apply)
          </span>
          <div className="flex flex-wrap gap-2">
            {allMistakes.map((tag) => {
              const selected = mistakes.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggleMistake(tag)}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm border text-xs font-medium transition-colors cursor-pointer',
                    selected
                      ? 'bg-loss-bg border-loss text-loss font-semibold'
                      : 'bg-background border-border text-muted-fg hover:text-foreground hover:bg-muted/60',
                  )}
                >
                  {selected && <Check size={12} weight="bold" aria-hidden="true" />}
                  <span>{tag}</span>
                </button>
              );
            })}
            <button
              type="button"
              aria-pressed={showOtherMistake}
              onClick={toggleOtherMistake}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm border text-xs font-medium transition-colors cursor-pointer',
                showOtherMistake
                  ? 'bg-loss-bg border-loss text-loss font-semibold'
                  : 'bg-background border-border text-muted-fg hover:text-foreground hover:bg-muted/60',
              )}
            >
              {showOtherMistake && <Check size={12} weight="bold" aria-hidden="true" />}
              <span>Other (custom)</span>
            </button>
          </div>

          {showOtherMistake && (
            <div className="pt-1">
              <label htmlFor="custom-mistake" className="block text-xs font-medium text-muted-fg mb-1">
                Describe custom mistake
              </label>
              <input
                id="custom-mistake"
                type="text"
                value={customMistake}
                onChange={(e) => setCustomMistake(e.target.value)}
                placeholder="e.g. Held through high-impact news"
                className="w-full max-w-md min-h-[40px] px-3 py-2 rounded-sm border border-border bg-background text-foreground text-sm"
              />
            </div>
          )}
        </div>

        {/* Emotion */}
        <div className="space-y-2">
          <span className="block text-xs font-semibold uppercase tracking-wider text-muted-fg">
            Emotion During Trade
          </span>
          <div className="flex flex-wrap gap-2">
            {EMOTIONS.map((em) => {
              const selected = emotion === em;
              return (
                <button
                  key={em}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setEmotion((prev) => (prev === em ? '' : em))}
                  className={cn(
                    'px-3 py-1.5 rounded-sm border text-xs font-medium transition-colors cursor-pointer',
                    selected
                      ? 'bg-primary text-on-primary border-primary font-semibold'
                      : 'bg-background border-border text-muted-fg hover:text-foreground hover:bg-muted/60',
                  )}
                >
                  {em}
                </button>
              );
            })}
          </div>
        </div>

        {/* Lesson */}
        <div>
          <label htmlFor="trade-lesson" className="block text-xs font-semibold uppercase tracking-wider text-muted-fg mb-1.5">
            What did I learn from this trade?
          </label>
          <textarea
            id="trade-lesson"
            rows={2}
            value={lesson}
            onChange={(e) => setLesson(e.target.value)}
            placeholder="Key takeaway to remember next time..."
            className="w-full px-3 py-2 rounded-sm border border-border bg-background text-foreground text-sm"
          />
        </div>

        {/* Screenshots */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="block text-xs font-semibold uppercase tracking-wider text-muted-fg">
                Screenshots (Optional)
              </span>
              <p className="text-xs text-muted-fg">
                Attach one or more chart screenshots (JPG, PNG, GIF, WebP — max 10 MB each).
              </p>
            </div>
            <label className="min-h-[40px] inline-flex items-center gap-2 px-3.5 py-2 rounded-sm border border-primary text-primary text-xs font-semibold hover:bg-muted transition-colors cursor-pointer">
              <UploadSimple size={16} weight="bold" aria-hidden="true" />
              <span>Attach Images</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                multiple
                className="sr-only"
                onChange={(e) => {
                  handleFileSelect(e.target.files);
                  e.target.value = '';
                }}
              />
            </label>
          </div>

          {(existingScreenshots.length > 0 || pendingFiles.length > 0) && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {existingScreenshots.map((refPath) => (
                <div
                  key={refPath}
                  className="relative group rounded-sm border border-border overflow-hidden bg-background"
                >
                  <img
                    src={refPath}
                    alt="Trade screenshot"
                    className="w-full h-28 object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => handleDeleteExistingScreenshot(refPath)}
                    aria-label="Remove screenshot"
                    className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-destructive transition-colors cursor-pointer"
                  >
                    <Trash size={14} aria-hidden="true" />
                  </button>
                </div>
              ))}

              {pendingFiles.map((pf, idx) => (
                <div
                  key={pf.previewUrl}
                  className="relative rounded-sm border border-dashed border-primary overflow-hidden bg-background"
                >
                  <img
                    src={pf.previewUrl}
                    alt={pf.file.name}
                    className="w-full h-28 object-cover"
                  />
                  <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/70 text-white text-[10px] font-medium inline-flex items-center gap-1">
                    <ImageIcon size={10} aria-hidden="true" />
                    Pending
                  </span>
                  <button
                    type="button"
                    onClick={() => removePendingFile(idx)}
                    aria-label={`Remove ${pf.file.name}`}
                    className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-destructive transition-colors cursor-pointer"
                  >
                    <Trash size={14} aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Actions */}
      <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={() => navigate(isEdit && existingTrade ? `/trades/${existingTrade.id}` : '/trades')}
          className="min-h-[42px] px-4 py-2 rounded-sm border border-border bg-card text-sm font-semibold text-foreground hover:bg-muted transition-colors cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSaving}
          className="min-h-[42px] px-5 py-2 rounded-sm bg-accent hover:bg-accent-hover text-white text-sm font-semibold transition-colors cursor-pointer disabled:opacity-60"
        >
          {isSaving ? 'Saving…' : isEdit ? 'Update Trade' : 'Save Trade'}
        </button>
      </div>
    </form>
  );
}
