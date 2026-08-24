import { describe, it, expect } from 'vitest';
import { computeCompetitionScore } from './competition';
import { YouTubeNicheRawData, YouTubeChannelStats } from '../youtube';

/**
 * Regression tests for two refinements confirmed during the post-launch
 * scoring audit (see competition.ts comments at the concentration
 * pressure block and the weight-redistribution block for full context).
 *
 * Both bugs here were quantified against real fixture data before
 * fixing (documented in project history), but these tests use
 * controlled synthetic data instead of fixtures so the expected values
 * are exact and don't drift if test-data/ fixtures are ever updated.
 */

function makeChannel(id: string, subs: number, videos: number): YouTubeChannelStats {
  return {
    channelId: id,
    title: id,
    subscriberCount: subs,
    viewCount: subs * 20,
    videoCount: videos,
    publishedAt: '2020-01-01T00:00:00Z',
  };
}

function makeVideosForChannels(channels: YouTubeChannelStats[]) {
  return channels.map((c, i) => ({
    videoId: `v${i}`,
    title: 'x',
    channelId: c.channelId,
    channelTitle: c.title,
    publishedAt: '2025-01-01T00:00:00Z',
  }));
}

describe('Concentration pressure — thin-channel filtering fix', () => {
  it('excludes thin/noise channels from the HHI calculation, matching the basis authority pressure and generalist share already use', () => {
    // 3 "meaningful" channels (well above thin floors), 7 "thin" channels
    // (below THIN_SUBSCRIBER_FLOOR=1000 and THIN_VIDEO_COUNT_FLOOR=10),
    // one video each in the result set = 10 total videos.
    const meaningfulChannels = ['m1', 'm2', 'm3'].map((id) => makeChannel(id, 50000, 100));
    const thinChannels = ['t1', 't2', 't3', 't4', 't5', 't6', 't7'].map((id) =>
      makeChannel(id, 200, 3)
    );
    const allChannels = [...meaningfulChannels, ...thinChannels];

    const data: YouTubeNicheRawData = {
      query: 'synthetic concentration test query',
      fetchedAt: '2026-01-01T00:00:00Z',
      videos: makeVideosForChannels(allChannels),
      channels: allChannels,
    };

    const result = computeCompetitionScore(data);

    // Correct (filtered) behavior: only the 3 meaningful channels count,
    // each holding a 1/3 share of the filtered result set.
    // Raw HHI = 3 * (1/3)^2 = 1/3 ≈ 0.333. `concentrationPressure` is
    // then min-max rescaled against CONCENTRATION_MIN/MAX = 0.02/0.40
    // (see competition.ts) before being exposed here — NOT the raw HHI:
    // (1/3 - 0.02) / (0.40 - 0.02) ≈ 0.8246.
    expect(result.concentrationPressure).toBeCloseTo((1 / 3 - 0.02) / (0.4 - 0.02), 5);

    // Guards specifically against regressing to the old buggy behavior,
    // which counted all 10 channels (including the 7 thin ones) and
    // would have produced raw HHI = 10 * (1/10)^2 = 0.1 — rescaled,
    // (0.1 - 0.02) / (0.40 - 0.02) ≈ 0.2105 — a meaningfully different
    // (and confirmed-wrong-direction) value from the correct ~0.8246.
    expect(result.concentrationPressure).not.toBeCloseTo((0.1 - 0.02) / (0.4 - 0.02), 2);
  });

  it('does not crash and adds an explanatory note when every channel in the result set is thin', () => {
    const thinChannels = ['t1', 't2', 't3'].map((id) => makeChannel(id, 200, 3));
    const data: YouTubeNicheRawData = {
      query: 'synthetic all-thin test query',
      fetchedAt: '2026-01-01T00:00:00Z',
      videos: makeVideosForChannels(thinChannels),
      channels: thinChannels,
    };

    const result = computeCompetitionScore(data);

    expect(result.concentrationPressure).toBe(0);
    expect(
      result.notes.some((n) => n.includes('below the thin-channel floor'))
    ).toBe(true);
  });
});

describe('Monetization weight redistribution — default-match fix', () => {
  const channels = ['a', 'b', 'c', 'd', 'e'].map((id, i) =>
    makeChannel(id, 30000 + i * 5000, 50 + i * 10)
  );
  const videos = makeVideosForChannels(channels);

  it('produces IDENTICAL scores for two queries with identical channel/video data when both fall to the monetization default bucket, proving monetization contributes nothing when unmatched', () => {
    const dataA: YouTubeNicheRawData = {
      query: 'zzqx991 nonsense gibberish term',
      fetchedAt: '2026-01-01T00:00:00Z',
      videos,
      channels,
    };
    const dataB: YouTubeNicheRawData = {
      query: 'blorptastic wobble frobnicator',
      fetchedAt: '2026-01-01T00:00:00Z',
      videos,
      channels,
    };

    const resultA = computeCompetitionScore(dataA);
    const resultB = computeCompetitionScore(dataB);

    expect(resultA.notes.some((n) => n.includes('excluded from the score'))).toBe(true);
    expect(resultB.notes.some((n) => n.includes('excluded from the score'))).toBe(true);
    expect(resultA.score).toBe(resultB.score);
  });

  it('DOES produce different scores for queries with identical channel/video data when a real monetization category matches, confirming exclusion only applies to unmatched defaults', () => {
    const dataFinance: YouTubeNicheRawData = {
      query: 'crypto trading for beginners',
      fetchedAt: '2026-01-01T00:00:00Z',
      videos,
      channels,
    };
    const dataGaming: YouTubeNicheRawData = {
      query: 'minecraft gaming survival',
      fetchedAt: '2026-01-01T00:00:00Z',
      videos,
      channels,
    };

    const resultFinance = computeCompetitionScore(dataFinance);
    const resultGaming = computeCompetitionScore(dataGaming);

    expect(resultFinance.notes.some((n) => n.includes('excluded from the score'))).toBe(false);
    expect(resultGaming.notes.some((n) => n.includes('excluded from the score'))).toBe(false);
    expect(resultFinance.score).not.toBe(resultGaming.score);
    // Finance has a higher monetizationScore than gaming, so lower
    // monetizationPressure, so it should score HIGHER (more opportunity)
    // all else being equal.
    expect(resultFinance.score).toBeGreaterThan(resultGaming.score);
  });
});