import type { ResidentChannels } from '@/types/community';
import type { CommunityState, StoreSlice } from '../types';

export interface CommunityActions {
  /** Profile → notification channel settings (PRD §6.1 "Profile"). */
  updateResidentChannels: (residentId: string, patch: Partial<ResidentChannels>) => void;
}

export type CommunitySlice = CommunityState & CommunityActions;

declare module '../types' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- declaration merging
  interface RootActions extends CommunityActions {}
}

export const createCommunitySlice: StoreSlice<CommunitySlice> = (set) => ({
  units: {},
  residents: {},
  children: {},
  guardians: {},
  staff: {},
  vendors: {},

  updateResidentChannels: (residentId, patch) =>
    set((s) => {
      const resident = s.residents[residentId];
      if (resident) Object.assign(resident.channels, patch);
    }),
});
