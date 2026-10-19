/**
 * A reservation's scheduled jobs — shared by `dining.reserve` and the seed
 * (seeded future reservations get the same reminder and auto-flag).
 */
import { rules } from '@/config/rules';
import { addMinutesIso } from '@/lib/time';
import { autoFlagAt } from '@/domain/dining/policy';
import type { Job } from '@/scheduler/queue';
import type { Reservation } from '@/types/dining';

/** The T−3h WhatsApp reminder and the +30 min no-show auto-flag. */
export function diningJobs(res: Pick<Reservation, 'id' | 'start'>): Job[] {
  return [
    {
      id: `dining-reminder:${res.id}`,
      type: 'dining.reminder',
      runAt: addMinutesIso(res.start, -rules.dining.reminderHoursBefore * 60),
      payload: { reservationId: res.id },
    },
    {
      id: `dining-noshow:${res.id}`,
      type: 'dining.noShowFlag',
      runAt: autoFlagAt(res.start, rules.dining),
      payload: { reservationId: res.id },
    },
  ];
}
