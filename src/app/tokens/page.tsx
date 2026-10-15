import {
  appColor,
  staffColor,
  shellColor,
  appType,
  shellType,
  spacingScale,
  radius,
  shadow,
  type TypeStyle,
} from '@/design/tokens';
import { dur, ease } from '@/design/motion';

const fontVar: Record<TypeStyle['font'], string> = {
  primary: 'var(--font-poppins)',
  secondary: 'var(--font-barlow)',
  script: 'var(--font-script-accent)',
};

function Swatch({ name, hex }: { name: string; hex: string }) {
  return (
    <div className="flex flex-col gap-2">
      <div
        className="rounded-card border-border-card h-16 w-full border"
        style={{ backgroundColor: hex }}
      />
      <div className="text-body-3 text-text-muted">
        <div className="text-text-body font-medium">{name}</div>
        <div>{hex}</div>
      </div>
    </div>
  );
}

function TypeRow({
  name,
  cssClass,
  style,
  sample,
}: {
  name: string;
  cssClass: string;
  style: TypeStyle;
  sample: string;
}) {
  return (
    <div className="border-border-card flex items-baseline gap-6 border-b py-4">
      <div className="text-body-3 text-text-muted w-32 shrink-0">
        <div className="text-text-body font-medium">{name}</div>
        <div>
          {style.sizePx}/{style.lineHeightPx} · {style.weight}
        </div>
      </div>
      <div className={cssClass} style={{ fontFamily: fontVar[style.font] }}>
        {sample}
      </div>
    </div>
  );
}

export default function TokensPage() {
  return (
    <main className="mx-auto max-w-4xl space-y-12 p-8">
      <header>
        <h1 className="text-display text-text-title">Design tokens</h1>
        <p className="text-body-2 text-text-muted">
          Generated from <code>src/design/tokens.ts</code>. Dev-only preview page (TRD §4, Phase P0
          exit criteria).
        </p>
      </header>

      <section>
        <h2 className="text-title-l text-text-title mb-4">App colour (light)</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Object.entries(appColor).map(([name, hex]) => (
            <Swatch key={name} name={name} hex={hex} />
          ))}
        </div>
      </section>

      <section className="staff rounded-card bg-bg-page p-6">
        <h2 className="text-title-l text-text-title mb-4">Staff theme (Guard, Creche)</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Object.entries(staffColor).map(([name, hex]) => (
            <Swatch key={name} name={name} hex={hex} />
          ))}
        </div>
      </section>

      <section className="shell rounded-card bg-shell-stage p-6">
        <h2 className="text-title-l text-shell-stage-active mb-4">Shell (stage) tokens</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Object.entries(shellColor).map(([name, hex]) => (
            <Swatch key={name} name={name} hex={hex} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-title-l text-text-title mb-2">App type ramp</h2>
        <div>
          <TypeRow
            name="display"
            cssClass="text-display"
            style={appType.display}
            sample="Good evening, Layla"
          />
          <TypeRow
            name="title-l"
            cssClass="text-title-l"
            style={appType.titleL}
            sample="Padel Tennis Court"
          />
          <TypeRow
            name="label-1"
            cssClass="text-label-1"
            style={appType.label1}
            sample="Amenity card title"
          />
          <TypeRow
            name="label-2"
            cssClass="text-label-2"
            style={appType.label2}
            sample="List title / emphasis"
          />
          <TypeRow
            name="label-3"
            cssClass="text-label-3"
            style={appType.label3}
            sample="Active nav label"
          />
          <TypeRow
            name="body-2"
            cssClass="text-body-2"
            style={appType.body2}
            sample="Body copy, the default size for most text."
          />
          <TypeRow
            name="body-3"
            cssClass="text-body-3"
            style={appType.body3}
            sample="Meta text and timestamps · 18:42"
          />
          <TypeRow
            name="button"
            cssClass="text-button"
            style={appType.button}
            sample="Confirm booking"
          />
          <TypeRow name="tag" cssClass="text-tag" style={appType.tag} sample="Open" />
          <TypeRow
            name="script-accent"
            cssClass="text-script-accent"
            style={appType.scriptAccent}
            sample="Good evening"
          />
        </div>
      </section>

      <section className="shell rounded-card bg-shell-stage p-6">
        <h2 className="text-title-l text-shell-stage-active mb-2">Shell type ramp</h2>
        <div>
          <TypeRow
            name="shell-heading"
            cssClass="text-shell-heading text-shell-stage-active"
            style={shellType.heading}
            sample="Padel blackout"
          />
          <TypeRow
            name="shell-number"
            cssClass="text-shell-number text-shell-stage-active"
            style={shellType.number}
            sample="03"
          />
          <TypeRow
            name="shell-body"
            cssClass="text-shell-body text-shell-notes-body"
            style={shellType.body}
            sample="The court is closed for resurfacing, 15–16 Oct."
          />
          <TypeRow
            name="shell-label"
            cssClass="text-shell-label text-shell-notes-label"
            style={shellType.label}
            sample="Scenario notes"
          />
        </div>
      </section>

      <section>
        <h2 className="text-title-l text-text-title mb-4">Spacing scale</h2>
        <div className="flex flex-wrap items-end gap-3">
          {spacingScale.map((px) => (
            <div key={px} className="flex flex-col items-center gap-1">
              <div className="bg-brand" style={{ width: px, height: px }} />
              <span className="text-body-3 text-text-muted">{px}</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-title-l text-text-title mb-4">Radii</h2>
        <div className="grid grid-cols-3 gap-4 sm:grid-cols-6">
          {Object.entries(radius).map(([name, px]) => (
            <div key={name} className="flex flex-col items-center gap-2">
              <div
                className="border-border-card bg-brand-tint h-16 w-16 border"
                style={{ borderRadius: px }}
              />
              <span className="text-body-3 text-text-muted">
                {name} · {px}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-title-l text-text-title mb-4">Shadows</h2>
        <div className="flex gap-8">
          <div className="rounded-card bg-surface h-20 w-40" style={{ boxShadow: shadow.bar }} />
          <div
            className="rounded-card bg-surface h-20 w-40"
            style={{ boxShadow: shadow.cardHover }}
          />
        </div>
      </section>

      <section>
        <h2 className="text-title-l text-text-title mb-4">Motion</h2>
        <table className="text-body-2 w-full">
          <tbody>
            {Object.entries(dur).map(([name, seconds]) => (
              <tr key={name} className="border-border-card border-b">
                <td className="text-text-muted py-2">dur.{name}</td>
                <td className="text-text-body py-2 font-medium">{seconds * 1000}ms</td>
              </tr>
            ))}
            {Object.entries(ease).map(([name, curve]) => (
              <tr key={name} className="border-border-card border-b">
                <td className="text-text-muted py-2">ease.{name}</td>
                <td className="text-text-body py-2 font-medium">
                  cubic-bezier({curve.join(', ')})
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
