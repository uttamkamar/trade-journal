import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Info,
  Minus,
  Notebook,
  Plus,
  Pulse,
} from '@phosphor-icons/react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  buildMonthlyDailyPnlSeries,
  buildMonthlyPnlSeries,
  cn,
  computeDashboardMetrics,
  formatAxisCurrency,
  formatCurrency,
  formatDate,
  formatSignedCurrency,
  hasJournalContent,
  todayISO,
} from '../lib/utils';
import { useSettings, useTrades } from '../hooks/useTrades';
import { useJournalEntries } from '../hooks/useJournal';
import { PnlBadge } from '../components/PnlBadge';
import { SignedPnlBarShape } from '../components/SignedPnlBarShape';

export function Dashboard() {
  const navigate = useNavigate();
  const today = todayISO();
  const currentMonth = today.slice(0, 7);
  const [chartView, setChartView] = useState<'daily' | 'monthly'>('daily');

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
  const { data: journalEntries = [], isLoading: journalLoading } = useJournalEntries();

  const currency = settings?.currency || 'USD';

  const metrics = useMemo(
    () => computeDashboardMetrics(trades, settings, today),
    [trades, settings, today],
  );

  const dailyChartData = useMemo(
    () => buildMonthlyDailyPnlSeries(trades, currentMonth),
    [trades, currentMonth],
  );

  const monthlyChartData = useMemo(
    () => buildMonthlyPnlSeries(trades),
    [trades],
  );

  const chartData = chartView === 'daily' ? dailyChartData : monthlyChartData;

  const todayJournal = useMemo(
    () => journalEntries.find((e) => e.journal_date === today),
    [journalEntries, today],
  );
  const journalComplete = hasJournalContent(todayJournal);

  const monthLabel = useMemo(() => {
    const [y, m] = currentMonth.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString(undefined, {
      month: 'long',
      year: 'numeric',
    });
  }, [currentMonth]);

  if (tradesLoading || settingsLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-fg mt-0.5 font-num">{formatDate(today)}</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-28 rounded-lg bg-card border border-border animate-pulse" />
          ))}
        </div>
        <div className="h-20 rounded-lg bg-card border border-border animate-pulse" />
      </div>
    );
  }

  if (tradesError || settingsError) {
    return (
      <div role="alert" className="bg-loss-bg border border-loss/30 rounded-lg p-6 text-center space-y-3">
        <p className="text-sm text-loss font-medium">
          {tradesErrObj instanceof Error ? tradesErrObj.message : 'Failed to load dashboard data.'}
        </p>
        <button
          type="button"
          onClick={() => {
            refetchTrades();
            refetchSettings();
          }}
          className="px-4 py-2 rounded-md border border-border bg-card text-sm font-semibold cursor-pointer hover:bg-muted"
        >
          Retry
        </button>
      </div>
    );
  }

  const showBalanceCard = metrics.recordedBalance !== null || metrics.balanceIncompatible;

  return (
    <div className="space-y-6">
      {/* Header — clean overview without duplicate top-bar Add Trade button */}
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-fg mt-0.5">
            Daily overview · <span className="font-num">{formatDate(today)}</span> · {currency}
          </p>
        </div>
      </div>

      {/* Today's Journal Reminder */}
      {!journalLoading && !journalComplete && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300/70 bg-amber-50/70 dark:bg-amber-500/10 dark:border-amber-500/25 px-4 py-3"
        >
          <div className="flex items-center gap-2.5 text-sm text-amber-950 dark:text-amber-200">
            <Notebook size={18} weight="duotone" aria-hidden="true" className="shrink-0 text-amber-700 dark:text-amber-300" />
            <span>
              <strong className="font-semibold">Today&apos;s journal is still open.</strong>{' '}
              Jot down your mindset and plan adherence while the session is fresh.
            </span>
          </div>
          <Link
            to="/journal"
            className="inline-flex items-center gap-1 text-xs sm:text-sm font-semibold text-amber-900 dark:text-amber-200 hover:underline whitespace-nowrap"
          >
            <span>Write reflection</span>
            <ArrowRight size={14} weight="bold" aria-hidden="true" />
          </Link>
        </div>
      )}

      {/* Mixed-currency informational notice */}
      {metrics.hasMixedCurrencies && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/60 px-4 py-2.5 text-xs text-muted-fg">
          <Info size={16} aria-hidden="true" className="shrink-0 text-primary" />
          <span>
            Some saved closed trades use a different currency than {currency}. Overall totals sum raw recorded amounts without FX conversion.
          </span>
        </div>
      )}

      {/* Primary KPIs + Symmetrical Activity Strip */}
      <section aria-label="Trading summary" className="space-y-4">
        <div
          className={cn(
            'grid grid-cols-1 gap-4',
            showBalanceCard ? 'md:grid-cols-3' : 'md:grid-cols-2',
          )}
        >
          {/* Today's P/L */}
          <div className="bg-card border border-border rounded-lg p-5 shadow-card">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-fg">
              Today&apos;s P/L ({currency})
            </div>
            <div
              className={cn(
                'text-2xl sm:text-[28px] leading-tight font-bold tracking-tight font-num mt-2 flex items-center gap-2',
                metrics.todayPnl > 0
                  ? 'text-profit'
                  : metrics.todayPnl < 0
                  ? 'text-loss'
                  : 'text-foreground',
              )}
            >
              {metrics.todayPnl > 0 && <ArrowUp size={20} weight="bold" aria-hidden="true" />}
              {metrics.todayPnl < 0 && <ArrowDown size={20} weight="bold" aria-hidden="true" />}
              {metrics.todayPnl === 0 && <Minus size={18} weight="bold" aria-hidden="true" />}
              <span>{formatSignedCurrency(metrics.todayPnl, currency)}</span>
            </div>
            <p className="text-xs text-muted-fg mt-2">
              {metrics.todayClosedCount > 0
                ? `${metrics.todayClosedCount} closed trade${metrics.todayClosedCount === 1 ? '' : 's'} today`
                : 'No closed trades today'}
            </p>
          </div>

          {/* Overall Net P/L */}
          <div className="bg-card border border-border rounded-lg p-5 shadow-card">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-fg">
              Overall Net P/L ({currency})
            </div>
            <div
              className={cn(
                'text-2xl sm:text-[28px] leading-tight font-bold tracking-tight font-num mt-2 flex items-center gap-2',
                metrics.overallNetPnl > 0
                  ? 'text-profit'
                  : metrics.overallNetPnl < 0
                  ? 'text-loss'
                  : 'text-foreground',
              )}
            >
              {metrics.overallNetPnl > 0 && <ArrowUp size={20} weight="bold" aria-hidden="true" />}
              {metrics.overallNetPnl < 0 && <ArrowDown size={20} weight="bold" aria-hidden="true" />}
              {metrics.overallNetPnl === 0 && <Minus size={18} weight="bold" aria-hidden="true" />}
              <span>{formatSignedCurrency(metrics.overallNetPnl, currency)}</span>
            </div>
            <p className="text-xs text-muted-fg mt-2">
              Across <span className="font-num">{metrics.overallClosedCount}</span> closed trade
              {metrics.overallClosedCount === 1 ? '' : 's'}
            </p>
          </div>

          {/* Recorded Trading Balance — only when starting balance configured */}
          {showBalanceCard && (
            <div className="bg-card border border-border rounded-lg p-5 shadow-card">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-fg">
                Recorded Balance ({currency})
              </div>
              <div className="text-2xl sm:text-[28px] leading-tight font-bold tracking-tight font-num mt-2">
                {metrics.balanceIncompatible
                  ? '---'
                  : formatCurrency(metrics.recordedBalance, currency)}
              </div>
              <p className="text-xs text-muted-fg mt-2 leading-relaxed">
                {metrics.balanceIncompatible
                  ? `Mixed currencies differ from ${currency}.`
                  : `Journal balance · Starting ${formatCurrency(settings?.starting_balance, currency)}`}
              </p>
            </div>
          )}
        </div>

        {/* Unified Today Activity Strip */}
        <div className="bg-card border border-border rounded-lg shadow-card grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-border overflow-hidden">
          <div className="px-5 py-4 flex items-center justify-between sm:block">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-fg">
              Trades Taken Today
            </div>
            <div className="flex items-baseline gap-2 sm:mt-1">
              <span className="text-xl font-bold font-num">{metrics.todayTrades.length}</span>
              <span className="text-xs text-muted-fg">
                {metrics.todayOpenCount > 0
                  ? `${metrics.todayClosedCount} closed · ${metrics.todayOpenCount} open`
                  : `${metrics.todayClosedCount} closed`}
              </span>
            </div>
          </div>

          <div className="px-5 py-4 flex items-center justify-between sm:block">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-fg">
              Winning Today
            </div>
            <div className="flex items-baseline gap-2 sm:mt-1">
              <span className="text-xl font-bold font-num text-profit">{metrics.todayWins}</span>
              <span className="text-xs text-muted-fg">Net P/L &gt; 0</span>
            </div>
          </div>

          <div className="px-5 py-4 flex items-center justify-between sm:block">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-fg">
              Losing Today
            </div>
            <div className="flex items-baseline gap-2 sm:mt-1">
              <span className="text-xl font-bold font-num text-loss">{metrics.todayLosses}</span>
              <span className="text-xs text-muted-fg">Net P/L &lt; 0</span>
            </div>
          </div>
        </div>
      </section>

      {/* Two-column on xl+: Today's Trades + P/L Chart */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* Today's Trades */}
        <section className="bg-card border border-border rounded-lg shadow-card overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
            <h2 className="text-sm font-semibold">Today&apos;s Trades</h2>
            <Link to="/trades" className="text-xs font-semibold text-primary hover:underline">
              View all →
            </Link>
          </div>

          {metrics.todayTrades.length === 0 ? (
            <div className="p-8 text-center space-y-3 flex-1 flex flex-col items-center justify-center">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-fg">
                <Pulse size={20} aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-semibold">No trades logged today yet</p>
                <p className="text-xs text-muted-fg mt-0.5">
                  Log a trade when you open or close a position.
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/trades/new')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-accent hover:bg-accent-hover text-on-accent text-xs font-semibold cursor-pointer transition-colors"
              >
                <Plus size={14} weight="bold" aria-hidden="true" />
                <span>Log Today&apos;s First Trade</span>
              </button>
            </div>
          ) : (
            <>
              {/* Desktop / Tablet compact table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="bg-muted/45 border-b border-border text-[11px] font-semibold uppercase tracking-wider text-muted-fg">
                      <th className="py-2.5 px-4">Symbol</th>
                      <th className="py-2.5 px-4">Side</th>
                      <th className="py-2.5 px-4">Setup</th>
                      <th className="py-2.5 px-4 text-right">P/L</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-sm">
                    {metrics.todayTrades.map((trade) => (
                      <tr key={trade.id} className="hover:bg-muted/35 transition-colors">
                        <td className="py-2.5 px-4 font-semibold font-num text-xs">
                          <Link
                            to={`/trades/${trade.id}`}
                            className="hover:text-primary hover:underline focus-visible:underline"
                          >
                            {trade.symbol}
                          </Link>
                        </td>
                        <td className="py-2.5 px-4">
                          <span
                            className={`text-xs font-semibold ${
                              trade.direction === 'Buy' ? 'text-profit' : 'text-loss'
                            }`}
                          >
                            {trade.direction}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-xs text-muted-fg truncate max-w-[140px]">
                          {trade.setup || '—'}
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <PnlBadge
                            pnl={trade.realized_pnl}
                            currency={trade.currency}
                            status={trade.status}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile compact list */}
              <div className="sm:hidden divide-y divide-border">
                {metrics.todayTrades.map((trade) => (
                  <Link
                    key={trade.id}
                    to={`/trades/${trade.id}`}
                    className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/35 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold font-num text-sm">{trade.symbol}</span>
                        <span
                          className={`text-xs font-semibold ${
                            trade.direction === 'Buy' ? 'text-profit' : 'text-loss'
                          }`}
                        >
                          {trade.direction}
                        </span>
                      </div>
                      {trade.setup && (
                        <div className="text-xs text-muted-fg truncate mt-0.5">{trade.setup}</div>
                      )}
                    </div>
                    <PnlBadge
                      pnl={trade.realized_pnl}
                      currency={trade.currency}
                      status={trade.status}
                    />
                  </Link>
                ))}
              </div>
            </>
          )}
        </section>

        {/* Simple Daily / Monthly P/L Chart */}
        <section className="bg-card border border-border rounded-lg shadow-card overflow-hidden flex flex-col">
          <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 border-b border-border">
            <h2 className="text-sm font-semibold">
              {chartView === 'daily' ? `Daily P/L — ${monthLabel}` : 'Monthly P/L'}
            </h2>
            <div className="flex items-center gap-2.5">
              <div className="inline-flex rounded-md border border-border p-0.5 bg-background text-[11px] font-semibold">
                <button
                  type="button"
                  aria-pressed={chartView === 'daily'}
                  onClick={() => setChartView('daily')}
                  className={cn(
                    'px-2.5 py-1 rounded-[4px] transition-colors cursor-pointer',
                    chartView === 'daily'
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-fg hover:text-foreground',
                  )}
                >
                  Daily
                </button>
                <button
                  type="button"
                  aria-pressed={chartView === 'monthly'}
                  onClick={() => setChartView('monthly')}
                  className={cn(
                    'px-2.5 py-1 rounded-[4px] transition-colors cursor-pointer',
                    chartView === 'monthly'
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-fg hover:text-foreground',
                  )}
                >
                  Monthly
                </button>
              </div>
              <Link to="/performance" className="text-xs font-semibold text-primary hover:underline">
                Performance →
              </Link>
            </div>
          </div>

          <div className="p-5 flex-1 flex flex-col justify-between">
            {chartData.length === 0 ? (
              <div className="py-8 text-center space-y-1.5">
                <p className="text-sm font-medium">
                  {chartView === 'daily' ? 'No closed trades this month' : 'No closed trades recorded yet'}
                </p>
                <p className="text-xs text-muted-fg">
                  {chartView === 'daily'
                    ? `Closed trades dated in ${monthLabel} will appear here.`
                    : 'Closed trades will appear here grouped by month.'}
                </p>
              </div>
            ) : (
              <>
                <div
                  className="h-48 w-full"
                  role="img"
                  aria-label={
                    chartView === 'daily'
                      ? `Daily net profit and loss bar chart for ${monthLabel} in ${currency}`
                      : `Monthly net profit and loss bar chart in ${currency}`
                  }
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
                        tickFormatter={(val: number) => formatAxisCurrency(val, currency)}
                        axisLine={false}
                        tickLine={false}
                      />
                      <ReferenceLine y={0} stroke="var(--color-muted-fg)" strokeOpacity={0.35} />
                      <Tooltip
                        formatter={(value: number) => [formatSignedCurrency(value, currency), 'Net P/L']}
                        labelFormatter={(_label, payload) => {
                          const item = payload?.[0]?.payload as { key?: string } | undefined;
                          if (!item?.key) return '';
                          return chartView === 'daily' ? formatDate(item.key) : item.key;
                        }}
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

                <div className="flex flex-wrap items-center gap-4 pt-3 text-xs text-muted-fg">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-profit inline-block" aria-hidden="true" />
                    Profit (+)
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-loss inline-block" aria-hidden="true" />
                    Loss (−)
                  </span>
                  <span className="ml-auto">Closed trades only ({currency})</span>
                </div>
              </>
            )}
          </div>
        </section>
      </div>

      {/* Recent Trades */}
      <section className="bg-card border border-border rounded-lg shadow-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
          <h2 className="text-sm font-semibold">Recent Trades</h2>
          <Link to="/trades" className="text-xs font-semibold text-primary hover:underline">
            Trade History →
          </Link>
        </div>

        {metrics.recentTrades.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-fg">
            Your most recent trades will show up here once added.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {metrics.recentTrades.map((trade) => {
              const tags = [
                ...trade.mistakes.filter((m) => m !== 'Other'),
                ...(trade.custom_mistake ? [trade.custom_mistake] : []),
              ];
              return (
                <Link
                  key={trade.id}
                  to={`/trades/${trade.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 hover:bg-muted/35 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2.5">
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
                    {trade.setup && (
                      <div className="text-xs text-muted-fg mt-0.5 truncate">{trade.setup}</div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 ml-auto">
                    {tags.slice(0, 2).map((m) => (
                      <span
                        key={m}
                        className="px-2 py-0.5 rounded-md bg-muted text-muted-fg text-[11px] font-medium"
                      >
                        {m}
                      </span>
                    ))}
                    <PnlBadge
                      pnl={trade.realized_pnl}
                      currency={trade.currency}
                      status={trade.status}
                    />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
