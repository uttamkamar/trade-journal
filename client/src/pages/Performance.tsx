import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowDown,
  ArrowUp,
  ChartBar,
  Info,
  Minus,
  Plus,
} from '@phosphor-icons/react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  buildCumulativePnlSeries,
  buildDailyPnlSeries,
  buildMonthlyPnlSeries,
  cn,
  computeSummary,
  filterTradesByDateRange,
  formatAxisCurrency,
  formatCurrency,
  formatDate,
  formatSignedCurrency,
  getDateRangeForPreset,
  getMixedCurrencies,
  todayISO,
  type TimeFilterPreset,
} from '../lib/utils';
import { useSettings, useTrades } from '../hooks/useTrades';
import { SignedPnlBarShape } from '../components/SignedPnlBarShape';

const TIME_PRESETS: Array<{ id: TimeFilterPreset; label: string }> = [
  { id: 'today', label: 'Today' },
  { id: 'this_week', label: 'This week' },
  { id: 'this_month', label: 'This month' },
  { id: 'last_month', label: 'Last month' },
  { id: 'this_year', label: 'This year' },
  { id: 'all_time', label: 'All time' },
  { id: 'custom', label: 'Custom' },
];

export function Performance() {
  const today = todayISO();
  const [preset, setPreset] = useState<TimeFilterPreset>('all_time');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const {
    data: trades = [],
    isLoading: tradesLoading,
    isError: tradesError,
    error: tradesErrObj,
    refetch: refetchTrades,
  } = useTrades({ sort: 'oldest' });
  const {
    data: settings,
    isLoading: settingsLoading,
    isError: settingsError,
    refetch: refetchSettings,
  } = useSettings();

  const currency = settings?.currency || 'USD';

  const { from, to, invalidCustomRange } = useMemo(() => {
    if (preset === 'custom') {
      const invalid = Boolean(customFrom && customTo && customFrom > customTo);
      return {
        from: customFrom || null,
        to: customTo || null,
        invalidCustomRange: invalid,
      };
    }
    const range = getDateRangeForPreset(preset, today);
    return { ...range, invalidCustomRange: false };
  }, [preset, customFrom, customTo, today]);

  const filteredTrades = useMemo(() => {
    if (invalidCustomRange) return [];
    return filterTradesByDateRange(trades, from, to);
  }, [trades, from, to, invalidCustomRange]);

  const openInRange = useMemo(
    () => filteredTrades.filter((t) => t.status === 'Open').length,
    [filteredTrades],
  );

  const summary = useMemo(() => computeSummary(filteredTrades), [filteredTrades]);
  const mixedCurrencies = useMemo(
    () => getMixedCurrencies(filteredTrades, currency),
    [filteredTrades, currency],
  );

  const dailySeries = useMemo(() => buildDailyPnlSeries(filteredTrades), [filteredTrades]);
  const monthlySeries = useMemo(() => buildMonthlyPnlSeries(filteredTrades), [filteredTrades]);
  const cumulativeSeries = useMemo(
    () => buildCumulativePnlSeries(filteredTrades),
    [filteredTrades],
  );

  if (tradesLoading || settingsLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Performance</h1>
          <p className="text-sm text-muted-fg mt-0.5">Loading performance metrics…</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 rounded-lg bg-card border border-border animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (tradesError || settingsError) {
    return (
      <div role="alert" className="bg-loss-bg border border-loss/30 rounded-lg p-6 text-center space-y-3">
        <p className="text-sm text-loss font-medium">
          {tradesErrObj instanceof Error ? tradesErrObj.message : 'Failed to load performance data.'}
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

  const rangeLabel =
    preset === 'all_time'
      ? 'All recorded closed trades'
      : from && to
      ? `${formatDate(from)} – ${formatDate(to)}`
      : from
      ? `From ${formatDate(from)}`
      : to
      ? `Through ${formatDate(to)}`
      : 'Select a date range';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Performance</h1>
          <p className="text-sm text-muted-fg mt-0.5">
            {rangeLabel} · Closed trades only ({currency})
          </p>
        </div>
        {openInRange > 0 && (
          <span className="px-3 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30 text-xs font-semibold">
            {openInRange} open trade{openInRange === 1 ? '' : 's'} excluded from P/L
          </span>
        )}
      </div>

      {/* Time Filter Bar */}
      <section aria-label="Time filters" className="bg-card border border-border rounded-lg p-3.5 sm:p-4 shadow-card space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {TIME_PRESETS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              aria-pressed={preset === opt.id}
              onClick={() => setPreset(opt.id)}
              className={cn(
                'min-h-[36px] px-3 py-1.5 rounded-md border text-xs sm:text-sm font-semibold transition-colors cursor-pointer',
                preset === opt.id
                  ? 'bg-primary text-on-primary border-primary'
                  : 'bg-background border-border text-muted-fg hover:text-foreground hover:bg-muted/60',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {preset === 'custom' && (
          <div className="pt-3 border-t border-border flex flex-wrap items-end gap-4">
            <div>
              <label htmlFor="perf-from" className="block text-[11px] font-semibold uppercase tracking-wider text-muted-fg mb-1">
                From Date
              </label>
              <input
                id="perf-from"
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="min-h-[40px] px-3 py-1.5 rounded-md border border-border bg-background text-sm font-num"
              />
            </div>
            <div>
              <label htmlFor="perf-to" className="block text-[11px] font-semibold uppercase tracking-wider text-muted-fg mb-1">
                To Date
              </label>
              <input
                id="perf-to"
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="min-h-[40px] px-3 py-1.5 rounded-md border border-border bg-background text-sm font-num"
              />
            </div>
            {invalidCustomRange && (
              <p role="alert" className="text-xs font-medium text-loss pb-2">
                Start date cannot be after end date.
              </p>
            )}
          </div>
        )}
      </section>

      {/* Mixed-currency safeguard */}
      {mixedCurrencies.length > 0 && (
        <div role="note" className="flex items-center gap-2 rounded-lg border border-border bg-muted/60 px-4 py-2.5 text-xs text-muted-fg">
          <Info size={16} aria-hidden="true" className="shrink-0 text-primary" />
          <span>
            Mixed currencies detected in this range ({mixedCurrencies.join(', ')}). Totals sum raw recorded amounts without FX conversion; inspect individual trades for per-trade currencies.
          </span>
        </div>
      )}

      {/* Analytical Summary — Tier 1: Core Outcomes (4) + Tier 2: Breakdown Panels (8) */}
      <section aria-label="Performance summary metrics" className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Net P/L */}
          <div className="bg-card border border-border rounded-lg p-4 sm:p-5 shadow-card">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-fg">
              Net P/L ({currency})
            </div>
            <div
              className={cn(
                'text-2xl font-bold tracking-tight font-num mt-1.5 flex items-center gap-1.5',
                summary.total === 0
                  ? 'text-foreground'
                  : summary.netPnl > 0
                  ? 'text-profit'
                  : summary.netPnl < 0
                  ? 'text-loss'
                  : 'text-foreground',
              )}
            >
              {summary.total > 0 && summary.netPnl > 0 && <ArrowUp size={18} weight="bold" aria-hidden="true" />}
              {summary.total > 0 && summary.netPnl < 0 && <ArrowDown size={18} weight="bold" aria-hidden="true" />}
              {summary.total > 0 && summary.netPnl === 0 && <Minus size={16} weight="bold" aria-hidden="true" />}
              <span>
                {summary.total > 0 ? formatSignedCurrency(summary.netPnl, currency) : '---'}
              </span>
            </div>
            <div className="text-[11px] text-muted-fg mt-1.5">Gross profit − gross loss</div>
          </div>

          <StatCard
            label="Win Rate"
            value={summary.winRate !== null ? `${summary.winRate.toFixed(1)}%` : '---'}
            sub="Wins / all closed trades"
          />
          <StatCard
            label={`Gross Profit (${currency})`}
            value={summary.total > 0 ? `+${formatCurrency(summary.grossProfit, currency)}` : '---'}
            valueClass={summary.grossProfit > 0 ? 'text-profit' : undefined}
            sub="Sum of winning trades"
          />
          <StatCard
            label={`Gross Loss (${currency})`}
            value={summary.total > 0 ? `−${formatCurrency(summary.grossLoss, currency)}` : '---'}
            valueClass={summary.grossLoss > 0 ? 'text-loss' : undefined}
            sub="Absolute sum of losing trades"
          />
        </div>

        {/* Tier 2: Grouped 2x2 Breakdown Panels */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-card border border-border rounded-lg shadow-card overflow-hidden">
            <div className="px-5 py-3 border-b border-border text-xs font-semibold uppercase tracking-wider text-muted-fg">
              Trade Volume &amp; Outcomes
            </div>
            <div className="grid grid-cols-2 divide-x divide-y divide-border">
              <CompactStat label="Total Closed Trades" value={String(summary.total)} />
              <CompactStat
                label="Winning Trades"
                value={String(summary.wins)}
                valueClass="text-profit"
                sub="Net P/L > 0"
              />
              <CompactStat
                label="Losing Trades"
                value={String(summary.losses)}
                valueClass="text-loss"
                sub="Net P/L < 0"
              />
              <CompactStat
                label="Breakeven Trades"
                value={String(summary.breakeven)}
                sub="Net P/L = 0"
              />
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg shadow-card overflow-hidden">
            <div className="px-5 py-3 border-b border-border text-xs font-semibold uppercase tracking-wider text-muted-fg">
              Averages &amp; Extremes ({currency})
            </div>
            <div className="grid grid-cols-2 divide-x divide-y divide-border">
              <CompactStat
                label={`Average Win (${currency})`}
                value={summary.avgWin !== null ? `+${formatCurrency(summary.avgWin, currency)}` : '---'}
                valueClass={summary.avgWin !== null ? 'text-profit' : undefined}
                sub="Per winning trade"
              />
              <CompactStat
                label={`Average Loss (${currency})`}
                value={summary.avgLoss !== null ? `−${formatCurrency(summary.avgLoss, currency)}` : '---'}
                valueClass={summary.avgLoss !== null ? 'text-loss' : undefined}
                sub="Per losing trade"
              />
              <CompactStat
                label={`Best Trade (${currency})`}
                value={
                  summary.bestTrade !== null
                    ? formatSignedCurrency(summary.bestTrade, currency)
                    : '---'
                }
                valueClass={
                  summary.bestTrade !== null
                    ? summary.bestTrade > 0
                      ? 'text-profit'
                      : summary.bestTrade < 0
                      ? 'text-loss'
                      : undefined
                    : undefined
                }
                sub="Highest single P/L"
              />
              <CompactStat
                label={`Worst Trade (${currency})`}
                value={
                  summary.worstTrade !== null
                    ? formatSignedCurrency(summary.worstTrade, currency)
                    : '---'
                }
                valueClass={
                  summary.worstTrade !== null
                    ? summary.worstTrade > 0
                      ? 'text-profit'
                      : summary.worstTrade < 0
                      ? 'text-loss'
                      : undefined
                    : undefined
                }
                sub="Lowest single P/L"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Empty state if no closed trades in range */}
      {summary.total === 0 ? (
        <div className="bg-card border border-border rounded-lg p-8 text-center space-y-3 shadow-card">
          <div className="w-11 h-11 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-fg">
            <ChartBar size={22} aria-hidden="true" />
          </div>
          <h2 className="text-base font-semibold">No closed trades in this date range</h2>
          <p className="text-sm text-muted-fg max-w-md mx-auto">
            Try switching the time filter or record a closed trade to see your daily, monthly, and cumulative P/L charts.
          </p>
          <Link
            to="/trades/new"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-accent hover:bg-accent-hover text-on-accent text-sm font-semibold transition-colors"
          >
            <Plus size={15} weight="bold" aria-hidden="true" />
            <span>Add Trade</span>
          </Link>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Daily P/L Chart */}
            <section className="bg-card border border-border rounded-lg shadow-card overflow-hidden">
              <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
                <h2 className="text-sm font-semibold">Daily P/L</h2>
                <span className="text-xs font-num text-muted-fg">{currency}</span>
              </div>
              <div className="p-5">
                <div
                  className="h-56 w-full"
                  role="img"
                  aria-label={`Daily net profit and loss bar chart in ${currency}`}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dailySeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 11, fill: 'var(--color-muted-fg)', fontFamily: 'JetBrains Mono, monospace' }}
                        axisLine={{ stroke: 'var(--color-border)' }}
                        tickLine={false}
                      />
                      <YAxis
                        width={64}
                        tick={{ fontSize: 11, fill: 'var(--color-muted-fg)', fontFamily: 'JetBrains Mono, monospace' }}
                        tickFormatter={(v: number) => formatAxisCurrency(v, currency)}
                        axisLine={false}
                        tickLine={false}
                      />
                      <ReferenceLine y={0} stroke="var(--color-muted-fg)" strokeOpacity={0.35} />
                      <Tooltip
                        formatter={(v: number) => [formatSignedCurrency(v, currency), 'Daily P/L']}
                        contentStyle={{
                          backgroundColor: 'var(--color-card)',
                          borderColor: 'var(--color-border)',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontFamily: 'JetBrains Mono, monospace',
                          color: 'var(--color-foreground)',
                        }}
                      />
                      <Bar dataKey="pnl" shape={<SignedPnlBarShape />} maxBarSize={36} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <ChartLegend />
              </div>
            </section>

            {/* Monthly P/L Chart */}
            <section className="bg-card border border-border rounded-lg shadow-card overflow-hidden">
              <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
                <h2 className="text-sm font-semibold">Monthly P/L</h2>
                <span className="text-xs font-num text-muted-fg">{currency}</span>
              </div>
              <div className="p-5">
                <div
                  className="h-56 w-full"
                  role="img"
                  aria-label={`Monthly net profit and loss bar chart in ${currency}`}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlySeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 11, fill: 'var(--color-muted-fg)', fontFamily: 'JetBrains Mono, monospace' }}
                        axisLine={{ stroke: 'var(--color-border)' }}
                        tickLine={false}
                      />
                      <YAxis
                        width={64}
                        tick={{ fontSize: 11, fill: 'var(--color-muted-fg)', fontFamily: 'JetBrains Mono, monospace' }}
                        tickFormatter={(v: number) => formatAxisCurrency(v, currency)}
                        axisLine={false}
                        tickLine={false}
                      />
                      <ReferenceLine y={0} stroke="var(--color-muted-fg)" strokeOpacity={0.35} />
                      <Tooltip
                        formatter={(v: number) => [formatSignedCurrency(v, currency), 'Monthly P/L']}
                        contentStyle={{
                          backgroundColor: 'var(--color-card)',
                          borderColor: 'var(--color-border)',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontFamily: 'JetBrains Mono, monospace',
                          color: 'var(--color-foreground)',
                        }}
                      />
                      <Bar dataKey="pnl" shape={<SignedPnlBarShape />} maxBarSize={42} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <ChartLegend />
              </div>
            </section>
          </div>

          {/* Cumulative P/L Line Chart */}
          <section className="bg-card border border-border rounded-lg shadow-card overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
              <h2 className="text-sm font-semibold">Cumulative P/L Over Time</h2>
              <span className="text-xs font-num text-muted-fg">Running total ({currency})</span>
            </div>
            <div className="p-5">
              {cumulativeSeries.length < 2 ? (
                <p className="text-xs text-muted-fg py-4 text-center">
                  Cumulative net P/L across <span className="font-num">{cumulativeSeries[0]?.label}</span>:{' '}
                  <strong className="text-foreground font-num">
                    {formatSignedCurrency(cumulativeSeries[0]?.cumulativePnl ?? 0, currency)}
                  </strong>
                  . Record closed trades on at least 2 dates to plot the trend line.
                </p>
              ) : (
                <div
                  className="h-56 w-full"
                  role="img"
                  aria-label={`Cumulative net profit and loss line chart in ${currency}`}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={cumulativeSeries} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 11, fill: 'var(--color-muted-fg)', fontFamily: 'JetBrains Mono, monospace' }}
                        axisLine={{ stroke: 'var(--color-border)' }}
                        tickLine={false}
                      />
                      <YAxis
                        width={64}
                        tick={{ fontSize: 11, fill: 'var(--color-muted-fg)', fontFamily: 'JetBrains Mono, monospace' }}
                        tickFormatter={(v: number) => formatAxisCurrency(v, currency)}
                        axisLine={false}
                        tickLine={false}
                      />
                      <ReferenceLine y={0} stroke="var(--color-muted-fg)" strokeOpacity={0.35} strokeDasharray="4 4" />
                      <Tooltip
                        formatter={(v: number, name: string) => [
                          formatSignedCurrency(v, currency),
                          name === 'cumulativePnl' ? 'Cumulative P/L' : 'Day P/L',
                        ]}
                        contentStyle={{
                          backgroundColor: 'var(--color-card)',
                          borderColor: 'var(--color-border)',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontFamily: 'JetBrains Mono, monospace',
                          color: 'var(--color-foreground)',
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="cumulativePnl"
                        stroke="var(--color-primary)"
                        strokeWidth={2.5}
                        dot={{ r: 3.5, fill: 'var(--color-primary)' }}
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  valueClass,
}: {
  label: string;
  value: string;
  sub?: string;
  valueClass?: string;
}) {
  return (
    <div className="bg-card border border-border rounded-lg p-4 sm:p-5 shadow-card">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-fg">
        {label}
      </div>
      <div className={cn('text-2xl font-bold tracking-tight font-num mt-1.5', valueClass)}>
        {value}
      </div>
      {sub && <div className="text-[11px] text-muted-fg mt-1.5">{sub}</div>}
    </div>
  );
}

function CompactStat({
  label,
  value,
  sub,
  valueClass,
}: {
  label: string;
  value: string;
  sub?: string;
  valueClass?: string;
}) {
  return (
    <div className="p-4 sm:px-5 sm:py-4">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-fg">
        {label}
      </div>
      <div className={cn('text-lg sm:text-xl font-bold tracking-tight font-num mt-1', valueClass)}>
        {value}
      </div>
      {sub && <div className="text-[11px] text-muted-fg mt-0.5">{sub}</div>}
    </div>
  );
}

function ChartLegend() {
  return (
    <div className="flex items-center gap-4 pt-3 text-xs text-muted-fg">
      <span className="inline-flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-sm bg-profit inline-block" aria-hidden="true" />
        Profit (+)
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-sm bg-loss inline-block" aria-hidden="true" />
        Loss (−)
      </span>
    </div>
  );
}
