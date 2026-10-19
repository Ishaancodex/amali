'use client';

/**
 * Single-device page for a second screen (TRD §16.2): `/present?role=guard&persona=`.
 * No shell chrome — just one device frame, full-bleed, syncing with the
 * main tab over BroadcastChannel (TRD §8.2).
 */
import { Suspense, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useStore } from '@/store';
import { hydrateFromSeed, isStoreEmpty, restorePersistedJobs } from '@/store/bootstrap';
import { startSync } from '@/store/sync';
import { DeviceSlot } from '@/shell/DeviceSlot';
import { DEFAULT_ACTOR_FOR_ROLE } from '@/shell/TopBar/RolePill';
import type { Role } from '@/types/demo';

const VALID_ROLES: readonly Role[] = ['resident', 'whatsapp', 'guard', 'creche', 'fnb', 'console'];

function isRole(value: string | null): value is Role {
  return !!value && (VALID_ROLES as readonly string[]).includes(value);
}

function PresentContent() {
  const params = useSearchParams();
  const roleParam = params.get('role');
  const personaParam = params.get('persona');
  const setRole = useStore((s) => s.setRole);
  const deviceB = useStore((s) => s.demo.devices.B);

  useEffect(() => {
    if (isStoreEmpty()) hydrateFromSeed();
    else restorePersistedJobs();
    return startSync();
  }, []);

  useEffect(() => {
    if (!isRole(roleParam)) return;
    setRole('B', roleParam, personaParam ?? DEFAULT_ACTOR_FOR_ROLE[roleParam]);
  }, [roleParam, personaParam, setRole]);

  if (!deviceB) {
    return (
      <div className="bg-shell-stage text-body-2 text-shell-stage-text flex h-screen w-screen items-center justify-center">
        Add <code>?role=guard</code> (or resident/whatsapp/creche/fnb/console) to the URL.
      </div>
    );
  }

  return (
    <div className="bg-shell-stage h-screen w-screen p-6">
      <DeviceSlot slot="B" />
    </div>
  );
}

export default function PresentPage() {
  return (
    <Suspense fallback={null}>
      <PresentContent />
    </Suspense>
  );
}
