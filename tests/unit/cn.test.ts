import { it, expect } from 'vitest';
import { cn } from '@/lib/cn';
it('keeps type token and colour', () => {
  expect(cn('text-label-3 text-brand')).toBe('text-label-3 text-brand');
  expect(cn('text-label-3', 'text-body-2')).toBe('text-body-2');
  expect(cn('text-brand', 'text-on-brand')).toBe('text-on-brand');
});
