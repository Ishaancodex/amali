'use client';

/**
 * The presenter menu (PRD §4.1 Menu ≡): the scenario index plus presenter
 * tools (clock, dual view, motion speed, language, a link to the rules
 * config). Slides in from the end edge.
 */
import { motion } from 'motion/react';
import { X, ExternalLink } from 'lucide-react';
import { spring, dur, ease } from '@/design/motion';
import { ScenarioIndex } from '../ScenarioIndex';
import { ClockControls } from './ClockControls';
import { DualView } from './DualView';
import { MotionSpeed } from './MotionSpeed';
import { Language } from './Language';
import { Offline } from './Offline';

export function PresenterMenu({ onClose }: { onClose: () => void }) {
  return (
    <>
      <motion.div
        className="bg-shell-stage/60 fixed inset-0 z-40"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: dur.base, ease: ease.standard }}
        onClick={onClose}
      />
      <motion.div
        className="border-shell-stage-border bg-shell-stage fixed inset-y-0 end-0 z-50 flex w-[360px] flex-col overflow-y-auto border-s p-6"
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={spring.soft}
        role="dialog"
        aria-label="Scenario index and presenter tools"
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-title-l text-shell-stage-active">Menu</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="text-shell-stage-text hover:text-shell-stage-active flex h-8 w-8 items-center justify-center rounded-full"
          >
            <X className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>

        <section className="mb-6">
          <h3 className="font-shell-label text-shell-label text-shell-notes-label mb-2 uppercase">
            Scenarios
          </h3>
          <ScenarioIndex onSelect={onClose} />
        </section>

        <div className="bg-shell-stage-rule my-2 h-px" />

        <section className="space-y-5 py-4">
          <h3 className="font-shell-label text-shell-label text-shell-notes-label uppercase">
            Presenter tools
          </h3>
          <ClockControls />
          <DualView />
          <MotionSpeed />
          <Language />
          <Offline />
          <a
            href="/rules/"
            target="_blank"
            rel="noreferrer"
            className="text-label-3 text-brand flex items-center gap-1.5 hover:underline"
          >
            View rules config
            <ExternalLink className="h-3 w-3" strokeWidth={1.5} />
          </a>
        </section>
      </motion.div>
    </>
  );
}
