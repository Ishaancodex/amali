/**
 * Registration (PRD §8.3): register a child against the unit (the
 * household become its default guardians), add a guardian — a
 * non-resident needs a photo and Creche Lead approval — and the lead's
 * approve/reject.
 */
import { id } from '@/lib/ids';
import { rules } from '@/config/rules';
import { dubaiDateKey } from '@/lib/time';
import { reject } from '@/domain/rules/errors';
import { bandForChild } from '@/domain/creche/bands';
import { needsApproval } from '@/domain/creche/guardians';
import { crecheBands } from './crecheHelpers';
import { actorUnitId } from './creche';
import { defineCommand } from './registry';
import type { CommandResult } from './types';
import type { Child, Guardian } from '@/types/creche';

export interface CrecheRegisterChildInput {
  name: string;
  dob: string;
  allergies?: Child['allergies'];
  dietary?: string;
  photoConsent: boolean;
  emergencyContact: Child['emergencyContact'];
}

export interface CrecheAddGuardianInput {
  childId: string;
  name: string;
  relation: string;
  phone: string;
  photo: string;
  idLast4: string;
  validUntil?: string;
}

export interface CrecheDecideGuardianInput {
  guardianId: string;
  decision: 'approved' | 'rejected';
}

declare module './types' {
  interface CommandRegistry {
    'creche.registerChild': { input: CrecheRegisterChildInput; output: Child };
    'creche.addGuardian': { input: CrecheAddGuardianInput; output: Guardian };
    'creche.decideGuardian': { input: CrecheDecideGuardianInput; output: Guardian };
  }
}

defineCommand<'creche.registerChild'>({
  name: 'creche.registerChild',
  run: (ctx, input) => {
    const unitId = actorUnitId(ctx);
    if (!unitId)
      return { ok: false, error: reject('NOT_ELIGIBLE', 'Only residents can register a child.') };
    const band = bandForChild(
      input.dob,
      dubaiDateKey(ctx.now),
      crecheBands(),
      rules.creche.minAcceptedAge,
    );
    if (!band.ok)
      return { ok: false, error: reject('AGE_RESTRICTED', band.message, { age: band.age }) };
    if (!input.name.trim())
      return { ok: false, error: reject('NOT_ELIGIBLE', 'Enter the child’s name.') };

    const childId = id('child');
    // Default guardians: the unit's residents (parents and household), up to the maximum.
    const household = Object.values(ctx.state.residents)
      .filter((r) => r.unitId === unitId)
      .slice(0, rules.creche.guardians.max);
    const guardianIds = household.map((resident) => {
      const existing = Object.values(ctx.state.guardians).find((g) => g.residentId === resident.id);
      if (existing) {
        existing.childIds.push(childId);
        return existing.id;
      }
      const guardianId = id('guardian');
      ctx.state.guardians[guardianId] = {
        id: guardianId,
        createdAt: ctx.now,
        updatedAt: ctx.now,
        childIds: [childId],
        name: resident.name,
        relation: resident.type === 'household' ? 'Household' : 'Parent',
        phone: resident.phone,
        photo: resident.avatar,
        idLast4: '0000',
        residentId: resident.id,
        approval: 'approved',
      };
      return guardianId;
    });

    const child: Child = {
      id: childId,
      createdAt: ctx.now,
      updatedAt: ctx.now,
      unitId,
      name: input.name.trim(),
      dob: input.dob,
      photo: input.name.trim().slice(0, 2).toUpperCase(),
      allergies: input.allergies?.text.trim() ? input.allergies : undefined,
      dietary: input.dietary?.trim() || undefined,
      photoConsent: input.photoConsent,
      guardianIds,
      emergencyContact: input.emergencyContact,
    };
    ctx.state.children[childId] = child;

    return {
      ok: true,
      value: child,
      events: [],
      jobs: [],
      audit: {
        action: 'creche.registerChild',
        target: { type: 'child', id: childId },
        after: { unitId },
      },
    } satisfies CommandResult<Child>;
  },
});

defineCommand<'creche.addGuardian'>({
  name: 'creche.addGuardian',
  run: (ctx, input) => {
    const child = ctx.state.children[input.childId];
    if (!child || actorUnitId(ctx) !== child.unitId) {
      return {
        ok: false,
        error: reject('NOT_ELIGIBLE', 'Only the child’s household can add a guardian.'),
      };
    }
    if (child.guardianIds.length >= rules.creche.guardians.max) {
      return {
        ok: false,
        error: reject('GUEST_LIMIT', `Up to ${rules.creche.guardians.max} guardians per child.`),
      };
    }
    if (!input.photo.trim()) {
      return {
        ok: false,
        error: reject('NOT_ELIGIBLE', 'A photo is required for a new guardian.'),
      };
    }
    const resident = Object.values(ctx.state.residents).find(
      (r) => r.unitId === child.unitId && r.name === input.name.trim(),
    );
    const guardianId = id('guardian');
    const guardian: Guardian = {
      id: guardianId,
      createdAt: ctx.now,
      updatedAt: ctx.now,
      childIds: [child.id],
      name: input.name.trim(),
      relation: input.relation.trim() || 'Guardian',
      phone: input.phone,
      photo: input.photo,
      idLast4: input.idLast4,
      residentId: resident?.id,
      validUntil: input.validUntil,
      approval: needsApproval(resident?.id) ? 'pending' : 'approved',
    };
    ctx.state.guardians[guardianId] = guardian;
    child.guardianIds.push(guardianId);
    child.updatedAt = ctx.now;

    return {
      ok: true,
      value: guardian,
      events: [],
      jobs: [],
      audit: {
        action: 'creche.addGuardian',
        target: { type: 'guardian', id: guardianId },
        after: { childId: child.id, approval: guardian.approval },
      },
    } satisfies CommandResult<Guardian>;
  },
});

defineCommand<'creche.decideGuardian'>({
  name: 'creche.decideGuardian',
  run: (ctx, input) => {
    if (ctx.actor.kind !== 'staff' || ctx.state.staff[ctx.actor.id]?.role !== 'creche_lead') {
      return {
        ok: false,
        error: { code: 'NO_PERMISSION', message: 'Only the Creche Lead can approve guardians.' },
      };
    }
    const guardian = ctx.state.guardians[input.guardianId];
    if (!guardian) return { ok: false, error: reject('NOT_ELIGIBLE', 'Guardian not found.') };
    const before = guardian.approval;
    guardian.approval = input.decision;
    guardian.updatedAt = ctx.now;

    return {
      ok: true,
      value: guardian,
      events: [],
      jobs: [],
      audit: {
        action: 'creche.decideGuardian',
        target: { type: 'guardian', id: guardian.id },
        before: { approval: before },
        after: { approval: input.decision },
      },
    } satisfies CommandResult<Guardian>;
  },
});
