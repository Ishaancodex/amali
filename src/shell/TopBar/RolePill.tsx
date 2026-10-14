'use client';

/**
 * The six-role segmented control (PRD §4.1). The active segment is an
 * inverted (cream-on-dark) fill, and a shared `layoutId` slides the
 * indicator between segments (PRD M1 `pill-slide`). Keys `1`-`6` switch
 * roles — wired in `shell/shortcuts.ts`, not here.
 */
import { motion } from 'motion/react';
import { useStore } from '@/store';
import { spring } from '@/design/motion';
import { PERSONA_IDS, STAFF_IDS } from '@/seed/personaIds';
import type { Role } from '@/types/demo';

const ROLES: { role: Role; label: string }[] = [
  { role: 'resident', label: 'Resident' },
  { role: 'whatsapp', label: 'WhatsApp' },
  { role: 'guard', label: 'Guard' },
  { role: 'creche', label: 'Creche' },
  { role: 'fnb', label: 'F&B' },
  { role: 'console', label: 'Management' },
];

/** Sensible default actor when a role is selected for the first time this session. */
export const DEFAULT_ACTOR_FOR_ROLE: Record<Role, string> = {
  resident: PERSONA_IDS.layla,
  whatsapp: PERSONA_IDS.layla,
  guard: STAFF_IDS.guardImran,
  creche: STAFF_IDS.crecheMaria,
  fnb: STAFF_IDS.fnbMarco,
  console: STAFF_IDS.cmHana,
};

export function selectRole(slot: 'A' | 'B', nextRole: Role): void {
  const { setRole, setConsoleRole } = useStore.getState();
  setRole(slot, nextRole, DEFAULT_ACTOR_FOR_ROLE[nextRole]);
  if (nextRole === 'console') setConsoleRole(slot, 'community_manager');
}

export function RolePill() {
  const role = useStore((s) => s.demo.devices.A.role);

  return (
    <div className="bg-shell-stage-raised inline-flex items-center gap-1 rounded-full p-1">
      {ROLES.map(({ role: r, label }) => {
        const active = r === role;
        return (
          <button
            key={r}
            type="button"
            onClick={() => selectRole('A', r)}
            aria-pressed={active}
            className={`font-shell-label text-shell-label relative rounded-full px-4 py-1.5 uppercase transition-colors ${
              active
                ? 'text-shell-stage-active-text'
                : 'text-shell-stage-text hover:text-shell-stage-active'
            }`}
          >
            {active && (
              <motion.span
                layoutId="role-pill-indicator"
                className="bg-shell-stage-active absolute inset-0 rounded-full"
                transition={spring.snappy}
              />
            )}
            <span className="relative z-10">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
