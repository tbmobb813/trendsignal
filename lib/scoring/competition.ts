import { YouTubeNicheRawData, YouTubeChannelStats } from '../youtube';
import { TrendsRawData } from '../trends';
import { ChannelMetrics, CompetitionScoreResult } from './types';
import { getMonetizationBenchmark } from './monetization';

/**
 * Thresholds and multipliers below are FIRST-PASS heuristics, not tuned
 * constants. They're based on patterns visible across five real test
 * queries (budget meal prep, budget meal prep for one, meal prep for
 * night shift nurses, how to make money on youtube, morning routine).
 * Expect to revisit these once you've run this against more niches —
 * treat every number here as a labeled guess, not a fact.
 */
const THIN_SUBSCRIBER_FLOOR = 1000;
const THIN_VIDEO_COUNT_FLOOR = 10;
const VIRAL_OUTLIER_MULTIPLIER = 5; // flag if viewsPerVideo > 5x the niche's median
const GENERALIST_APPEARANCE_THRESHOLD = 2; // appears in this query + at least 1 other unrelated query
const GENERALIST_SUBSCRIBER_FALLBACK = 500_000; // cold-start heuristic when no cross-query history exists yet

/**
 * Compute derived metrics for a single channel. Pure — no history,
 * no outlier detection relative to peers (that needs the full set,
 * see computeCompetitionScore). This just does the per-channel math.
 */
export function computeChannelMetrics(
  channel: YouTubeChannelStats
): Omit<ChannelMetrics, 'isViralOutlier' | 'isGeneralistSuspected' | 'crossQueryAppearances'> {
  const viewsPerVideo = channel.videoCount > 0 ? channel.viewCount / channel.videoCount : 0;

  const viewsPerSubscriber =
    channel.subscriberCount !== null && channel.subscriberCount > 0
      ? channel.viewCount / channel.subscriberCount
      : null;

  const isThin =
    channel.videoCount < THIN_VIDEO_COUNT_FLOOR ||
    (channel.subscriberCount !== null && channel.subscriberCount < THIN_SUBSCRIBER_FLOOR);

  return {
    channelId: channel.channelId,
    title: channel.title,
    subscriberCount: channel.subscriberCount,
    videoCount: channel.videoCount,
    viewCount: channel.viewCount,
    viewsPerVideo,
    viewsPerSubscriber,
    isThin,
  };
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * Flags channels whose views-per-video is a statistical outlier relative
 * to OTHER channels in the same niche result set.
 */
function flagViralOutliers(
  channels: Omit<ChannelMetrics, 'isViralOutlier' | 'isGeneralistSuspected' | 'crossQueryAppearances'>[]
): Set<string> {
  const nonThin = channels.filter((c) => !c.isThin);
  const med = median(nonThin.map((c) => c.viewsPerVideo));

  const outliers = new Set<string>();
  if (med === 0) return outliers;

  for (const c of nonThin) {
    if (c.viewsPerVideo > med * VIRAL_OUTLIER_MULTIPLIER) {
      outliers.add(c.channelId);
    }
  }
  return outliers;
}

/**
 * Counts how many distinct past query datasets each channel has appeared in.
 */
export function computeCrossQueryAppearances(
  targetChannelIds: string[],
  historicalDatasets: YouTubeNicheRawData[]
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const id of targetChannelIds) counts.set(id, 0);

  for (const dataset of historicalDatasets) {
    const channelIdsInThisQuery = new Set(dataset.channels.map((c) => c.channelId));
    for (const id of targetChannelIds) {
      if (channelIdsInThisQuery.has(id)) {
        counts.set(id, (counts.get(id) ?? 0) + 1);
      }
    }
  }

  return counts;
}

/**
 * Decides which channels count as "generalist-suspected" for this query.
 */
function flagGeneralists(
  channels: Omit<ChannelMetrics, 'isViralOutlier' | 'isGeneralistSuspected' | 'crossQueryAppearances'>[],
  crossQueryAppearances: Map<string, number>
): Set<string> {
  const flagged = new Set<string>();

  for (const c of channels) {
    const appearances = crossQueryAppearances.get(c.channelId) ?? 0;
    const behavioralFlag = appearances >= GENERALIST_APPEARANCE_THRESHOLD;
    const sizeFlag = c.subscriberCount !== null && c.subscriberCount >= GENERALIST_SUBSCRIBER_FALLBACK;

    if (behavioralFlag || sizeFlag) {
      flagged.add(c.channelId);
    }
  }

  return flagged;
}

/**
 * Main entry point: given raw niche data (and optionally historical datasets and Trends data),
 * compute the full opportunity & competition picture.
 */
