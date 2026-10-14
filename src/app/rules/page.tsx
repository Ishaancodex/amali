import { rules } from '@/config/rules';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-title-l text-text-title">{title}</h2>
      {children}
    </section>
  );
}

function Json({ value }: { value: unknown }) {
  return (
    <pre className="rounded-card border-border-card bg-surface text-body-3 text-text-body overflow-x-auto border p-4">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

export default function RulesPage() {
  return (
    <main className="mx-auto max-w-3xl space-y-8 p-8">
      <header>
        <h1 className="text-display text-text-title">Rules config</h1>
        <p className="text-body-2 text-text-muted">
          Every business number in the prototype, read live from <code>src/config/rules.ts</code>{' '}
          (PRD §8). Mock values — see PRD §18.
        </p>
      </header>

      {Object.entries(rules).map(([key, value]) => (
        <Section key={key} title={key}>
          <Json value={value} />
        </Section>
      ))}
    </main>
  );
}
