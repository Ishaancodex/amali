import { deviceFrame } from '@/design/tokens';

export interface BrowserProps {
  dir: 'ltr' | 'rtl';
  lang: string;
  themeClass?: string;
  address?: string;
  children: React.ReactNode;
}

const { width, height } = deviceFrame.browser;
const TRAFFIC_LIGHT_CLASSES = ['bg-danger', 'bg-warning', 'bg-success'];

export function Browser({
  dir,
  lang,
  themeClass,
  address = 'amali.app/console',
  children,
}: BrowserProps) {
  return (
    <div
      className="bg-browser-chrome-frame relative shrink-0 overflow-hidden rounded-xl shadow-2xl"
      style={{ width, height }}
    >
      <div className="border-border-card bg-browser-chrome-toolbar flex h-10 shrink-0 items-center gap-3 border-b px-4">
        <div className="flex gap-2">
          {TRAFFIC_LIGHT_CLASSES.map((cls) => (
            <span key={cls} className={`h-3 w-3 rounded-full ${cls}`} />
          ))}
        </div>
        <div className="text-body-3 text-text-muted flex h-6 flex-1 items-center rounded-md bg-white px-3">
          {address}
        </div>
      </div>
      <div
        dir={dir}
        lang={lang}
        className={`bg-bg-page relative flex overflow-hidden ${themeClass ?? ''}`}
        style={{ height: height - 40 }}
      >
        {children}
      </div>
    </div>
  );
}
