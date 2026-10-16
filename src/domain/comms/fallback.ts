/**
 * Per-recipient channel selection and quiet hours (PRD §8.7 "Fallback
 * rules" / "Quiet hours"). Pure.
 */
import { fmtTime } from '@/lib/time';
import type { Channel } from '@/types/comms';
import type { Resident } from '@/types/community';

/** True if `now` (Dubai-local) falls in the overnight `[start, end)` window, e.g. 22:00–07:00. */
export function isQuietHours(now: string, quietHours: { start: string; end: string }): boolean {
  const clock = fmtTime(now); // 'HH:mm'
  if (quietHours.start <= quietHours.end) {
    return clock >= quietHours.start && clock < quietHours.end;
  }
  // Overnight wrap (e.g. 22:00–07:00): "in range" means at-or-after start OR before end.
  return clock >= quietHours.start || clock < quietHours.end;
}

/**
 * Resolves which channels actually reach this resident, applying PRD's
 * fallback rules: push-off residents fall back to WhatsApp; WhatsApp
 * opt-outs get app only; a resident with neither is unreachable (listed
 * for call-centre follow-up by the caller). `wa_channel` (a broadcast,
 * not per-recipient) and `sms_fallback` (only ever created by the urgent
 * SMS-fallback sweep) are never resolved here.
 */
export function resolveChannelsForResident(
  resident: Resident,
  requestedChannels: readonly Channel[],
): Channel[] {
  const out = new Set<Channel>();
  const canApp = resident.channels.appInstalled;
  const canWa = resident.channels.whatsapp && resident.channels.whatsappOptIn;

  for (const ch of requestedChannels) {
    if (ch === 'app_push') {
      if (canApp && resident.channels.appPush) out.add('app_push');
      else if (canWa) out.add('wa_direct');
    } else if (ch === 'app_banner' || ch === 'app_inbox') {
      if (canApp) out.add(ch);
    } else if (ch === 'wa_direct') {
      if (canWa) out.add('wa_direct');
      else if (canApp) out.add('app_inbox');
    }
    // wa_channel and sms_fallback: not resolved per-recipient here.
  }
  return [...out];
}

/** True if this resident ends up with no reachable channel from the requested set (excluding the broadcast channel). */
export function isUnreachable(resident: Resident, requestedChannels: readonly Channel[]): boolean {
  const personal = requestedChannels.filter((c) => c !== 'wa_channel');
  if (personal.length === 0) return false;
  return resolveChannelsForResident(resident, personal).length === 0;
}
