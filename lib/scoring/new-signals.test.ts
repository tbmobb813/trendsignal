import { describe, it, expect } from 'vitest';
import { analyzeSerpFreshness } from './freshness';
import { evaluateEngagementDensity } from './engagement';
import { evaluateBarrierToEntry } from './barrier-entry';

describe('SERP Freshness & Longevity Engine', () => {
  it('detects EVERGREEN when average video age is over 450 days', () => {
    const twoYearsAgo = new Date(Date.now() - 700 * 24 * 60 * 60 * 1000).toISOString();
    const mockVideos = [
      { publishedAt: twoYearsAgo },
      { publishedAt: twoYearsAgo },
    ];
    const res = analyzeSerpFreshness(mockVideos);
    expect(res.type).toBe('EVERGREEN');
  });

  it('detects HIGH_VELOCITY when average video age is under 120 days', () => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const mockVideos = [
      { publishedAt: thirtyDaysAgo },
      { publishedAt: thirtyDaysAgo },
    ];
    const res = analyzeSerpFreshness(mockVideos);
    expect(res.type).toBe('HIGH_VELOCITY');
    expect(res.avgAgeDays).toBeLessThanOrEqual(120);
  });
});

describe('Audience Engagement Density Engine', () => {
  it('scores coding & DIY as HIGH engagement density', () => {
    const res = evaluateEngagementDensity('python programming tutorial');
    expect(res.tier).toBe('HIGH');
    expect(res.score).toBe(90);
  });

  it('scores lofi & news as LOW engagement density (casual views)', () => {
    const res = evaluateEngagementDensity('relaxing lofi music background');
    expect(res.tier).toBe('LOW');
    expect(res.score).toBe(35);
  });
});

describe('Barrier to Entry & Skill Floor Engine', () => {
  it('rates coding & software as LOW barrier to entry', () => {
    const res = evaluateBarrierToEntry('python coding for beginners');
    expect(res.tier).toBe('LOW');
    expect(res.score).toBe(25);
  });

  it('rates machining & aviation as HIGH barrier to entry', () => {
    const res = evaluateBarrierToEntry('cnc machining aviation parts');
    expect(res.tier).toBe('HIGH');
    expect(res.score).toBe(88);
  });

  it('rates woodworking & cooking as MEDIUM barrier to entry', () => {
    const res = evaluateBarrierToEntry('woodworking workbench diy');
    expect(res.tier).toBe('MEDIUM');
    expect(res.score).toBe(55);
  });
});
