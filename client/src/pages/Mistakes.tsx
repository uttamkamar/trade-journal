import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Info, Warning, X } from '@phosphor-icons/react';
import {
  analyzeMistakes,
  cn,
  formatDate,
  formatSignedCurrency,
  getTradeMistakeTags,
} from '../lib/utils';
import { useSettings, useTrades } from '../hooks/useTrades';
import { PnlBadge } from '../components/PnlBadge';

export function Mistakes() {
  const {
    data: trades = [],
    isLoading: tradesLoading,
    isError: tradesError,
    error: tradesErrObj,
    refetch: refetchTrades,
  } = useTrades({ sort: 'newest' });
  const {
    data: settings,
    isLoading: settingsLoading,
    isError: settingsError,
    refetch: refetchSettings,
  } = useSettings();

  const currency = settings?.currency || 'USD';

  const { items, byMonth } = useMemo(() => analyzeMistakes(trades), [trades]);
  const [selectedMistake, setSelectedMistake] = useState<string | null>(null);

  // Keep selection valid or auto-select the most repeated mistake
  useEffect(() => {
    if (items.length === 0) {
      setSelectedMistake(null);
      return;
    }
    if (!selectedMistake || !items.some((i) => i.mistake === selectedMistake)) {
      setSelectedMistake(items[0].mistake);
    }
  }, [items, selectedMistake]);

  const activeStat = useMemo(
    () => items.find((i) => i.mistake === selectedMistake) ?? null,
    [items, selectedMistake],
  );

  if (tradesLoading || settingsLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Mistake Analysis</h1>
          <p className="text-sm text-muted-fg mt-0.5">Loading mistake records…</p>
        </div>
        <div className="h-48 rounded-lg bg-card border border-border animate-pulse" />
      </div>
    );
  }

  if (tradesError || settingsError) {
    return (
      <div role="alert" className="bg-loss-bg border border-loss/30 rounded-lg p-6 text-center space-y-3">
        <p className="text-sm text-loss font-medium">
          {tradesErrObj instanceof Error ? tradesErrObj.message : 'Failed to load mistake analysis.'}
        </p>
        <button
          type="button"
          onClick={() => {
            refetchTrades();
            refetchSettings();
          }}
          className="px-4 py-2 rounded-md border border-border bg-card text-sm font-semibold cursor-pointer"
        >
          Retry
        </button>
      </div>
    );
  }

  const maxCount = items[0]?.count ?? 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Mistake Analysis</h1>
        <p className="text-sm text-muted-fg mt-0.5">
          Patterns from the mistake tags you recorded on your trades.
        </p>
      </div>

      {/* Neutral framing notice */}
      <div className="flex items-start gap-2.5 rounded-lg border border-border bg-muted/60 px-4 py-3 text-xs text-muted-fg leading-relaxed">
        <Info size={16} aria-hidden="true" className="shrink-0 text-primary mt-0.5" />
        <span>
          Figures below summarize trades you explicitly tagged with each mistake. Associated P/L includes closed tagged trades only (open trades are excluded) and shows correlation, not causation.
        </span>
      </div>

      {items.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-10 text-center space-y-3 shadow-card">
          <div className="w-11 h-11 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-fg">
            <Warning size={22} aria-hidden="true" />
          </div>
          <h2 className="text-base font-semibold">No mistakes tagged yet</h2>
          <p className="text-sm text-muted-fg max-w-md mx-auto">
            When you add or edit a trade, tag any mistakes made (such as &ldquo;Entered too early&rdquo; or &ldquo;FOMO entry&rdquo;) to spot recurring habits here.
          </p>
          <Link
            to="/trades"
            className="inline-flex items-center px-4 py-2 rounded-md border border-border text-sm font-semibold hover:bg-muted"
          >
            Go to Trades
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            {/* Most Repeated Mistakes Ranking */}
            <section className="bg-card border border-border rounded-lg shadow-card overflow-hidden">
              <div className="px-5 py-3.5 border-b border-border flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold">Most Repeated Mistakes</h2>
                <span className="text-xs text-muted-fg">Click a row to inspect</span>
              </div>

              <div className="divide-y divide-border">
                {items.map((item, idx) => {
                  const selected = item.mistake === selectedMistake;
                  const barPct = Math.round((item.count / maxCount) * 100);
                  const hasMixed =
                    item.currencies.length > 1 ||
                    (item.currencies.length === 1 && item.currencies[0] !== currency);

                  const barColor =
                    item.closedCount === 0
                      ? 'bg-muted-fg/60'
                      : item.associatedNetPnl < 0
                      ? 'bg-loss/80'
                      : item.associatedNetPnl > 0
                      ? 'bg-profit/80'
                      : 'bg-muted-fg/60';

                  return (
                    <button
                      key={item.mistake}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setSelectedMistake(item.mistake)}
                      className={cn(
                        'w-full text-left px-5 py-3.5 transition-colors cursor-pointer space-y-2',
                        selected ? 'nav-active-bg' : 'hover:bg-muted/35',
                      )}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs font-num font-semibold text-muted-fg w-6 shrink-0">
                            #{idx + 1}
                          </span>
                          <span className="font-semibold text-sm text-foreground truncate">
                            {item.mistake}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 shrink-0 ml-auto">
                          <span className="px-2 py-0.5 rounded-md bg-muted text-foreground text-xs font-num font-medium">
                            {item.count} trade{item.count === 1 ? '' : 's'}
                          </span>
                          <span
                            className={cn(
                              'text-xs font-num font-semibold min-w-[92px] text-right',
                              item.closedCount === 0
                                ? 'text-muted-fg'
                                : item.associatedNetPnl > 0
                                ? 'text-profit'
                                : item.associatedNetPnl < 0
                                ? 'text-loss'
                                : 'text-muted-fg',
                            )}
                          >
                            {item.closedCount === 0
                              ? 'Open only'
                              : formatSignedCurrency(
                                  item.associatedNetPnl,
                                  item.currencies.length === 1 ? item.currencies[0] : currency,
                                )}
                          </span>
                        </div>
                      </div>

                      {/* Frequency bar */}
                      <div className="flex items-center gap-2.5">
                        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className={cn('h-full rounded-full transition-all', barColor)}
                            style={{ width: `${barPct}%` }}
                          />
                        </div>
                        <span className="text-[11px] font-num text-muted-fg shrink-0">
                          {item.closedCount} closed
                          {item.openCount > 0 ? ` · ${item.openCount} open` : ''}
                          {hasMixed && item.currencies.length > 1
                            ? ` (${item.currencies.join('/')})`
                            : ''}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Drill-Down: Related Trades */}
            <section className="bg-card border border-border rounded-lg shadow-card overflow-hidden">
              <div className="px-5 py-3.5 border-b border-border flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold truncate">
                    {activeStat
                      ? `Trades tagged with "${activeStat.mistake}"`
                      : 'Select a mistake'}
                  </h2>
                  {activeStat && (
                    <p className="text-xs text-muted-fg mt-0.5">
                      <span className="font-num">{activeStat.count}</span> trade{activeStat.count === 1 ? '' : 's'} · Associated closed P/L:{' '}
                      <strong className="text-foreground font-num">
                        {activeStat.closedCount === 0
                          ? '--- (no closed trades)'
                          : formatSignedCurrency(
                              activeStat.associatedNetPnl,
                              activeStat.currencies.length === 1
                                ? activeStat.currencies[0]
                                : currency,
                            )}
                      </strong>
                    </p>
                  )}
                </div>
                {activeStat && (
                  <button
                    type="button"
                    onClick={() => setSelectedMistake(null)}
                    aria-label="Clear selected mistake"
                    className="p-1.5 rounded-md text-muted-fg hover:text-foreground hover:bg-muted cursor-pointer"
                  >
                    <X size={16} aria-hidden="true" />
                  </button>
                )}
              </div>

              {!activeStat ? (
                <div className="p-8 text-center text-sm text-muted-fg">
                  Select a mistake from the ranking to view its tagged trades.
                </div>
              ) : (
                <div className="divide-y divide-border max-h-[460px] overflow-y-auto">
                  {activeStat.trades.map((trade) => {
                    const tags = getTradeMistakeTags(trade);
                    return (
                      <Link
                        key={trade.id}
                        to={`/trades/${trade.id}`}
                        className="block px-5 py-3.5 hover:bg-muted/35 transition-colors space-y-2"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <span className="text-xs font-num text-muted-fg">
                              {formatDate(trade.trade_date)}
                            </span>
                            <span className="font-semibold font-num text-sm">{trade.symbol}</span>
                            <span
                              className={`text-xs font-semibold ${
                                trade.direction === 'Buy' ? 'text-profit' : 'text-loss'
                              }`}
                            >
                              {trade.direction}
                            </span>
                          </div>

                          <PnlBadge
                            pnl={trade.realized_pnl}
                            currency={trade.currency}
                            status={trade.status}
                          />
                        </div>

                        {trade.setup && (
                          <div className="text-xs text-muted-fg">Setup: {trade.setup}</div>
                        )}

                        <div className="flex flex-wrap gap-1.5">
                          {tags.map((t) => (
                            <span
                              key={t}
                              className={cn(
                                'px-2 py-0.5 rounded-md text-[11px] font-medium',
                                t === activeStat.mistake
                                  ? 'bg-loss-bg text-loss font-semibold'
                                  : 'bg-muted text-muted-fg',
                              )}
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </section>
          </div>

          {/* Mistakes by Month */}
          <section className="bg-card border border-border rounded-lg shadow-card overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border">
              <h2 className="text-sm font-semibold">Mistakes by Month</h2>
            </div>

            <div className="divide-y divide-border">
              {byMonth.map((m) => (
                <div key={m.month} className="px-5 py-4 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold">{m.label}</h3>
                    <span className="text-xs font-num font-medium text-muted-fg">
                      {m.totalOccurrences} tagged occurrence{m.totalOccurrences === 1 ? '' : 's'}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {m.breakdown.map((b) => (
                      <button
                        key={b.mistake}
                        type="button"
                        onClick={() => setSelectedMistake(b.mistake)}
                        className={cn(
                          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-medium transition-colors cursor-pointer',
                          selectedMistake === b.mistake
                            ? 'bg-primary text-on-primary border-primary'
                            : 'bg-background border-border text-foreground hover:bg-muted',
                        )}
                      >
                        <span>{b.mistake}</span>
                        <span className="font-num font-semibold opacity-80">×{b.count}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
