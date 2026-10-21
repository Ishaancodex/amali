'use client';

/**
 * Ember header band for pushed resident screens: tracked-caps eyebrow, a serif-italic title, an
 * optional photo behind it (Ken Burns settle, fading to Ember so text never sits on the image),
 * and a back button. Pair with `BodySheet`, which overlaps its bottom edge.
 */
import { useState } from 'react';
import { motion } from 'motion/react';
import { ChevronLeft } from './icons';
import { Eyebrow } from './Eyebrow';
import { kenBurns } from '@/design/motion';
import { useT } from '@/i18n/hooks';

export function HeaderBand({
  eyebrow,
  title,
  onBack,
  right,
  image,
  imageLayoutId,
  imageKenBurns = true,
  tall = false,
  children,
}: {
  eyebrow?: string;
  title: string;
  onBack?: () => void;
  right?: React.ReactNode;
  /** Photo behind the title. */
  image?: string;
  /** Shared-element id so a list thumbnail morphs into this photo. */
  imageLayoutId?: string;
  /** Off when a shared-element morph is bringing the photo in. */
  imageKenBurns?: boolean;
  /** Photo screens use the taller band. */
  tall?: boolean;
  children?: React.ReactNode;
}) {
  const t = useT();
  const [imageFailed, setImageFailed] = useState(false);
  return (
    <header
      className={`ember-band grain flex flex-col px-5 pt-14 pb-12 ${tall ? 'min-h-72 justify-end' : ''}`}
    >
      {image && !imageFailed && (
        <>
          <motion.img
            layoutId={imageLayoutId}
            src={image}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            variants={kenBurns}
            initial={imageKenBurns ? 'initial' : false}
            animate="animate"
            onError={() => setImageFailed(true)}
          />
          <div className="bg-ember-veil absolute inset-0" />
        </>
      )}
      <div className="relative z-10 mb-4 flex min-h-10 items-center justify-between">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            aria-label={t('common.back')}
            className="border-ember-hairline text-on-ember bg-ember/30 flex h-10 w-10 items-center justify-center rounded-full border backdrop-blur-md"
          >
            <ChevronLeft className="h-5 w-5 rtl:-scale-x-100" strokeWidth={1.5} />
          </button>
        ) : (
          <span />
        )}
        {right}
      </div>
      <div className="relative z-10">
        {eyebrow && <Eyebrow className="text-on-ember block">{eyebrow}</Eyebrow>}
        <h1 className="font-serif-display text-serif-hero mt-2">{title}</h1>
        {children}
      </div>
    </header>
  );
}
