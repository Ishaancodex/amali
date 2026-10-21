/**
 * Error state (PRD §12): inline message with a retry. Data stays where possible.
 */
import { CircleAlert, RefreshCw } from './icons';
import { useT } from '@/i18n/hooks';

export function ErrorState({ message, onRetry }: { message?: string; onRetry: () => void }) {
  const t = useT();
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
      <CircleAlert className="text-danger h-8 w-8" strokeWidth={1.5} />
      <p className="font-serif-display text-serif-section text-text-title">
        {message ?? t('common.somethingWrong')}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="text-label-2 text-brand flex items-center gap-1.5"
      >
        <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.5} />
        {t('common.retry')}
      </button>
    </div>
  );
}
