import type { RouteComponent } from '@/navigation/Navigator';
import type { DeviceSlotId } from '@/types/demo';
import { CommunicationsScreen } from './screens/CommunicationsScreen';
import { ComposerScreen } from './screens/ComposerScreen';
import { AnnouncementDetailScreen } from './screens/AnnouncementDetailScreen';
import { OpsHomeScreen } from './screens/OpsHomeScreen';
import { ChecklistScreen } from './screens/ChecklistScreen';
import { WaterReadingScreen } from './screens/WaterReadingScreen';
import { RosterScreen } from './screens/RosterScreen';
import { IncidentsScreen } from './screens/IncidentsScreen';
import { WorkOrdersScreen } from './screens/WorkOrdersScreen';
import { WorkOrderDetailScreen } from './screens/WorkOrderDetailScreen';
import { VendorsScreen } from './screens/VendorsScreen';
import { AuditLogScreen } from './screens/AuditLogScreen';
import { ProgrammeScreen } from './screens/ProgrammeScreen';
import { SeriesEditorScreen } from './screens/SeriesEditorScreen';
import { OverviewScreen } from './screens/OverviewScreen';
import { ReportsScreen } from './screens/ReportsScreen';
import { ResidentsScreen } from './screens/ResidentsScreen';
import { BlackoutScreen } from './screens/BlackoutScreen';
import { RolesScreen } from './screens/RolesScreen';
import { NoPermission } from '@/ui/NoPermission';
import { canOpenRoute } from '@/config/consoleAccess';
import { useConsoleActor } from './useConsoleActor';

/** PRD §8.11: a deep link into a page this role can't open shows the no-permission state. */
function RouteGuard({
  slot,
  route,
  children,
}: {
  slot: DeviceSlotId;
  route: string;
  children: React.ReactNode;
}) {
  const { consoleRole } = useConsoleActor(slot);
  if (!canOpenRoute(consoleRole, route)) {
    return (
      <div className="flex h-full items-center justify-center">
        <NoPermission askWho="a Community Manager" />
      </div>
    );
  }
  return <>{children}</>;
}

export function consoleRoutes(slot: DeviceSlotId): Record<string, RouteComponent> {
  const routes: Record<string, RouteComponent> = {
    overview: () => <OverviewScreen slot={slot} />,
    reports: () => <ReportsScreen slot={slot} />,
    residents: () => <ResidentsScreen slot={slot} />,
    blackout: () => <BlackoutScreen slot={slot} />,
    roles: () => <RolesScreen />,
    home: () => <CommunicationsScreen slot={slot} />,
    composer: () => <ComposerScreen slot={slot} />,
    'announcement-detail': (params) => (
      <AnnouncementDetailScreen slot={slot} announcementId={params.id ?? ''} />
    ),
    ops: () => <OpsHomeScreen slot={slot} />,
    checklist: () => <ChecklistScreen slot={slot} />,
    water: () => <WaterReadingScreen slot={slot} />,
    roster: () => <RosterScreen slot={slot} />,
    incidents: () => <IncidentsScreen slot={slot} />,
    'work-orders': () => <WorkOrdersScreen slot={slot} />,
    'work-order-detail': (params) => (
      <WorkOrderDetailScreen slot={slot} workOrderId={params.id ?? ''} />
    ),
    vendors: () => <VendorsScreen slot={slot} />,
    'audit-log': () => <AuditLogScreen slot={slot} />,
    programme: () => <ProgrammeScreen slot={slot} />,
    'programme-edit': (params) => <SeriesEditorScreen slot={slot} programmeId={params.id} />,
  };
  return Object.fromEntries(
    Object.entries(routes).map(([route, render]) => [
      route,
      (params: Record<string, string>) => (
        <RouteGuard slot={slot} route={route}>
          {render(params)}
        </RouteGuard>
      ),
    ]),
  );
}
