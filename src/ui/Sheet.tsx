'use client';

/**
 * Bottom sheet (PRD §5.7, M6). Drag the grabber to dismiss: velocity over
 * 500 or offset over 30% of the sheet's height dismisses; otherwise it
 * springs back.
 */
import { useRef } from 'react';
import { motion, type PanInfo } from 'motion/react';
import { spring, dur, ease } from '@/design/motion';

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
}

export function Sheet({ open, onClose, children, title }: SheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);

  if (!open) return null;

  function handleDragEnd(_: unknown, info: PanInfo) {
    const height = sheetRef.current?.offsetHeight ?? 400;
    if (info.velocity.y > 500 || info.offset.y > height * 0.3) {
      onClose();
    }
  }

  return (
    <>
      <motion.div
        className="bg-shell-stage fixed inset-0 z-40"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.4 }}
        exit={{ opacity: 0 }}
        transition={{ duration: dur.base, ease: ease.standard }}
        onClick={onClose}
      />
      <motion.div
        ref={sheetRef}
        className="rounded-t-bottom-sheet bg-surface fixed inset-x-0 bottom-0 z-50 max-h-[85%] overflow-y-auto pb-6"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={spring.soft}
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
  );
}
