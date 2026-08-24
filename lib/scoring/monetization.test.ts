import { describe, it, expect } from 'vitest';
import { getMonetizationBenchmark } from './monetization';

describe('getMonetizationBenchmark', () => {
  it('matches finance & crypto keywords to HIGH CPM tier', () => {
    const res = getMonetizationBenchmark('crypto trading for beginners');
    expect(res.matchedBy).toBe('keyword');
    expect(res.benchmark.cpmTier).toBe('HIGH');
    expect(res.benchmark.monetizationScore).toBe(100);
    expect(res.benchmark.rpmRange).toContain('$18.00');
  });

  it('matches tech & coding keywords to HIGH CPM tier', () => {
    const res = getMonetizationBenchmark('python coding tutorial');
    expect(res.matchedBy).toBe('keyword');
    expect(res.benchmark.cpmTier).toBe('HIGH');
    expect(res.benchmark.id).toBe('tech');
  });

  it('matches gaming keywords to LOW CPM tier', () => {
    const res = getMonetizationBenchmark('minecraft survival guide');
    expect(res.matchedBy).toBe('keyword');
    expect(res.benchmark.cpmTier).toBe('LOW');
    expect(res.benchmark.id).toBe('gaming');
  });

  it('returns default fallback for unknown query terms', () => {
    const res = getMonetizationBenchmark('xyz123 random topic');
    expect(res.matchedBy).toBe('default');
    expect(res.benchmark.cpmTier).toBe('MEDIUM');
    expect(res.benchmark.monetizationScore).toBe(55);
  });

  it('does NOT match "how to make money on youtube" to finance (regression test)', () => {
  const res = getMonetizationBenchmark('how to make money on youtube');
  expect(res.benchmark.id).not.toBe('finance');
});
});
