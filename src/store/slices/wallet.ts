import type { WalletState, StoreSlice } from '../types';

export const createWalletSlice: StoreSlice<WalletState> = () => ({
  wallets: {},
  ledger: {},
  walletHolds: {},
});