export function computeCompetitionScore(
  data: YouTubeNicheRawData,
  historicalDatasets: YouTubeNicheRawData[] = [],
  trendsData: TrendsRawData | null = null
): CompetitionScoreResult {
  const notes: string[] = [];

  const baseMetrics = data.channels.map(computeChannelMetrics);
  const viralOutlierIds = flagViralOutliers(baseMetrics);

  const crossQueryAppearances = computeCrossQueryAppearances(
    data.channels.map((c) => c.channelId),
    historicalDatasets
  );
  const generalistIds = flagGeneralists(baseMetrics, crossQueryAppearances);

  if (historicalDatasets.length === 0) {
    notes.push(
      'No historical query data provided — generalist detection fell back to the subscriber-count heuristic. Re-run with history once you have several queries cached for a more accurate signal.'
    );
  }

  const channels: ChannelMetrics[] = baseMetrics.map((c) => ({
    ...c,
    isViralOutlier: viralOutlierIds.has(c.channelId),
    isGeneralistSuspected: generalistIds.has(c.channelId),
    crossQueryAppearances: crossQueryAppearances.get(c.channelId) ?? 0,
  }));

  const rawCompetitorCount = channels.length;
  const meaningful = channels.filter((c) => !c.isThin);
  const meaningfulCompetitorCount = meaningful.length;
  const specialists = meaningful.filter((c) => !c.isGeneralistSuspected);
  const specialistCompetitorCount = specialists.length;
  const generalistDipInGap = meaningfulCompetitorCount - specialistCompetitorCount;

  if (generalistDipInGap >= 3) {
    notes.push(
      `${generalistDipInGap} of the ${meaningfulCompetitorCount} meaningful competitors look like generalists dipping into this niche rather than dedicated specialists. Raw competition looks denser than it may actually be for a focused channel.`
    );
  }

  const medianVideoCount = median(specialists.map((c) => c.videoCount));

  // --- Authority pressure ---
  const meaningfulSubCounts = meaningful
    .map((c) => c.subscriberCount)
    .filter((s): s is number => s !== null && s > 0);
  const medianSubs = median(meaningfulSubCounts);
  const medianLogSubs = medianSubs > 0 ? Math.log10(medianSubs) : 3;
  const authorityPressure = Math.max(0, Math.min(1, (medianLogSubs - 3) / (7.7 - 3)));

  // --- Concentration pressure ---
  const resultCountByChannel = new Map<string, number>();
  for (const v of data.videos) {
    resultCountByChannel.set(v.channelId, (resultCountByChannel.get(v.channelId) ?? 0) + 1);
  }
  const totalResults = data.videos.length || 1;
  let hhi = 0;
  for (const count of resultCountByChannel.values()) {
    const share = count / totalResults;
    hhi += share * share;
  }
  const concentrationPressure = Math.max(0, Math.min(1, hhi));

  // --- Generalist authority share ---
  const totalMeaningfulSubMass = meaningfulSubCounts.reduce((sum, s) => sum + s, 0);
  const generalistSubMass = meaningful
    .filter((c) => c.isGeneralistSuspected)
    .map((c) => c.subscriberCount)
    .filter((s): s is number => s !== null && s > 0)
    .reduce((sum, s) => sum + s, 0);
  const generalistAuthorityShare =
    totalMeaningfulSubMass > 0 ? generalistSubMass / totalMeaningfulSubMass : 0;

  if (generalistAuthorityShare > 0.6) {
    notes.push(
      `Generalists hold ${Math.round(generalistAuthorityShare * 100)}% of total subscriber mass among meaningful competitors — even though there may be few of them by headcount, they likely dominate ranking and algorithmic reach.`
    );
  }
  if (concentrationPressure > 0.15) {
    notes.push(
      `Search results are concentrated among a small number of channels (HHI ${concentrationPressure.toFixed(2)}) — possibly a few channels systematically dominating this exact query (e.g. recurring refresh content), not genuinely open competition.`
    );
  }

  // --- Monetization pressure (Inverse of Monetization Benchmark Score) ---
  const monetizationRes = getMonetizationBenchmark(data.query);
  const monetizationPressure = 1 - monetizationRes.benchmark.monetizationScore / 100;

  const WEIGHT_AUTHORITY = 0.35;
  const WEIGHT_CONCENTRATION = 0.25;
  const WEIGHT_GENERALIST = 0.25;
  const WEIGHT_MONETIZATION = 0.15;

  const pressure =
    WEIGHT_AUTHORITY * authorityPressure +
    WEIGHT_CONCENTRATION * concentrationPressure +
    WEIGHT_GENERALIST * generalistAuthorityShare +
    WEIGHT_MONETIZATION * monetizationPressure;

  const score = Math.round(Math.max(0, Math.min(100, (1 - pressure) * 100)));

  // ---- Demand floor multiplier ----
  let finalScore = score;
  if (trendsData) {
    const coverage = trendsData.recentDataCoverage; // 0-1
    if (coverage < 0.2) {
      notes.push(
        `Google Trends shows almost no search interest for this query (${Math.round(coverage * 100)}% of recent months had any signal at all) — the competition score above may be misleadingly high, since low competition here likely reflects low demand, not open opportunity.`
      );
      finalScore = Math.round(score * 0.3);
    } else if (coverage < 0.5) {
      notes.push(
        `Google Trends shows inconsistent search interest for this query (${Math.round(coverage * 100)}% of recent months had signal) — treat the opportunity score with caution until demand is confirmed some other way.`
      );
      finalScore = Math.round(score * 0.7);
    }
  } else {
    notes.push(
      'No Trends data available for this query — the score below reflects competition structure only and has not been checked against actual search demand.'
    );
  }

  return {
    query: data.query,
    channels,
    rawCompetitorCount,
    meaningfulCompetitorCount,
    specialistCompetitorCount,
    generalistDipInGap,
    medianVideoCount,
    authorityPressure,
    concentrationPressure,
    generalistAuthorityShare,
    score: finalScore,
    notes,
  };
}
