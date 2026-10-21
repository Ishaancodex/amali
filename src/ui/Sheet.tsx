'use client';

/**
 * Bottom sheet (PRD §5.7, M6): slides up with `spring.soft`, the backdrop
 * fades to 40%, and both animate out on close. Drag the grabber to dismiss:
 * velocity over 500 or offset over 30% of the sheet's height dismisses;
 * otherwise it springs back. Esc closes it.
 */
import { useEffect, useRef } from 'react';
import { AnimatePresence, motion, type PanInfo } from 'motion/react';
import { backdrop, sheet } from '@/design/motion';

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
}

const DISMISS_VELOCITY = 500;
const DISMISS_FRACTION = 0.3;

export function Sheet({ open, onClose, children, title }: SheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    sheetRef.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  function handleDragEnd(_: unknown, info: PanInfo) {
    const height = sheetRef.current?.offsetHeight ?? 400;
    if (info.velocity.y > DISMISS_VELOCITY || info.offset.y > height * DISMISS_FRACTION) onClose();
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            className="bg-scrim fixed inset-0 z-40"
            variants={backdrop}
            initial="initial"
            animate="animate"
            exit="exit"
            onClick={onClose}
          />
          <motion.div
            key="sheet"
            ref={sheetRef}
            tabIndex={-1}
            className="rounded-t-bottom-sheet bg-surface fixed inset-x-0 bottom-0 z-50 max-h-[85%] overflow-y-auto pb-6 outline-none"
            variants={sheet}
            initial="initial"
            animate="animate"
            exit="exit"
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.5 }}
            onDragEnd={handleDragEnd}
            role="dialog"
            aria-modal="true"
            aria-label={title}
          >
            <div className="flex justify-center py-3">
              <span className="bg-border-card h-1 w-9 rounded-full" />
            </div>
            {title && <h2 className="text-title-l text-text-title px-5 pb-3">{title}</h2>}
            <div className="px-5">{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
