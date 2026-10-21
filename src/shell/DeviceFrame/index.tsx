'use client';

import { useRef } from 'react';
import { MotionConfig } from 'motion/react';
import { deviceFrame, type DeviceKind } from '@/design/tokens';
import { useDeviceScale } from './useDeviceScale';
import { Phone } from './Phone';
import { Tablet } from './Tablet';
import { Browser } from './Browser';

export interface DeviceFrameProps {
  kind: DeviceKind;
  now: string;
  dir: 'ltr' | 'rtl';
  lang: string;
  themeClass?: string;
  island?: React.ReactNode;
  address?: string;
  reserveHeight?: number;
  maxScale?: number;
  children: React.ReactNode;
}

export { useDeviceScale } from './useDeviceScale';
export { Phone } from './Phone';
export { Tablet } from './Tablet';
export { Browser } from './Browser';
export { StatusBar } from './StatusBar';
export { DynamicIsland } from './DynamicIsland';

export function DeviceFrame({
  kind,
  now,
  dir,
  lang,
  themeClass,
  island,
  address,
  reserveHeight,
  maxScale,
  children,
}: DeviceFrameProps) {
  const { width, height } = deviceFrame[kind];
  const { scale, containerRef } = useDeviceScale({
    frameWidth: width,
    frameHeight: height,
    reserveHeight,
    maxScale,
  });

  // The frame is CSS-scaled. Motion measures layout in viewport pixels but applies transforms in
  // the frame's own pixels, so a shared-element morph would travel `scale`× too little. Mapping
  // viewport points into the frame's space makes layout animations (layoutId) exact.
  const scaledRef = useRef<HTMLDivElement>(null);
  const toFramePoint = (point: { x: number; y: number }) => {
    const rect = scaledRef.current?.getBoundingClientRect();
    return rect ? { x: (point.x - rect.left) / scale, y: (point.y - rect.top) / scale } : point;
  };

  return (
    <div
      ref={containerRef}
      // `overflow-clip`, not `hidden`: a hidden box can still be scrolled by the browser to reveal
      // a focused input near the bottom of a device, which shifts the whole frame up.
      className="flex h-full w-full items-start justify-center overflow-clip"
    >
      <div ref={scaledRef} style={{ transform: `scale(${scale})`, transformOrigin: 'top center' }}>
        <MotionConfig transformPagePoint={toFramePoint}>
          {kind === 'phone' && (
            <Phone now={now} dir={dir} lang={lang} themeClass={themeClass} island={island}>
              {children}
            </Phone>
          )}
          {kind === 'tablet' && (
            <Tablet now={now} dir={dir} lang={lang} themeClass={themeClass}>
              {children}
            </Tablet>
          )}
          {kind === 'browser' && (
            <Browser dir={dir} lang={lang} themeClass={themeClass} address={address}>
              {children}
            </Browser>
          )}
        </MotionConfig>
      </div>
    </div>
  );
}
