/**
 * No-permission state (PRD §12): a lock illustration, "Not available for
 * your role", and who to ask.
 */
import { Lock } from './icons';
import { useT } from '@/i18n/hooks';

/** `askWho` is already translated; it defaults to "a Community Manager". */
export function NoPermission({ askWho }: { askWho?: string }) {
  const t = useT();
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <Lock className="text-text-muted h-8 w-8" strokeWidth={1.5} />
      <p className="font-serif-display text-serif-section text-text-title">
        {t('common.notAvailableForRole')}
      </p>
      <p className="text-body-3 text-text-muted">
        {t('common.askForAccess', { who: askWho ?? t('common.aCommunityManager') })}
      </p>
    </div>
  );
}
