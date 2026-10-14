/**
 * Feature flags and presenter-tool defaults (TRD §4 folder structure,
 * referenced throughout PRD §4/§9/§16.6). Not business rules — those live in
 * `config/rules.ts`.
 */

export interface FeatureFlags {
  /** PRD §4.2 — render F&B and Management inside the phone frame instead of tablet/browser. */
  forcePhoneFrame: boolean;
  /** PRD §4.1 — the live event ticker, off by default. */
  ticker: boolean;
  /** TRD §9.5 — simulated first-load latency range, in ms. [0, 0] disables it (e.g. in tests). */
  simulatedLatencyMs: [number, number];
  /** TRD §9.5 — force a specific query key to resolve as an error, for demoing the error state. */
  forceErrorKey: string | null;
  /** TRD §8.4 — stretch goal; off in v1 (BroadcastChannel only). */
  remoteSync: boolean;
}

export const defaultFeatures: FeatureFlags = {
  forcePhoneFrame: false,
  ticker: false,
  simulatedLatencyMs: [300, 600],
  forceErrorKey: null,
  remoteSync: false,
};
