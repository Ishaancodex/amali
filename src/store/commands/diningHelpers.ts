/**
 * Shared dining command plumbing (PRD §8.4): who the F&B actor is, telling
 * the resident and the host, and moving deposit money through the wallet
 * holds. Mutates `ctx.state` directly — always called inside a `run()`.
 */
import { id } from '@/lib/ids';
import { fmtAed } from '@/lib/money';
import { forfeitHold, placeHold, releaseHold } from '@/domain/wallet/holds';
import type { LedgerDraft } from '@/domain/wallet/holds';
import type { Reservation, VenueKey } from '@/types/dining';
import { notify } from './bookingHelpers';
import type { CommandCtx, CommandError } from './types';

export const VENUE_LABEL: Record<VenueKey, string> = {
  restaurant: 'Restaurant',
  pdr: 'Private Dining',
  teppanyaki: 'Teppanyaki',
};

export const DINING_DEEP_LINK = 'amali://resident/amenity-detail?key=dining';

export const NOT_FNB: CommandError = { code: 'NO_PERMISSION', message: 'F&B staff only.' };

/** F&B roles aren't `ConsoleRole`s — these commands are ungated at dispatch and check here. */
export function fnbRole(ctx: CommandCtx): 'fnb_manager' | 'host' | 'chef' | undefined {
  if (ctx.actor.kind !== 'staff') return undefined;
  const role = ctx.state.staff[ctx.actor.id]?.role;
  return role === 'fnb_manager' || role === 'host' || role === 'chef' ? role : undefined;
}

export function appendLedger(ctx: CommandCtx, draft: LedgerDraft): void {
  const ledgerId = id('ledger');
  ctx.state.ledger[ledgerId] = { id: ledgerId, ...draft };
}

/** An app push only. */
export function pushResident(
  ctx: CommandCtx,
  residentId: string,
  title: string,
  body: string,
): void {
  if (!residentId) return;
  const notifId = id('notif');
  ctx.state.notifications[notifId] = {
    id: notifId,
    createdAt: ctx.now,
    updatedAt: ctx.now,
    recipientId: residentId,
    at: ctx.now,
    title,
    body,
    deepLink: DINING_DEEP_LINK,
    priority: 'normal',
    read: false,
  };
}

/** App + WhatsApp, optionally with quick-reply buttons. */
export function tellResident(
  ctx: CommandCtx,
  residentId: string,
  title: string,
  body: string,
  buttons?: Parameters<typeof notify>[5],
): void {
  if (!residentId) return;
  notify(ctx, residentId, title, body, DINING_DEEP_LINK, buttons);
}

/** Every host and F&B manager (e.g. "Running late", a no-show flag, a large-party request). */
export function tellHosts(
  ctx: CommandCtx,
  title: string,
  body: string,
  roles: readonly string[] = ['host', 'fnb_manager'],
  priority: 'normal' | 'high' = 'normal',
): void {
  for (const staff of Object.values(ctx.state.staff)) {
    if (!roles.includes(staff.role)) continue;
    const notifId = id('notif');
    ctx.state.notifications[notifId] = {
      id: notifId,
      createdAt: ctx.now,
      updatedAt: ctx.now,
      recipientId: staff.id,
      at: ctx.now,
      title,
      body,
      deepLink: 'amali://fnb/home',
      priority,
      read: false,
    };
  }
}

export function guestName(ctx: CommandCtx, r: Reservation): string {
  return r.walkIn ? 'Walk-in' : (ctx.state.residents[r.residentId]?.name ?? 'Guest');
}

/** Places the deposit hold for a reservation; `undefined` when it didn't fit (callers validate first). */
export function holdDeposit(ctx: CommandCtx, r: Reservation, fils: number): string | undefined {
  if (fils <= 0) return undefined;
  const holdId = id('hold');
  const result = placeHold(ctx.state.wallets[r.unitId], Object.values(ctx.state.walletHolds), {
    id: holdId,
    unitId: r.unitId,
    fils,
    label: `${VENUE_LABEL[r.venue]} deposit`,
    ref: { type: 'reservation', id: r.id },
    now: ctx.now,
    byResidentId: r.residentId,
  });
  if (!result.ok) return undefined;
  ctx.state.walletHolds[holdId] = result.hold;
  appendLedger(ctx, result.entry);
  return holdId;
}

export function releaseDeposit(ctx: CommandCtx, r: Reservation): number {
  const hold = r.depositHoldId ? ctx.state.walletHolds[r.depositHoldId] : undefined;
  if (!hold || hold.state !== 'active') return 0;
  const { hold: next, entry } = releaseHold(hold, ctx.now);
  ctx.state.walletHolds[hold.id] = next;
  appendLedger(ctx, entry);
  return hold.fils;
}

export function forfeitDeposit(ctx: CommandCtx, r: Reservation): number {
  const hold = r.depositHoldId ? ctx.state.walletHolds[r.depositHoldId] : undefined;
  if (!hold || hold.state !== 'active') return 0;
  const result = forfeitHold(ctx.state.wallets[r.unitId], hold, ctx.now);
  ctx.state.wallets[r.unitId] = result.wallet;
  ctx.state.walletHolds[hold.id] = result.hold;
  appendLedger(ctx, result.entry);
  return hold.fils;
}

export function aed(fils: number): string {
  return fmtAed(fils);
}
