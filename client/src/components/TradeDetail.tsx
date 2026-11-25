import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle,
  PencilSimple,
  Trash,
  X,
} from '@phosphor-icons/react';
import { formatCurrency, formatDate } from '../lib/utils';
import { useDeleteTrade } from '../hooks/useTrades';
import { PnlBadge } from './PnlBadge';
import { ConfirmDialog } from './ConfirmDialog';
import type { Trade } from '../types';

interface TradeDetailProps {
  trade: Trade;
}

export function TradeDetail({ trade }: TradeDetailProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const deleteTrade = useDeleteTrade();

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const closeLightboxRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!lightboxUrl) return;
    const prevFocus = document.activeElement as HTMLElement | null;
    closeLightboxRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxUrl(null);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      prevFocus?.focus?.();
    };
  }, [lightboxUrl]);

  const state = location.state as { successMessage?: string } | null;
  const successMessage = state?.successMessage;

  const allMistakes = [
    ...trade.mistakes.filter((m) => m !== 'Other'),
    ...(trade.custom_mistake ? [trade.custom_mistake] : []),
  ];

  const handleDelete = async () => {
    setDeleteError(null);
    try {
      await deleteTrade.mutateAsync(trade.id);
      navigate('/trades', {
        state: { successMessage: `Deleted ${trade.symbol} trade (${formatDate(trade.trade_date)}).` },
      });
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete trade');
      setConfirmOpen(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/trades')}
            className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-sm border border-border bg-card hover:bg-muted transition-colors cursor-pointer"
            aria-label="Back to trade history"
          >
            <ArrowLeft size={18} aria-hidden="true" />
          </button>
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight">{trade.symbol}</h1>
              <span
                className={`px-2.5 py-0.5 rounded-sm text-xs font-semibold ${
                  trade.direction === 'Buy'
                    ? 'bg-profit-bg text-profit'
                    : 'bg-loss-bg text-loss'
                }`}
              >
                {trade.direction}
              </span>
              <PnlBadge
                pnl={trade.realized_pnl}
                currency={trade.currency}
                status={trade.status}
              />
            </div>
            <p className="text-sm text-muted-fg mt-0.5">
              {formatDate(trade.trade_date)}
              {trade.setup ? ` · ${trade.setup}` : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(`/trades/${trade.id}/edit`)}
            className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-sm border border-border bg-card text-sm font-semibold hover:bg-muted transition-colors cursor-pointer"
          >
            <PencilSimple size={16} aria-hidden="true" />
            <span>Edit</span>
          </button>
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-sm border border-loss/30 bg-loss-bg text-loss text-sm font-semibold hover:opacity-90 transition-opacity cursor-pointer"
          >
            <Trash size={16} aria-hidden="true" />
            <span>Delete</span>
          </button>
        </div>
      </div>

      {successMessage && (
        <div
          role="status"
          className="flex items-center gap-2 bg-profit-bg border border-profit/30 text-profit rounded-md px-4 py-3 text-sm font-medium"
        >
          <CheckCircle size={18} weight="bold" aria-hidden="true" />
          <span>{successMessage}</span>
        </div>
      )}

      {deleteError && (
        <div role="alert" className="bg-loss-bg border border-loss/30 text-loss rounded-md px-4 py-3 text-sm">
          {deleteError}
        </div>
      )}

      {/* Primary Execution Summary */}
      <section className="bg-card border border-border rounded-md p-5 shadow-card grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-fg">Entry Price</div>
          <div className="text-base font-bold mt-1">{trade.entry_price ?? '—'}</div>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-fg">Exit Price</div>
          <div className="text-base font-bold mt-1">{trade.exit_price ?? '—'}</div>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-fg">Lot / Quantity</div>
          <div className="text-base font-bold mt-1">{trade.quantity_or_lot_size ?? '—'}</div>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-fg">Net P/L</div>
          <div className="text-base font-bold mt-1">
            {trade.status === 'Open'
              ? 'Open (excluded)'
              : formatCurrency(trade.realized_pnl, trade.currency)}
          </div>
        </div>
      </section>

      {/* Journaling Notes */}
      <section className="bg-card border border-border rounded-md p-5 md:p-6 shadow-card space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pb-4 border-b border-border">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-fg">Emotion</div>
            <div className="text-sm font-medium mt-1">{trade.emotion || '—'}</div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-fg">Followed Plan?</div>
            <div className="text-sm font-medium mt-1">{trade.plan_followed || '—'}</div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-fg">Status</div>
            <div className="text-sm font-medium mt-1">{trade.status}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-fg mb-1.5">
              Why did I enter?
            </h2>
            <p className="text-sm whitespace-pre-wrap text-foreground">
              {trade.entry_reason || 'No entry note recorded.'}
            </p>
          </div>
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-fg mb-1.5">
              Why did I exit?
            </h2>
            <p className="text-sm whitespace-pre-wrap text-foreground">
              {trade.exit_reason || 'No exit note recorded.'}
            </p>
          </div>
        </div>

        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-fg mb-2">
            Mistakes Tagged
          </h2>
          {allMistakes.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {allMistakes.map((m) => (
                <span
                  key={m}
                  className="px-2.5 py-1 rounded-sm bg-loss-bg text-loss text-xs font-semibold"
                >
                  {m}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-fg">No mistakes tagged.</p>
          )}
        </div>

        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-fg mb-1.5">
            Lesson Learned
          </h2>
          <p className="text-sm whitespace-pre-wrap text-foreground">
            {trade.lesson || 'No lesson recorded.'}
          </p>
        </div>

        {trade.screenshot_references.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-border">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-fg">
              Screenshots ({trade.screenshot_references.length})
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {trade.screenshot_references.map((src, i) => (
                <button
                  key={src}
                  type="button"
                  onClick={() => setLightboxUrl(src)}
                  className="rounded-sm border border-border overflow-hidden bg-background hover:border-primary transition-colors cursor-pointer"
                >
                  <img
                    src={src}
                    alt={`${trade.symbol} screenshot ${i + 1}`}
                    className="w-full h-32 object-cover"
                  />
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Lightbox */}
      {lightboxUrl && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Screenshot preview"
          onClick={() => setLightboxUrl(null)}
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
        >
          <button
            ref={closeLightboxRef}
            type="button"
            aria-label="Close preview"
            onClick={() => setLightboxUrl(null)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-card text-foreground flex items-center justify-center cursor-pointer"
          >
            <X size={20} aria-hidden="true" />
          </button>
          <img
            src={lightboxUrl}
            alt="Full size trade screenshot"
            onClick={(e) => e.stopPropagation()}
            className="max-w-full max-h-[88vh] rounded-md object-contain"
          />
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={confirmOpen}
        title="Delete this trade?"
        description={`This will permanently remove your ${trade.symbol} (${trade.direction}) trade from ${formatDate(trade.trade_date)} and any attached screenshots.`}
        isLoading={deleteTrade.isPending}
        onConfirm={handleDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
