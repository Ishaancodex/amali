/**
 * Typed pub/sub for domain events (TRD §7.3). Subscribers are side-effect
 * modules (notifications, island queue, ticker, delivery simulator)
 * registered once at boot. Each phase adds its own `DomainEvent` variants
 * here as it's built — this file is the single place to look up what the
 * app can react to.
 */
import type { ISODateTime } from '@/types/common';

export interface BaseDomainEvent {
  at: ISODateTime;
}

export interface DemoScenarioChanged extends BaseDomainEvent {
  type: 'demo.scenarioChanged';
  scenarioId: string | null;
  step: number | null;
}

export interface DemoClockJumped extends BaseDomainEvent {
  type: 'demo.clockJumped';
  from: ISODateTime;
  to: ISODateTime;
}

/** Union of every domain event. Extend with `|` as each phase adds events. */
export type DomainEvent = DemoScenarioChanged | DemoClockJumped;

export type DomainEventType = DomainEvent['type'];

type Listener<E extends DomainEvent = DomainEvent> = (event: E) => void;

export class EventBus {
  private listeners = new Map<DomainEventType, Set<Listener>>();

  on<T extends DomainEventType>(type: T, listener: Listener<Extract<DomainEvent, { type: T }>>): () => void {
    const set = this.listeners.get(type) ?? new Set<Listener>();
    set.add(listener as Listener);
    this.listeners.set(type, set);
    return () => set.delete(listener as Listener);
  }

  emit(event: DomainEvent): void {
    this.listeners.get(event.type)?.forEach((listener) => listener(event));
  }

  clear(): void {
    this.listeners.clear();
  }
}

export const eventBus = new EventBus();
