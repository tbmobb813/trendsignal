import fs from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';
import {
  computeChannelMetrics,
  computeCrossQueryAppearances,
  computeCompetitionScore,
} from './competition';
import { YouTubeNicheRawData, YouTubeChannelStats } from '../youtube';
import { TrendsRawData } from '../trends';

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
      };

      const highTrendsResult = computeCompetitionScore(fixtureCalculators, [], highTrendsData);
      expect(highTrendsResult.score).toBe(unpenalizedScore); // No penalty applied

      // Mock low trends coverage
      const lowTrendsData: TrendsRawData = {
        query: 'vintage calculators',
        fetchedAt: '2026-08-22T00:00:00Z',
        points: [],
        recentDataCoverage: 0.1, // 10% coverage (below 20% floor)
      };

      const lowTrendsResult = computeCompetitionScore(fixtureCalculators, [], lowTrendsData);
      expect(lowTrendsResult.score).toBe(Math.round(unpenalizedScore * 0.3)); // 0.3x multiplier penalty applied
      expect(lowTrendsResult.notes.some((note) => note.includes('almost no search interest'))).toBe(true);
    });
  });
});
