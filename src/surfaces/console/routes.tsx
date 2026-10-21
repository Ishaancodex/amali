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

export function consoleRoutes(slot: DeviceSlotId): Record<string, RouteComponent> {
  return {
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
}
