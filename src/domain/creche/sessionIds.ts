/** Morning/afternoon sessions have a readable, deterministic id per Dubai date. */
export function crecheSessionId(dateKey: string, kind: 'morning' | 'afternoon'): string {
  return `crsess_${dateKey}_${kind}`;
}
