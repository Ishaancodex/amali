import { deviceFrame } from '@/design/tokens';
import { StatusBar } from './StatusBar';

export interface TabletProps {
  now: string;
  dir: 'ltr' | 'rtl';
  lang: string;
  themeClass?: string;
  children: React.ReactNode;
}

const { width, height } = deviceFrame.tablet;

export function Tablet({ now, dir, lang, themeClass, children }: TabletProps) {
  return (
    <div
      className="relative shrink-0 rounded-[32px] bg-black p-[16px] shadow-2xl"
      style={{ width, height }}
    >
      <div
        dir={dir}
        lang={lang}
        className={`bg-bg-page relative flex h-full w-full flex-col overflow-hidden rounded-[18px] ${themeClass ?? ''}`}
      >
        <StatusBar now={now} />
        <div data-sheet-root className="relative min-h-0 flex-1 overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  );
}
