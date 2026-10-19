'use client';

/**
 * Vendors (PRD §8.8): profile, SLA performance over 90 days, and a
 * contract-expiry warning.
 */
import { TopBar } from '@/ui/TopBar';
import { Tag } from '@/ui/Tag';
import { useStore } from '@/store';
import { useNav } from '@/navigation/useNav';
import { minutesBetween } from '@/lib/time';
import { vendorPerformance } from '@/domain/ops/vendorPerformance';
import { rules } from '@/config/rules';
import type { DeviceSlotId } from '@/types/demo';

export function VendorsScreen({ slot }: { slot: DeviceSlotId }) {
  const { pop } = useNav(slot);
  const vendors = useStore((s) => s.vendors);
  const workOrders = useStore((s) => s.workOrders);
  const now = useStore((s) => s.demo.clock.now);

  return (
    <div className="flex h-full flex-col">
      <TopBar title="Vendors" onBack={pop} />
      <div className="flex-1 overflow-y-auto px-6 pb-8">
        <div className="mx-auto flex max-w-2xl flex-col gap-3">
          {Object.values(vendors).map((vendor) => {
            const { pctWithinSla, avgResolveMinutes, breaches } = vendorPerformance(
              Object.values(workOrders),
              vendor.id,
              now,
              rules.ops.slaAtRiskFraction,
            );
            const expiringWithin30Days = minutesBetween(now, vendor.contract.end) / (60 * 24) <= 30;

            return (
              <div key={vendor.id} className="rounded-card border-border-card border-[0.5px] p-4">
                <div className="flex items-center justify-between">
                  <span className="text-label-1 text-text-title">{vendor.name}</span>
                  {expiringWithin30Days && <Tag variant="warning">Contract expires soon</Tag>}
                </div>
                <p className="text-body-3 text-text-muted mt-0.5">{vendor.services.join(', ')}</p>
                <p className="text-body-3 text-text-muted">
                  {vendor.contact.name} · {vendor.contact.phone}
                </p>
                <div className="text-body-3 mt-2 flex gap-4">
                  <span>Within SLA: {pctWithinSla !== undefined ? `${pctWithinSla}%` : '—'}</span>
                  <span>
                    Avg resolve: {avgResolveMinutes !== undefined ? `${avgResolveMinutes}m` : '—'}
                  </span>
                  <span>Breaches: {breaches}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
