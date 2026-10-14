import type { AuditState, StoreSlice } from '../types';

export const createAuditSlice: StoreSlice<AuditState> = () => ({
  auditLog: [],
});
