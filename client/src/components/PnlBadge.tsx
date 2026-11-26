import { ArrowUp, ArrowDown, Minus, Clock } from '@phosphor-icons/react';
import { cn, formatCurrency } from '../lib/utils';
import type { TradeStatus } from '../types';

interface PnlBadgeProps {
  pnl: number | null;
  currency: string;
  status: TradeStatus;
  className?: string;
}

/**
 * Displays P/L with non-color cues (sign prefix, icon, tabular numerals, and label)
 * so positive, negative, breakeven, and open trades are never distinguished by color alone.
 */
export function PnlBadge({ pnl, currency, status, className }: PnlBadgeProps) {
  if (status === 'Open' || pnl === null) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap shrink-0 bg-amber-50 text-amber-800 border border-amber-200/80 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30',
          className,
        )}
      >
        <Clock size={12} weight="bold" aria-hidden="true" />
        <span>Open</span>
      </span>
    );
  }

  if (pnl > 0) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold font-num whitespace-nowrap shrink-0 bg-profit-bg text-profit',
          className,
        )}
        aria-label={`Profit ${formatCurrency(pnl, currency)}`}
      >
        <ArrowUp size={11} weight="bold" aria-hidden="true" />
        <span>+{formatCurrency(pnl, currency)}</span>
      </span>
    );
  }

  if (pnl < 0) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold font-num whitespace-nowrap shrink-0 bg-loss-bg text-loss',
          className,
        )}
        aria-label={`Loss ${formatCurrency(Math.abs(pnl), currency)}`}
      >
        <ArrowDown size={11} weight="bold" aria-hidden="true" />
        <span>−{formatCurrency(Math.abs(pnl), currency)}</span>
      </span>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold font-num whitespace-nowrap shrink-0 bg-muted text-muted-fg',
        className,
      )}
      aria-label={`Breakeven ${formatCurrency(0, currency)}`}
    >
      <Minus size={11} weight="bold" aria-hidden="true" />
      <span>{formatCurrency(0, currency)}</span>
    </span>
  );
}
