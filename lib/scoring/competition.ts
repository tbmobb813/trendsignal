import { YouTubeNicheRawData, YouTubeChannelStats } from '../youtube';
import { TrendsRawData } from '../trends';
import { ChannelMetrics, CompetitionScoreResult } from './types';
import { getMonetizationBenchmark } from './monetization';

/**
 * Thresholds and multipliers below are FIRST-PASS heuristics, not tuned
 * constants. They're based on patterns visible across real test queries.
 * Treat every number here as a labeled guess, not a fact.
 */
const THIN_SUBSCRIBER_FLOOR = 1000;
const THIN_VIDEO_COUNT_FLOOR = 10;
const VIRAL_OUTLIER_MULTIPLIER = 5;
const GENERALIST_APPEARANCE_THRESHOLD = 2;
const GENERALIST_SUBSCRIBER_FALLBACK = 500_000;

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

interface CalibrationRange {
  minLogSubs: number;
  maxLogSubs: number;
}

/**
 * STATUS: untested. This adaptive calibration (recalibrating authority
 * pressure bounds against the mean±2σ of accumulated query history) is
 * a legitimate idea but was never validated the way the rest of this
 * formula was — we don't know whether it improves accuracy or just
 * makes scores drift and become incomparable across time as more
 * history accumulates. Flagging, not fixing — needs real testing
 * before being trusted the way the rest of this file now is.
 */
function calculateCalibrationRange(historicalDatasets: YouTubeNicheRawData[]): CalibrationRange {
  const DEFAULT_MIN = 3.0; // 1,000 subscribers
  const DEFAULT_MAX = 7.7; // 50,000,000 subscribers

  if (!historicalDatasets || historicalDatasets.length < 5) {
    return { minLogSubs: DEFAULT_MIN, maxLogSubs: DEFAULT_MAX };
  }

  const historicalMedianLogs: number[] = [];

  for (const dataset of historicalDatasets) {
    const meaningful = (dataset.channels || []).filter((c) => {
      const isThin = c.videoCount < 10 || (c.subscriberCount !== null && c.subscriberCount < 1000);
      return !isThin;
    });

    const subCounts = meaningful
      .map((c) => c.subscriberCount)
      .filter((s): s is number => s !== null && s > 0);

    const medianSubs = median(subCounts);
    if (medianSubs > 0) {
      historicalMedianLogs.push(Math.log10(medianSubs));
    }
  }

  if (historicalMedianLogs.length < 5) {
    return { minLogSubs: DEFAULT_MIN, maxLogSubs: DEFAULT_MAX };
  }

  const sum = historicalMedianLogs.reduce((acc, val) => acc + val, 0);
  const avg = sum / historicalMedianLogs.length;

  const sqDiffSum = historicalMedianLogs.reduce((acc, val) => acc + Math.pow(val - avg, 2), 0);
  const stdDev = Math.sqrt(sqDiffSum / historicalMedianLogs.length);

  const minLogSubs = Math.max(DEFAULT_MIN, avg - 2 * stdDev);
  const maxLogSubs = Math.min(8.0, avg + 2 * stdDev);

  return { minLogSubs, maxLogSubs };
}

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
  const calibrationRange = calculateCalibrationRange(historicalDatasets);
  const authorityPressure = Math.max(
    0,
    Math.min(
      1,
      (medianLogSubs - calibrationRange.minLogSubs) /
        (calibrationRange.maxLogSubs - calibrationRange.minLogSubs || 1)
    )
  );

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

  // --- Monetization pressure ---
  // See lib/scoring/monetization.ts and data/cpm-benchmarks.json for
  // the sourcing caveat: these are unsourced estimates, and matching
  // now uses word-boundary regex (fixed from plain substring matching,
  // which had a confirmed bug: "how to make money on youtube" was
  // matching the finance category via the substring "money").
  const monetizationRes = getMonetizationBenchmark(data.query);
  const monetizationPressure = 1 - monetizationRes.benchmark.monetizationScore / 100;

  if (monetizationRes.matchedBy === 'default') {
    notes.push(
      `No specific monetization category matched this query — using the general-interest default (RPM ${monetizationRes.benchmark.rpmRange}). This is common for long-tail, specific niches and doesn't necessarily mean low monetization potential, just that it wasn't captured by the current keyword list.`
    );
  }

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
  // RESTORED: this block previously lost the suspectedFailure check
  // during later edits. Without it, any query where Google Trends
  // silently rate-limited us (returning technically-valid but
  // functionally-empty data) gets its score wrongly crushed as if it
  // were a confirmed zero-demand niche — this was the exact bug
  // confirmed on "best gpu's to buy 2026" during testing, where the
  // check protected the score from being wrongly tanked.
  let finalScore = score;
  if (trendsData && trendsData.suspectedFailure) {
    notes.push(
      'Trends data could not be confidently retrieved for this query even after retries (this looks more like a rate-limited or blocked request than genuine zero search demand) — the score reflects competition and monetization structure only and should be treated as unverified on the demand side.'
    );
  } else if (trendsData) {
    const coverage = trendsData.recentDataCoverage;
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
      'No Trends data available for this query — the score below reflects competition and monetization structure only and has not been checked against actual search demand.'
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