'use client';

/**
 * The demo shell (PRD §4). Composes the top bar, device frame(s), the
 * scenario notes panel (or its bottom-drawer fallback below 1200px — PRD
 * §4.1 "Responsive fallback"), the presenter menu and the event ticker.
 *
 * **Deferred from the PRD's responsive fallback:** the sub-600px mode
 * ("shell chrome hides, app renders full-screen, role switcher moves to a
 * long-press on the status bar") isn't built in Phase P1 — this prototype
 * is presented on a laptop/projector, not handed to someone on an actual
 * phone, and none of the P1 exit criteria depend on it. Revisit if a real
 * phone demo becomes a requirement.
 */
import { useEffect, useState } from 'react';
import { AnimatePresence, MotionConfig } from 'motion/react';
import { useStore } from '@/store';
import { hydrateFromSeed, isStoreEmpty, restorePersistedJobs } from '@/store/bootstrap';
import { startSync } from '@/store/sync';
import { DeviceSlot } from './DeviceSlot';
import { NotesPanel } from './NotesPanel';
import { PresenterMenu } from './PresenterMenu';
import { EventTicker } from './EventTicker';
import { PersonaPicker } from './PersonaPicker';
import { DemoClockBadge } from './DemoClockBadge';
import { RolePill } from './TopBar/RolePill';
import { ResetButton } from './TopBar/ResetButton';
import { MenuButton } from './TopBar/MenuButton';
import { useShellShortcuts } from './shortcuts';

export function Shell() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [notesDrawerOpen, setNotesDrawerOpen] = useState(false);
  const dualView = useStore((s) => s.demo.dualView);

  useEffect(() => {
    if (isStoreEmpty()) hydrateFromSeed();
    else restorePersistedJobs();
    return startSync();
  }, []);

  useShellShortcuts();

  return (
    <MotionConfig reducedMotion="user">
      <div className="bg-shell-stage flex h-screen flex-col overflow-hidden">
        <header className="flex h-16 shrink-0 items-center justify-between gap-4 px-6">
          <div className="flex items-center gap-3">
            <PersonaPicker />
            <DemoClockBadge />
          </div>
          <RolePill />
          <div className="flex items-center gap-2">
            <ResetButton />
            <MenuButton open={menuOpen} onClick={() => setMenuOpen((v) => !v)} />
          </div>
        </header>

        <div className="flex min-h-0 min-w-0 flex-1">
          <div className="flex min-h-0 min-w-0 flex-1 items-center justify-center gap-6 p-6 pb-16 min-[1200px]:pb-6">
            <div className="h-full min-h-0 min-w-0 flex-1">
              <DeviceSlot slot="A" />
            </div>
            {dualView && (
              <div className="h-full min-h-0 min-w-0 flex-1">
                <DeviceSlot slot="B" />
              </div>
            )}
          </div>

          <aside className="border-shell-stage-rule hidden w-[320px] shrink-0 border-s min-[1200px]:block">
            <NotesPanel />
          </aside>
        </div>

        <div className="fixed inset-x-0 bottom-0 z-30 min-[1200px]:hidden">
          <button
            type="button"
            onClick={() => setNotesDrawerOpen((v) => !v)}
            className="border-shell-stage-border bg-shell-stage-raised font-secondary text-shell-label text-shell-notes-label flex w-full items-center justify-center border-t py-2"
          >
            Scenario notes
          </button>
          <AnimatePresence>
            {notesDrawerOpen && (
              <div className="border-shell-stage-border bg-shell-stage h-64 border-t">
                <NotesPanel />
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <AnimatePresence>
        {menuOpen && <PresenterMenu onClose={() => setMenuOpen(false)} />}
      </AnimatePresence>
      <EventTicker />
    </MotionConfig>
  );
}
