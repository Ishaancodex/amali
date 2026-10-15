/**
 * Wallet commands (PRD §8.4). Registered once, at module load — imported
 * from `store/commands/registerAll.ts` so the registration side effect
 * actually runs before `dispatch()` is ever called.
 */
import { id } from '@/lib/ids';
import { applyTopUp, type TopUpInput } from '@/domain/wallet/ledger';
import { defineCommand } from './registry';
import type { CommandResult } from './types';
import type { Wallet } from '@/types/wallet';

export interface WalletTopUpInput {
  unitId: string;
  amountFils: number;
  simulateDecline?: boolean;
}

declare module './types' {
  interface CommandRegistry {
    'wallet.topUp': { input: WalletTopUpInput; output: Wallet };
  }
}

defineCommand<'wallet.topUp'>({
  name: 'wallet.topUp',
  run: (ctx, input) => {
    const topUpInput: TopUpInput = {
      unitId: input.unitId,
      amountFils: input.amountFils,
      byResidentId: ctx.actor.id,
      now: ctx.now,
      simulateDecline: input.simulateDecline,
    };

    const result = applyTopUp(ctx.state.wallets[input.unitId], topUpInput);

    if (!result.ok) {
      return {
        ok: false,
        error: { code: result.code, message: result.message },
      };
    }

    ctx.state.wallets[input.unitId] = result.wallet;
    const entryId = id('ledger');
    ctx.state.ledger[entryId] = { id: entryId, ...result.entry };

    return {
      ok: true,
      value: result.wallet,
      events: [],
      jobs: [],
      audit: {
        action: 'wallet.topUp',
        target: { type: 'wallet', id: input.unitId },
        after: { balanceFils: result.wallet.balanceFils, amountFils: input.amountFils },
      },
    } satisfies CommandResult<Wallet>;
  },
});
