import { useEffect, useRef } from 'react';
import { Warning } from '@phosphor-icons/react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Accessible confirmation dialog for destructive actions (e.g. deleting a trade). */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  isLoading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const prevFocus = document.activeElement as HTMLElement | null;
    cancelBtnRef.current?.focus();
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) onCancel();
    };
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('keydown', handleKey);
      prevFocus?.focus?.();
    };
  }, [open, isLoading, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-desc"
    >
      <div className="w-full max-w-md bg-card border border-border rounded-lg p-6 shadow-card-hover space-y-4">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-full bg-loss-bg text-loss flex items-center justify-center shrink-0">
            <Warning size={20} weight="bold" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <h2 id="confirm-dialog-title" className="text-base font-semibold text-foreground">
              {title}
            </h2>
            <p id="confirm-dialog-desc" className="text-sm text-muted-fg leading-relaxed">
              {description}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-2">
          <button
            ref={cancelBtnRef}
            type="button"
            disabled={isLoading}
            onClick={onCancel}
            className="min-h-[40px] px-4 py-2 rounded-md border border-border bg-background text-sm font-medium text-foreground hover:bg-muted transition-colors cursor-pointer disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={isLoading}
            onClick={onConfirm}
            className="min-h-[40px] px-4 py-2 rounded-md bg-destructive text-white text-sm font-semibold hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50"
          >
            {isLoading ? 'Deleting…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
