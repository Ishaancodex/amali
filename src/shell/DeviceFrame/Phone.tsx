import { deviceFrame } from '@/design/tokens';
import { StatusBar } from './StatusBar';
import { DynamicIsland } from './DynamicIsland';

export interface PhoneProps {
  now: string;
  dir: 'ltr' | 'rtl';
  lang: string;
  themeClass?: string;
  island?: React.ReactNode;
  children: React.ReactNode;
}

const { width, height } = deviceFrame.phone;

export function Phone({ now, dir, lang, themeClass, island, children }: PhoneProps) {
  return (
    <div
      className="relative shrink-0 rounded-[56px] bg-black p-[14px] shadow-2xl"
      style={{ width, height }}
    >
      <div
        dir={dir}
        lang={lang}
        className={`bg-bg-page relative flex h-full w-full flex-col overflow-hidden rounded-[42px] ${themeClass ?? ''}`}
      >
        <StatusBar now={now} />
        <DynamicIsland>{island}</DynamicIsland>
        <div data-sheet-root className="relative min-h-0 flex-1 overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  );
}
