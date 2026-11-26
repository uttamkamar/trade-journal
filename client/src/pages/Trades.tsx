import { useMemo, useState } from 'react';
import { Link, useLocation, useMatch, useNavigate, useParams } from 'react-router-dom';
import {
  CheckCircle,
  Eye,
  Funnel,
  MagnifyingGlass,
  PencilSimple,
  Plus,
  Pulse,
  Trash,
  X,
} from '@phosphor-icons/react';
import { DEFAULT_MISTAKES, DEFAULT_SYMBOLS } from '../lib/constants';
import { cn, formatDate } from '../lib/utils';
import {
  useDeleteTrade,
  useSettings,
  useTrade,
  useTrades,
  type TradeFilters,
} from '../hooks/useTrades';
import { PnlBadge } from '../components/PnlBadge';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { TradeForm } from '../components/TradeForm';
import { TradeDetail } from '../components/TradeDetail';
import type { Direction, Trade, TradeStatus } from '../types';

const INITIAL_FILTERS: TradeFilters = {
  search: '',
  symbol: '',
  direction: '',
  status: '',
  pnl: '',
  mistake: '',
  date_from: '',
  date_to: '',
  sort: 'newest',
};

export function Trades() {
  const isNew = Boolean(useMatch('/trades/new'));
  const isEdit = Boolean(useMatch('/trades/:id/edit'));
  const { id } = useParams<{ id: string }>();

  // Route sub-views: /trades/new, /trades/:id/edit, /trades/:id
  if (isNew) {
    return <TradeForm />;
  }

  if (id) {
    return <TradeByIdView id={id} isEdit={isEdit} />;
  }

  return <TradeHistoryList />;
}

function TradeByIdView({ id, isEdit }: { id: string; isEdit: boolean }) {
  const navigate = useNavigate();
  const { data: trade, isLoading, isError, error } = useTrade(id);

  if (isLoading) {
    return (
      <div className="bg-card border border-border rounded-lg p-8 text-center text-sm text-muted-fg">
        Loading trade…
      </div>
    );
  }

  if (isError || !trade) {
    return (
      <div className="bg-card border border-border rounded-lg p-8 text-center space-y-3">
        <p className="text-sm text-loss font-medium">
          {error instanceof Error ? error.message : 'Trade not found.'}
        </p>
        <button
          type="button"
          onClick={() => navigate('/trades')}
          className="px-4 py-2 rounded-md border border-border text-sm font-semibold hover:bg-muted cursor-pointer"
        >
          Back to Trades
        </button>
      </div>
    );
  }

  return isEdit ? <TradeForm existingTrade={trade} /> : <TradeDetail trade={trade} />;
}

