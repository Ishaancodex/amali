'use client';

/**
 * Persona chip (PRD §4.1). On Resident/WhatsApp it's the current persona —
 * avatar, name, unit — and opens a list of the 6 complete personas
 * (PRD §3.2: "Only the six personas need to be complete records"). On
 * staff roles it shows the current staff member and opens a list scoped to
 * that role.
 */
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useStore } from '@/store';
import { PERSONA_IDS } from '@/seed/personaIds';
import type { Role, StaffRole } from '@/types';

const STAFF_ROLES_FOR: Partial<Record<Role, StaffRole[]>> = {
  guard: ['guard'],
  creche: ['creche_lead', 'creche_carer'],
  fnb: ['fnb_manager', 'host', 'chef'],
  console: ['community_manager', 'amenity_supervisor', 'call_centre'],
};

function humanize(value: string): string {
  return value
    .split('_')
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(' ');
}

function Avatar({ initials }: { initials: string }) {
  return (
    <span className="bg-shell-stage-active text-label-3 text-shell-stage-active-text flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-medium">
      {initials}
    </span>
  );
}

export function PersonaPicker() {
  const [open, setOpen] = useState(false);
  const role = useStore((s) => s.demo.devices.A.role);
  const actorId = useStore((s) => s.demo.devices.A.actorId);
  const setPersona = useStore((s) => s.setPersona);
  const residents = useStore((s) => s.residents);
  const units = useStore((s) => s.units);
  const staff = useStore((s) => s.staff);

  const isResidentFacing = role === 'resident' || role === 'whatsapp';
  const resident = isResidentFacing ? residents[actorId] : undefined;
  const staffMember = !isResidentFacing ? staff[actorId] : undefined;

  const options = isResidentFacing
    ? Object.values(PERSONA_IDS)
        .map((id) => residents[id])
        .filter((r): r is NonNullable<typeof r> => !!r)
    : Object.values(staff).filter((s) => STAFF_ROLES_FOR[role]?.includes(s.role));

  function handlePick(id: string) {
    setPersona('A', id);
    setOpen(false);
  }

  const chipLabel = resident
    ? {
        title: resident.name,
        subtitle: units[resident.unitId]?.id ?? resident.unitId,
        initials: resident.avatar,
      }
    : staffMember
      ? {
          title: staffMember.name,
          subtitle: staffMember.post ?? humanize(staffMember.role),
          initials: staffMember.avatar,
        }
      : { title: 'Select persona', subtitle: '', initials: '—' };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="bg-shell-stage-raised hover:bg-shell-stage-border flex items-center gap-2 rounded-full py-1 ps-1 pe-3 transition-colors"
      >
        <Avatar initials={chipLabel.initials} />
        <span className="text-start">
          <span className="text-label-3 text-shell-stage-active block">{chipLabel.title}</span>
          {chipLabel.subtitle && (
            <span className="text-body-3 text-shell-stage-text block">{chipLabel.subtitle}</span>
          )}
        </span>
        <ChevronDown className="text-shell-stage-text h-3.5 w-3.5" strokeWidth={1.5} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="rounded-card border-shell-stage-border bg-shell-stage-raised absolute start-0 top-full z-40 mt-2 w-64 overflow-hidden border py-1 shadow-xl">
            {options.length === 0 && (
              <p className="text-body-3 text-shell-stage-text px-3 py-2">
                No one to pick from yet.
              </p>
            )}
            {options.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => handlePick(opt.id)}
                className="hover:bg-shell-stage-border flex w-full items-center gap-2 px-3 py-2 text-start transition-colors"
              >
                <Avatar initials={opt.avatar} />
                <span>
                  <span className="text-label-3 text-shell-stage-active block">{opt.name}</span>
                  <span className="text-body-3 text-shell-stage-text block">
                    {'unitId' in opt
                      ? (units[opt.unitId]?.id ?? opt.unitId)
                      : (opt.post ?? humanize(opt.role))}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
