/**
 * Route → component map (TRD §6). Bottom-nav roots: home, my-unit, search,
 * activity, profile. Pushed from Home's quick actions: amenities,
 * amenity-detail, whats-on, wallet.
 */
import type { RouteComponent } from '@/navigation/Navigator';
import type { DeviceSlotId } from '@/types/demo';
import { HomeScreen } from './screens/home/HomeScreen';
import { MyUnitScreen } from './screens/my-unit/MyUnitScreen';
import { SearchScreen } from './screens/search/SearchScreen';
import { ActivityScreen } from './screens/activity/ActivityScreen';
import { ProfileScreen } from './screens/profile/ProfileScreen';
import { AmenitiesListScreen } from './screens/amenities/AmenitiesListScreen';
import { AmenityDetailScreen } from './screens/amenities/AmenityDetailScreen';
import { WhatsOnScreen } from './screens/whats-on/WhatsOnScreen';
import { WalletScreen } from './screens/wallet/WalletScreen';
import { PadelBookScreen } from './screens/amenities/padel/PadelBookScreen';

export function residentRoutes(slot: DeviceSlotId): Record<string, RouteComponent> {
  return {
    home: () => <HomeScreen slot={slot} />,
    'my-unit': () => <MyUnitScreen slot={slot} />,
    search: () => <SearchScreen slot={slot} />,
    activity: () => <ActivityScreen slot={slot} />,
    profile: () => <ProfileScreen slot={slot} />,
    amenities: () => <AmenitiesListScreen slot={slot} />,
    'amenity-detail': (params) => <AmenityDetailScreen slot={slot} amenityKey={params.key ?? ''} />,
    'whats-on': () => <WhatsOnScreen slot={slot} />,
    wallet: () => <WalletScreen slot={slot} />,
    'padel-book': () => <PadelBookScreen slot={slot} />,
  };
}