function TradeHistoryList() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as { successMessage?: string } | null;

  const [filters, setFilters] = useState<TradeFilters>(INITIAL_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [tradeToDelete, setTradeToDelete] = useState<Trade | null>(null);
  const [bannerMessage, setBannerMessage] = useState<string | null>(
    state?.successMessage ?? null,
  );
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const { data: trades = [], isLoading, isError, error, refetch } = useTrades(filters);
  const { data: settings } = useSettings();
  const deleteTrade = useDeleteTrade();

  const symbolOptions = useMemo(() => {
    const fromTrades = trades.map((t) => t.symbol);
    return Array.from(
      new Set([...DEFAULT_SYMBOLS, ...(settings?.custom_symbols ?? []), ...fromTrades]),
    ).sort();
  }, [trades, settings?.custom_symbols]);

  const mistakeOptions = useMemo(() => {
    return Array.from(
      new Set([...DEFAULT_MISTAKES, ...(settings?.custom_mistakes ?? []), 'Other']),
    );
  }, [settings?.custom_mistakes]);

  const activeFilterCount = [
    filters.symbol,
    filters.direction,
    filters.status,
    filters.pnl,
    filters.mistake,
    filters.date_from,
    filters.date_to,
  ].filter(Boolean).length;

  const hasAnyFilter = Boolean(filters.search) || activeFilterCount > 0;

  const resetFilters = () => setFilters(INITIAL_FILTERS);

  const confirmDelete = async () => {
    if (!tradeToDelete) return;
    setDeleteError(null);
    try {
      await deleteTrade.mutateAsync(tradeToDelete.id);
      setBannerMessage(
        `Deleted ${tradeToDelete.symbol} trade (${formatDate(tradeToDelete.trade_date)}).`,
      );
      setTradeToDelete(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete trade.');
      setTradeToDelete(null);
    }
  };

  const renderMistakeChips = (trade: Trade) => {
    const tags = [
      ...trade.mistakes.filter((m) => m !== 'Other'),
      ...(trade.custom_mistake ? [trade.custom_mistake] : []),
    ];
    if (tags.length === 0) return <span className="text-xs text-muted-fg">—</span>;
    const shown = tags.slice(0, 2);
    const extra = tags.length - shown.length;
    return (
      <div className="flex flex-wrap gap-1">
        {shown.map((m) => (
          <span
            key={m}
            className="px-2 py-0.5 rounded-md bg-muted text-muted-fg text-[11px] font-medium whitespace-nowrap"
          >
            {m}
          </span>
        ))}
        {extra > 0 && (
          <span className="px-1.5 py-0.5 rounded-md bg-muted text-muted-fg text-[11px] font-num font-semibold">
            +{extra}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* Header — relies on top bar CTA to avoid stacked duplicate buttons */}
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Trades</h1>
          <p className="text-sm text-muted-fg mt-0.5">
            {isLoading ? (
              'Loading trade history…'
            ) : (
              <>
                <span className="font-num font-medium text-foreground">{trades.length}</span>{' '}
                trade{trades.length === 1 ? '' : 's'} shown
              </>
            )}
          </p>
        </div>
      </div>

      {/* Feedback Banner */}
      {bannerMessage && (
        <div
          role="status"
          className="flex items-center justify-between gap-2 bg-profit-bg border border-profit/30 text-profit rounded-lg px-4 py-3 text-sm font-medium"
        >
          <div className="flex flex-wrap items-center gap-2">
            <CheckCircle size={18} weight="bold" aria-hidden="true" />
            <span>{bannerMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setBannerMessage(null)}
            aria-label="Dismiss message"
            className="p-1 hover:opacity-75 cursor-pointer"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      )}

      {deleteError && (
        <div role="alert" className="bg-loss-bg border border-loss/30 text-loss rounded-lg px-4 py-3 text-sm font-medium">
          {deleteError}
        </div>
      )}

      {/* Search, Sort & Filter Controls */}
      <div className="bg-card border border-border rounded-lg p-3.5 sm:p-4 shadow-card space-y-3">
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <MagnifyingGlass
              size={16}
              aria-hidden="true"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-fg pointer-events-none"
            />
            <input
              type="search"
              aria-label="Search trades by symbol or notes"
              value={filters.search ?? ''}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
              placeholder="Search symbol, setup, notes, lessons…"
              className="w-full min-h-[40px] pl-9 pr-3 py-2 rounded-md border border-border bg-background text-sm"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Sort trades"
              value={filters.sort ?? 'newest'}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  sort: e.target.value as TradeFilters['sort'],
                }))
              }
              className="min-h-[40px] px-3 py-2 rounded-md border border-border bg-background text-sm font-medium"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="pnl_desc">Highest P/L</option>
              <option value="pnl_asc">Lowest P/L</option>
            </select>

            <button
              type="button"
              aria-expanded={showFilters}
              onClick={() => setShowFilters((s) => !s)}
              className={cn(
                'min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md border text-sm font-semibold transition-colors cursor-pointer',
                showFilters || activeFilterCount > 0
                  ? 'nav-active-bg border-primary/40 text-primary'
                  : 'border-border bg-background text-foreground hover:bg-muted',
              )}
            >
              <Funnel size={16} aria-hidden="true" />
              <span>Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}</span>
            </button>

            {hasAnyFilter && (
              <button
                type="button"
                onClick={resetFilters}
                className="min-h-[40px] px-3 py-2 rounded-md text-xs font-semibold text-primary hover:bg-muted transition-colors cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-border">
            <div>
              <label htmlFor="filter-date-from" className="block text-[11px] font-semibold uppercase tracking-wider text-muted-fg mb-1">
                From Date
              </label>
              <input
                id="filter-date-from"
                type="date"
                value={filters.date_from ?? ''}
                onChange={(e) => setFilters((f) => ({ ...f, date_from: e.target.value }))}
                className="w-full min-h-[38px] px-2.5 py-1.5 rounded-md border border-border bg-background text-sm font-num"
              />
            </div>

            <div>
              <label htmlFor="filter-date-to" className="block text-[11px] font-semibold uppercase tracking-wider text-muted-fg mb-1">
                To Date
              </label>
              <input
                id="filter-date-to"
                type="date"
                value={filters.date_to ?? ''}
                onChange={(e) => setFilters((f) => ({ ...f, date_to: e.target.value }))}
                className="w-full min-h-[38px] px-2.5 py-1.5 rounded-md border border-border bg-background text-sm font-num"
              />
            </div>

            <div>
              <label htmlFor="filter-symbol" className="block text-[11px] font-semibold uppercase tracking-wider text-muted-fg mb-1">
                Symbol
              </label>
              <select
                id="filter-symbol"
                value={filters.symbol ?? ''}
                onChange={(e) => setFilters((f) => ({ ...f, symbol: e.target.value }))}
                className="w-full min-h-[38px] px-2.5 py-1.5 rounded-md border border-border bg-background text-sm"
              >
                <option value="">All symbols</option>
                {symbolOptions.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="filter-direction" className="block text-[11px] font-semibold uppercase tracking-wider text-muted-fg mb-1">
                Buy / Sell
              </label>
              <select
                id="filter-direction"
                value={filters.direction ?? ''}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, direction: e.target.value as Direction | '' }))
                }
                className="w-full min-h-[38px] px-2.5 py-1.5 rounded-md border border-border bg-background text-sm"
              >
                <option value="">All directions</option>
                <option value="Buy">Buy</option>
                <option value="Sell">Sell</option>
              </select>
            </div>

            <div>
              <label htmlFor="filter-pnl" className="block text-[11px] font-semibold uppercase tracking-wider text-muted-fg mb-1">
                Outcome
              </label>
              <select
                id="filter-pnl"
                value={filters.pnl ?? ''}
                onChange={(e) =>
                  setFilters((f) => ({
                    ...f,
                    pnl: e.target.value as TradeFilters['pnl'],
                  }))
                }
                className="w-full min-h-[38px] px-2.5 py-1.5 rounded-md border border-border bg-background text-sm"
              >
                <option value="">All outcomes</option>
                <option value="profit">Profit</option>
                <option value="loss">Loss</option>
                <option value="breakeven">Breakeven</option>
              </select>
            </div>

            <div>
              <label htmlFor="filter-status" className="block text-[11px] font-semibold uppercase tracking-wider text-muted-fg mb-1">
                Status
              </label>
              <select
                id="filter-status"
                value={filters.status ?? ''}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, status: e.target.value as TradeStatus | '' }))
                }
                className="w-full min-h-[38px] px-2.5 py-1.5 rounded-md border border-border bg-background text-sm"
              >
                <option value="">Open &amp; Closed</option>
                <option value="Closed">Closed</option>
                <option value="Open">Open</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="filter-mistake" className="block text-[11px] font-semibold uppercase tracking-wider text-muted-fg mb-1">
                Mistake
              </label>
              <select
                id="filter-mistake"
                value={filters.mistake ?? ''}
                onChange={(e) => setFilters((f) => ({ ...f, mistake: e.target.value }))}
                className="w-full min-h-[38px] px-2.5 py-1.5 rounded-md border border-border bg-background text-sm"
              >
                <option value="">All mistakes</option>
                {mistakeOptions.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Loading / Error / Empty */}
      {isLoading ? (
        <div className="bg-card border border-border rounded-lg p-10 text-center text-sm text-muted-fg">
          Loading trades…
        </div>
      ) : isError ? (
        <div role="alert" className="bg-loss-bg border border-loss/30 rounded-lg p-6 text-center space-y-3">
          <p className="text-sm text-loss font-medium">
            {error instanceof Error ? error.message : 'Failed to load trades.'}
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="px-4 py-2 rounded-md border border-border bg-card text-sm font-semibold cursor-pointer"
          >
            Retry
          </button>
        </div>
      ) : trades.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-10 text-center space-y-3 shadow-card">
          <div className="w-11 h-11 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-fg">
            <Pulse size={22} aria-hidden="true" />
          </div>
          <h2 className="text-base font-semibold">
            {hasAnyFilter ? 'No trades match your filters' : 'No trades recorded yet'}
          </h2>
          <p className="text-sm text-muted-fg max-w-md mx-auto">
            {hasAnyFilter
              ? 'Try clearing or adjusting your search and filter criteria.'
              : 'Add your first trade to start tracking your decisions, emotions, and profit/loss.'}
          </p>
          {hasAnyFilter ? (
            <button
              type="button"
              onClick={resetFilters}
              className="px-4 py-2 rounded-md border border-border text-sm font-semibold hover:bg-muted cursor-pointer"
            >
              Reset filters
            </button>
          ) : (
            <button
              type="button"
              onClick={() => navigate('/trades/new')}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-accent hover:bg-accent-hover text-on-accent text-sm font-semibold cursor-pointer"
            >
              <Plus size={16} weight="bold" aria-hidden="true" />
              <span>Add First Trade</span>
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Desktop Table (lg+) */}
          <div
            tabIndex={0}
            role="region"
            aria-label="Trade history table"
            className="hidden lg:block bg-card border border-border rounded-lg shadow-card overflow-x-auto"
          >
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-muted/45 border-b border-border text-[11px] font-semibold uppercase tracking-wider text-muted-fg">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Symbol</th>
                  <th className="py-3 px-4">Side</th>
                  <th className="py-3 px-4">Setup</th>
                  <th className="py-3 px-4 text-right">P/L</th>
                  <th className="py-3 px-4">Mistakes</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-sm">
                {trades.map((trade) => (
                  <tr
                    key={trade.id}
                    onClick={() => navigate(`/trades/${trade.id}`)}
                    className="hover:bg-muted/35 transition-colors cursor-pointer"
                  >
                    <td className="py-3 px-4 whitespace-nowrap text-muted-fg text-xs font-num">
                      {formatDate(trade.trade_date)}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <Link
                        to={`/trades/${trade.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="font-semibold font-num text-xs tracking-wide text-foreground hover:text-primary hover:underline"
                      >
                        {trade.symbol}
                      </Link>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`text-xs font-semibold ${
                          trade.direction === 'Buy' ? 'text-profit' : 'text-loss'
                        }`}
                      >
                        {trade.direction}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs text-muted-fg max-w-[180px] truncate">
                      {trade.setup || '—'}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-right">
                      <PnlBadge
                        pnl={trade.realized_pnl}
                        currency={trade.currency}
                        status={trade.status}
                      />
                    </td>
                    <td className="py-3 px-4">{renderMistakeChips(trade)}</td>
                    <td className="py-3 px-4 whitespace-nowrap text-xs font-medium text-muted-fg">
                      {trade.status}
                    </td>
                    <td
                      className="py-3 px-4 whitespace-nowrap text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => navigate(`/trades/${trade.id}`)}
                          aria-label={`View ${trade.symbol} trade`}
                          title="View"
                          className="p-2 rounded-md text-muted-fg hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                        >
                          <Eye size={16} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => navigate(`/trades/${trade.id}/edit`)}
                          aria-label={`Edit ${trade.symbol} trade`}
                          title="Edit"
                          className="p-2 rounded-md text-muted-fg hover:text-primary hover:bg-muted transition-colors cursor-pointer"
                        >
                          <PencilSimple size={16} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setTradeToDelete(trade)}
                          aria-label={`Delete ${trade.symbol} trade`}
                          title="Delete"
                          className="p-2 rounded-md text-muted-fg hover:text-loss hover:bg-loss-bg transition-colors cursor-pointer"
                        >
                          <Trash size={16} aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile & Tablet Compact Trade Cards (< lg) */}
          <div className="lg:hidden grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {trades.map((trade) => (
              <article
                key={trade.id}
                onClick={() => navigate(`/trades/${trade.id}`)}
                className="bg-card border border-border rounded-lg p-4 shadow-card space-y-3 cursor-pointer"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold font-num text-base">{trade.symbol}</span>
                      <span
                        className={`text-xs font-semibold ${
                          trade.direction === 'Buy' ? 'text-profit' : 'text-loss'
                        }`}
                      >
                        {trade.direction}
                      </span>
                      <span className="text-xs text-muted-fg">· {trade.status}</span>
                    </div>
                    <div className="text-xs text-muted-fg truncate">
                      <span className="font-num">{formatDate(trade.trade_date)}</span>
                      {trade.setup ? ` · ${trade.setup}` : ''}
                    </div>
                  </div>

                  <PnlBadge
                    pnl={trade.realized_pnl}
                    currency={trade.currency}
                    status={trade.status}
                  />
                </div>

                {(trade.mistakes.length > 0 || trade.custom_mistake) && (
                  <div>{renderMistakeChips(trade)}</div>
                )}

                <div
                  className="grid grid-cols-3 gap-2 pt-2.5 border-t border-border"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => navigate(`/trades/${trade.id}`)}
                    className="min-h-[40px] px-3 rounded-md border border-border text-xs font-semibold inline-flex items-center justify-center gap-1.5 hover:bg-muted cursor-pointer"
                  >
                    <Eye size={15} aria-hidden="true" />
                    <span>View</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate(`/trades/${trade.id}/edit`)}
                    className="min-h-[40px] px-3 rounded-md border border-border text-xs font-semibold inline-flex items-center justify-center gap-1.5 hover:bg-muted cursor-pointer"
                  >
                    <PencilSimple size={15} aria-hidden="true" />
                    <span>Edit</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTradeToDelete(trade)}
                    className="min-h-[40px] px-3 rounded-md border border-loss/30 bg-loss-bg text-loss text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Trash size={15} aria-hidden="true" />
                    <span>Delete</span>
                  </button>
                </div>
              </article>
            ))}
          </div>
        </>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={Boolean(tradeToDelete)}
        title="Delete trade?"
        description={
          tradeToDelete
            ? `Are you sure you want to delete your ${tradeToDelete.symbol} (${tradeToDelete.direction}) trade from ${formatDate(tradeToDelete.trade_date)}? This cannot be undone.`
            : ''
        }
        isLoading={deleteTrade.isPending}
        onConfirm={confirmDelete}
        onCancel={() => setTradeToDelete(null)}
      />
    </div>
  );
}
