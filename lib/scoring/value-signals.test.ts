import { describe, it, expect } from 'vitest';
import { calculateRevenueDiversity } from './revenue-diversity';
import { evaluateCopyrightRisk } from './copyright-risk';
import { evaluateThumbnailDensity } from './thumbnail-density';

describe('Revenue Diversity Rating Engine', () => {
  it('identifies coding queries as high revenue diversity', () => {
    const res = calculateRevenueDiversity('python coding course');
    expect(res.score).toBeGreaterThanOrEqual(75);
    expect(res.digitalScore).toBe(90);
  });

  it('identifies meme queries as low revenue diversity', () => {
    const res = calculateRevenueDiversity('funny gaming memes compilation');
    expect(res.score).toBeLessThan(45);
    expect(res.sponsorScore).toBe(20);
  });
});

describe('Copyright & Content ID Claim Risk Guard', () => {
  it('detects HIGH_RISK for movie/sports reaction highlights', () => {
    const res = evaluateCopyrightRisk('nba basketball highlights reaction');
    expect(res.status).toBe('HIGH_RISK');
    expect(res.score).toBe(25);
  });

  it('detects CAUTION for gaming queries', () => {
    const res = evaluateCopyrightRisk('minecraft gaming gameplay let\'s play');
    expect(res.status).toBe('CAUTION');
    expect(res.score).toBe(70);
  });

  it('detects SAFE for pottery/original tutorials', () => {
    const res = evaluateCopyrightRisk('pottery throwing tutorials');
    expect(res.status).toBe('SAFE');
    expect(res.score).toBe(98);
  });
});

describe('Thumbnail Saturated Density Index', () => {
  it('detects RED_OCEAN for gaming/trading clickbait queries', () => {
    const res = evaluateThumbnailDensity('crypto trading challenge gameplay');
    expect(res.type).toBe('RED_OCEAN');
    expect(res.score).toBe(30);
  });

  it('detects AESTHETIC_OPPORTUNITY for coding/pottery queries', () => {
    const res = evaluateThumbnailDensity('python programming tutorial');
    expect(res.type).toBe('AESTHETIC_OPPORTUNITY');
    expect(res.score).toBe(90);
  });

  it('detects BALANCED for default queries', () => {
    const res = evaluateThumbnailDensity('restoring vintage mechanical calculators');
    expect(res.type).toBe('BALANCED');
    expect(res.score).toBe(60);
  });
});
