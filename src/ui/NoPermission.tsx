/**
 * No-permission state (PRD §12): a lock illustration, "Not available for
 * your role", and who to ask.
 */
import { Lock } from './icons';

export function NoPermission({ askWho = 'a Community Manager' }: { askWho?: string }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <Lock className="text-text-muted h-8 w-8" strokeWidth={1.5} />
      <p className="text-label-2 text-text-title">Not available for your role</p>
      <p className="text-body-3 text-text-muted">Ask {askWho} for access.</p>
    </div>
  );
}
