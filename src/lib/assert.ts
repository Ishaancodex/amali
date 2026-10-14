export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`[assert] ${message}`);
  }
}

export function assertNever(value: never, message = 'Unexpected value'): never {
  throw new Error(`[assertNever] ${message}: ${JSON.stringify(value)}`);
}

export function defined<T>(value: T | undefined | null, message = 'Expected a value'): T {
  assert(value !== undefined && value !== null, message);
  return value;
}
