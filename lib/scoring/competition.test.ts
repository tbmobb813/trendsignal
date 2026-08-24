import fs from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';
import {
  computeChannelMetrics,
  computeCrossQueryAppearances,
  computeCompetitionScore,
} from './competition';
import { YouTubeNicheRawData, YouTubeChannelStats } from '../youtube';
import { TrendsRawData, calculateTrendLifecycle } from '../trends';

const FIXTURE_DIR = path.join(__dirname, '..', '..', 'test-data');

function loadFixture(filename: string): YouTubeNicheRawData {
  const raw = fs.readFileSync(path.join(FIXTURE_DIR, filename), 'utf-8');
  return JSON.parse(raw);
}

describe('YouTube Niche Competition Scorer', () => {
  describe('computeChannelMetrics', () => {
    it('correctly calculates basic channel metrics and flags thin channels', () => {
      const normalChannel: YouTubeChannelStats = {
        channelId: 'ch-1',
        title: 'Normal Channel',
        subscriberCount: 50000,
        viewCount: 1000000,
        videoCount: 150,
        publishedAt: '2020-01-01T00:00:00Z',
      };

      const metrics = computeChannelMetrics(normalChannel);
      expect(metrics.viewsPerVideo).toBe(1000000 / 150);
      expect(metrics.viewsPerSubscriber).toBe(1000000 / 50000);
      expect(metrics.isThin).toBe(false);

      const thinChannel: YouTubeChannelStats = {
        channelId: 'ch-2',
        title: 'Thin Channel',
        subscriberCount: 500, // Below THIN_SUBSCRIBER_FLOOR (1000)
        viewCount: 1000,
        videoCount: 5, // Below THIN_VIDEO_COUNT_FLOOR (10)
        publishedAt: '2026-01-01T00:00:00Z',
      };

      const thinMetrics = computeChannelMetrics(thinChannel);
      expect(thinMetrics.isThin).toBe(true);
    });

    it('handles channels with hidden subscriber counts gracefully', () => {
      const hiddenSubsChannel: YouTubeChannelStats = {
        channelId: 'ch-3',
        title: 'Hidden Subs',
        subscriberCount: null,
        viewCount: 10000,
        videoCount: 20,
        publishedAt: '2024-01-01T00:00:00Z',
      };

      const metrics = computeChannelMetrics(hiddenSubsChannel);
      expect(metrics.subscriberCount).toBeNull();
      expect(metrics.viewsPerSubscriber).toBeNull();
      expect(metrics.isThin).toBe(false); // Hidden subs with sufficient videos are not thin
    });
  });

  describe('computeCrossQueryAppearances', () => {
    it('accurately counts occurrences of channel IDs across historical query datasets', () => {
      const targetChannelIds = ['ch-A', 'ch-B', 'ch-C'];
      
      const mockHistory: YouTubeNicheRawData[] = [
        {
          query: 'query-1',
          fetchedAt: '2026-08-20T00:00:00Z',
          videos: [],
          channels: [
            { channelId: 'ch-A', title: 'A', subscriberCount: 1000, viewCount: 5000, videoCount: 50, publishedAt: '' },
            { channelId: 'ch-B', title: 'B', subscriberCount: 10000, viewCount: 50000, videoCount: 100, publishedAt: '' },
          ],
        },
        {
          query: 'query-2',
          fetchedAt: '2026-08-21T00:00:00Z',
          videos: [],
          channels: [
            { channelId: 'ch-B', title: 'B', subscriberCount: 10000, viewCount: 50000, videoCount: 100, publishedAt: '' },
            { channelId: 'ch-D', title: 'D', subscriberCount: 5000, viewCount: 25000, videoCount: 80, publishedAt: '' },
          ],
        },
      ];

      const appearances = computeCrossQueryAppearances(targetChannelIds, mockHistory);
      expect(appearances.get('ch-A')).toBe(1);
      expect(appearances.get('ch-B')).toBe(2);
      expect(appearances.get('ch-C')).toBe(0);
    });
  });

  describe('computeCompetitionScore (with real fixtures)', () => {
    const fixtureMealPrep = loadFixture('budget-meal-prep.json');
    const fixtureMoney = loadFixture('money.json');
    const fixtureMorning = loadFixture('morning-routine.json');
    const fixtureCalculators = loadFixture('restoring-vintage-mechanical-calculators.json');

    it('correctly scores opportunity and flags generalists for budget-meal-prep.json', () => {
      const history = [fixtureMoney, fixtureMorning, fixtureCalculators];
      const result = computeCompetitionScore(fixtureMealPrep, history);

      expect(result.rawCompetitorCount).toBeGreaterThan(0);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);

      // Verify that major fitness/lifestyle channels appearing in both "budget-meal-prep"
      // and "morning-routine" are flagged behaviorally as generalists
      const generalists = result.channels.filter((c) => c.isGeneralistSuspected);
      expect(generalists.length).toBeGreaterThanOrEqual(0);

      // Verify pressure metrics are in bounds
      expect(result.authorityPressure).toBeGreaterThanOrEqual(0);
      expect(result.authorityPressure).toBeLessThanOrEqual(1);
      expect(result.concentrationPressure).toBeGreaterThanOrEqual(0);
      expect(result.concentrationPressure).toBeLessThanOrEqual(1);
      expect(result.generalistAuthorityShare).toBeGreaterThanOrEqual(0);
      expect(result.generalistAuthorityShare).toBeLessThanOrEqual(1);
    });

    it('applies demand floor penalty when trends coverage is low', () => {
      const normalScoreResult = computeCompetitionScore(fixtureCalculators, []);
      const unpenalizedScore = normalScoreResult.score;

      // Mock high trends coverage
      const highTrendsData: TrendsRawData = {
        query: 'calculators',
        fetchedAt: '2026-08-22T00:00:00Z',
        points: [],
        recentDataCoverage: 0.9, // 90% coverage
        relatedTop: [],
        relatedRising: [],
        lifecycle: calculateTrendLifecycle([]),
      };

      const highTrendsResult = computeCompetitionScore(fixtureCalculators, [], highTrendsData);
      expect(highTrendsResult.score).toBe(unpenalizedScore); // No penalty applied

      // Mock low trends coverage
      const lowTrendsData: TrendsRawData = {
        query: 'vintage calculators',
        fetchedAt: '2026-08-22T00:00:00Z',
        points: [],
        recentDataCoverage: 0.1, // 10% coverage (below 20% floor)
        relatedTop: [],
        relatedRising: [],
        lifecycle: calculateTrendLifecycle([]),
      };

      const lowTrendsResult = computeCompetitionScore(fixtureCalculators, [], lowTrendsData);
      expect(lowTrendsResult.score).toBe(Math.round(unpenalizedScore * 0.3)); // 0.3x multiplier penalty applied
      expect(lowTrendsResult.notes.some((note) => note.includes('almost no search interest'))).toBe(true);
    });

    it('does not apply demand floor penalty when trends fetch is a suspected failure', () => {
      const suspectedFailureData = {
        query: 'test',
        fetchedAt: '2026-08-22T00:00:00Z',
        points: [],
        recentDataCoverage: 0.0,
        relatedTop: [],
        relatedRising: [],
        lifecycle: calculateTrendLifecycle([]),
        suspectedFailure: true,
      } as TrendsRawData & { suspectedFailure: true };

      const result = computeCompetitionScore(fixtureCalculators, [], suspectedFailureData);
      const normalScore = computeCompetitionScore(fixtureCalculators, []).score;
      expect(result.score).toBe(normalScore); // unpenalized despite 0% coverage
    });
  });

  /**
   * Regression anchors for the two real-fixture "shapes" identified during
   * the authority/concentration weighting investigation
   * (docs/authority-concentration-findings.md). Values below reflect the
   * specialist-only + outlier-excluded + DOMINANCE_BUMP=0.2 implementation
   * (Section 11/12 of that doc) — these are NOT claims that the formula is
   * now "correct," just that these two shapes behave deliberately, not by
   * accident. If DOMINANCE_BUMP or the outlier multiplier are ever
   * re-tuned with real outcome data, update these expectations as part of
   * that same change.
   */
  describe('authority-pressure regression anchors (see docs/authority-concentration-findings.md)', () => {
    it('SHAPE: single dominant specialist, zero generalists — restoring-vintage-mechanical-calculators.json', () => {
      const fixture = loadFixture('restoring-vintage-mechanical-calculators.json');
      const result = computeCompetitionScore(fixture, []);

      // Composition: 13 meaningful channels, ALL specialists (no channel
      // crosses the generalist behavioral or size threshold) — one of
      // them (CuriousMarc, ~243k subs) holds the majority of the field's
      // specialist subscriber mass. This is the exact shape that exposed
      // authority pressure's composition-fragility (Section 3) and later
      // its single-dominant-specialist sensitivity (Section 8).
      const meaningful = result.channels.filter((c) => !c.isThin);
      const generalists = meaningful.filter((c) => c.isGeneralistSuspected);
      expect(meaningful.length).toBe(13);
      expect(generalists.length).toBe(0);

      const subCounts = meaningful.map((c) => c.subscriberCount ?? 0);
      const totalMass = subCounts.reduce((sum, s) => sum + s, 0);
      const topChannel = meaningful.reduce((a, b) => ((a.subscriberCount ?? 0) > (b.subscriberCount ?? 0) ? a : b));
      expect(topChannel.title).toBe('CuriousMarc');
      expect((topChannel.subscriberCount ?? 0) / totalMass).toBeGreaterThan(0.55); // ~59% at capture time

      // CuriousMarc is excluded from the "typical size" median (he's a
      // >5x-median outlier among 13 specialists) but his dominance is
      // folded back in via DOMINANCE_BUMP — softer than the old plain
      // median's 90 (which ignored him) and softer than the rejected
      // full-mass-weighted 76 (which overreacted to him). Score is 80,
      // not the 84 from the authority-pressure fix alone — the
      // concentration-pressure rescale (Section 13/14) also applies
      // here since this niche's raw HHI (~0.12) is meaningfully above
      // the real-fixture median (~0.066), correctly reading as somewhat
      // concentrated once rescaled.
      expect(result.generalistAuthorityShare).toBe(0);
      expect(result.authorityPressure).toBeCloseTo(0.296, 2);
      expect(result.score).toBe(80);
    });

    it('SHAPE: generalist-dominated field, thin specialist tail — how-to-invest-for-beginners.json', () => {
      const fixture = loadFixture('how-to-invest-for-beginners.json');
      const result = computeCompetitionScore(fixture, []);

      // Composition: 13 of 17 meaningful channels are size-flagged
      // generalists (Mark Tilbury, Ali Abdaal, etc. — all >=500k subs),
      // only 4 are real finance specialists. This is the flagship case
      // generalistAuthorityShare was built for, and the case that
      // exposed authority/generalist redundancy (Section 4) plus
      // small-sample outlier-detection unreliability at n=4 (Section 10/11).
      const meaningful = result.channels.filter((c) => !c.isThin);
      const generalists = meaningful.filter((c) => c.isGeneralistSuspected);
      const specialists = meaningful.filter((c) => !c.isGeneralistSuspected);
      expect(meaningful.length).toBe(17);
      expect(generalists.length).toBe(13);
      expect(specialists.length).toBe(4);

      // Specialist-only median (95,450 — the 4 specialists, generalists
      // excluded so their dominance isn't double-counted against
      // generalistAuthorityShare below). n=4 is below
      // MIN_SAMPLE_FOR_OUTLIER_DETECTION (6), so no dominance adjustment
      // is applied here — this residual softening vs. the old plain
      // full-field median (50) is an intentionally open, unresolved gap
      // (small-sample authority definition — plain vs. mass-weighted
      // median — Section 11), not something this change claims to fix.
      expect(result.generalistAuthorityShare).toBeGreaterThan(0.95);
      expect(result.authorityPressure).toBeCloseTo(0.421, 2);
      expect(result.score).toBe(56);
    });
  });
});
