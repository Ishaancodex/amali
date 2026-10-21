/**
 * Route → component map (TRD §6). Bottom-nav roots: home, my-unit, search,
 * activity, profile. Pushed from Home's quick actions: amenities,
 * amenity-detail, whats-on, wallet; creche-book/creche-pass from the
 * Kids' Club page; child-detail/child-register from My Unit.
 */
import type { RouteComponent } from '@/navigation/Navigator';
import type { DeviceSlotId } from '@/types/demo';
import type { VenueKey } from '@/types/dining';
import { HomeScreen } from './screens/home/HomeScreen';
import { MyUnitScreen } from './screens/my-unit/MyUnitScreen';
import { SearchScreen } from './screens/search/SearchScreen';
import { ActivityScreen } from './screens/activity/ActivityScreen';
import { ProfileScreen } from './screens/profile/ProfileScreen';
import { AmenitiesListScreen } from './screens/amenities/AmenitiesListScreen';
import { AmenityDetailScreen } from './screens/amenities/AmenityDetailScreen';
import { WhatsOnScreen } from './screens/whats-on/WhatsOnScreen';
import { EventDetailScreen } from './screens/whats-on/EventDetailScreen';
import { WalletScreen } from './screens/wallet/WalletScreen';
import { PadelBookScreen } from './screens/amenities/padel/PadelBookScreen';
import { PadelPassScreen } from './screens/amenities/padel/PadelPassScreen';
import { DiningBookScreen } from './screens/amenities/dining/DiningBookScreen';
import { ReservationDetailScreen } from './screens/amenities/dining/ReservationDetailScreen';
import { CrecheBookScreen } from './screens/amenities/creche/CrecheBookScreen';
import { CrechePassScreen } from './screens/amenities/creche/CrechePassScreen';
import { ChildDetailScreen } from './screens/my-unit/ChildDetailScreen';
import { RegisterChildScreen } from './screens/my-unit/RegisterChildScreen';

export function residentRoutes(slot: DeviceSlotId): Record<string, RouteComponent> {
  return {
    home: () => <HomeScreen slot={slot} />,
    'my-unit': () => <MyUnitScreen slot={slot} />,
    search: () => <SearchScreen slot={slot} />,
    activity: (params) => (
      <ActivityScreen slot={slot} initialTab={params.tab === 'bookings' ? 'bookings' : undefined} />
    ),
    profile: () => <ProfileScreen slot={slot} />,
    amenities: () => <AmenitiesListScreen slot={slot} />,
    'amenity-detail': (params) => (
      <AmenityDetailScreen
        slot={slot}
        amenityKey={params.key ?? ''}
        morph={params.transition === 'morph'}
      />
    ),
    'whats-on': () => <WhatsOnScreen slot={slot} />,
    'event-detail': (params) => (
      <EventDetailScreen
        slot={slot}
        eventId={params.eventId ?? ''}
        showtimeId={params.showtimeId}
      />
    ),
    wallet: () => <WalletScreen slot={slot} />,
    'padel-book': () => <PadelBookScreen slot={slot} />,
    'padel-pass': (params) => (
      <PadelPassScreen slot={slot} bookingId={params.id ?? ''} fresh={params.fresh === '1'} />
    ),
    'dining-book': (params) => (
      <DiningBookScreen slot={slot} initialVenue={params.venue as VenueKey | undefined} />
    ),
    'reservation-detail': (params) => (
      <ReservationDetailScreen
        slot={slot}
        reservationId={params.id ?? ''}
        zoneMissed={params.zone === 'missed'}
      />
    ),
    'creche-book': (params) => <CrecheBookScreen slot={slot} childId={params.child} />,
    'creche-pass': () => <CrechePassScreen slot={slot} />,
    'child-detail': (params) => <ChildDetailScreen slot={slot} childId={params.id ?? ''} />,
    'child-register': () => <RegisterChildScreen slot={slot} />,
  };
}
