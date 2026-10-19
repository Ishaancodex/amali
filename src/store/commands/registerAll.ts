/**
 * Imports every command module for its registration side effect
 * (`defineCommand` calls at module load). Import this once, early — the
 * Shell and `/present` page both do, in `store/bootstrap.ts`. Each phase
 * adds its own command module's import here as it's built.
 */
import './wallet';
import './booking';
import './bookingOps';
import './waitlist';
import './blackout';
import './events';
import './rsvp';
import './eventWaitlist';
import './announcements';
import './amenityOps';
import './wa';
import './amenityStatus';
import './checklist';
import './cleaning';
import './water';
import './occupancy';
import './incidents';
import './workOrders';
import './roster';
import './notifications';
