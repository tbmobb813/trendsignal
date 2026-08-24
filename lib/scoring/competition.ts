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
  // NOTE (informational-only, not a scoring input): flags channels whose
  // views-per-video is a statistical outlier relative to peers in this
  // niche — surfaced in the returned `channels` array for UI/display
  // purposes (e.g. distinguishing a durable performer from a one-hit
  // viral fluke). This does NOT currently feed into authorityPressure,
  // concentrationPressure, or any other scoring input. Wiring it in
  // (e.g. down-weighting viral-outlier channels in the median subscriber
  // calc, since a fluke video is weaker evidence of real competition
  // than consistent performance) is a plausible future refinement, but
  // deliberately left out for now — it would change scoring behavior
  // and should be tested against real fixtures first, not folded in
  // silently.
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

  // NOTE (informational-only, not a scoring input): median video output
  // among specialist competitors, returned for UI/display context on
  // "how much sustained effort competing here takes." Not currently
  // used anywhere in the pressure/score calculation.
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
  // FIX: previously computed on ALL raw video results regardless of
  // whether the channel behind each video was "meaningful" (non-thin).
  // Verified on real data this systematically UNDERSTATED concentration:
  // thin/noise channels pad the denominator with channels that don't
  // actually compete, making crowded niches look artificially more open.
  // Confirmed delta on real fixtures: "bioluminescent terrarium care"
  // 0.075 (unfiltered) vs 0.117 (filtered) — a consistent, one-directional
  // bias, not noise. Now uses the same meaningful-channel basis as
  // authority pressure and generalist share, for consistency across all
  // three structural pressure factors.
  const meaningfulChannelIds = new Set(meaningful.map((c) => c.channelId));
  const resultCountByChannel = new Map<string, number>();
  let filteredVideoCount = 0;
  for (const v of data.videos) {
    if (!meaningfulChannelIds.has(v.channelId)) continue;
    resultCountByChannel.set(v.channelId, (resultCountByChannel.get(v.channelId) ?? 0) + 1);
    filteredVideoCount++;
  }
  const totalResults = filteredVideoCount || 1;
  let hhi = 0;
  for (const count of resultCountByChannel.values()) {
    const share = count / totalResults;
    hhi += share * share;
  }
  const concentrationPressure = Math.max(0, Math.min(1, hhi));

  if (filteredVideoCount === 0 && data.videos.length > 0) {
    notes.push(
      'Every channel in the top search results was below the thin-channel floor — concentration pressure could not be meaningfully computed and defaults to 0. This usually means the niche is extremely nascent; check the demand floor before trusting a low score here.'
    );
  }

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
      `No specific monetization category matched this query — using the general-interest default (RPM ${monetizationRes.benchmark.rpmRange}). Since this is a guess rather than a real category match, it's excluded from the score entirely (weight redistributed to the other three factors) rather than contributing as if it were verified signal.`
    );
  }

  // ---- Pressure weights ----
  // KNOWN ASYMMETRY (documented, not a bug):
  //
  // Authority (35%) + Generalist share (25%) together outweigh
  // Concentration (25%) by 2.4:1. This means the formula treats
  // "a few giant channels with disproportionate subscriber reach"
  // as harder competition than "many mid-size channels owning most
  // of the actual ranking slots" — even when the latter looks more
  // locked-up on the SERP itself.
  //
  // Confirmed with synthetic scenarios (see
  // scripts/concentration-vs-authority-scenarios.ts):
  //   Scenario A — 5 specialists, 80% slot occupancy → score 78
  //   Scenario B — 2 giants, 24% slot occupancy     → score 56
  //   Gap: 22 points
  //
  // Why this is kept deliberately:
  // The formula answers "how hard is it for a NEW, SMALL, FOCUSED
  // channel to break in?" — not "how concentrated are the SERPs
  // today?" From a new entrant's perspective, Scenario A is a
  // beat-them-on-the-same-terms fight (out-produce, differentiate,
  // find a sub-angle), while Scenario B is structurally rigged by
  // platform mechanics (subscriber-driven algorithmic push, browse
  // and recommendation reach that bypasses search ranking entirely).
  // The current weights capture that distinction.
  //
  // Reweighting toward concentration (e.g. 30/30/25/15) would make
  // the formula better at measuring "how monopolized are the SERPs"
  // but potentially worse at measuring "can I actually compete here."
  // Either model is defensible; this one is chosen, not accidental.
  //
  // Same epistemic status as all hand-set constants in this file:
  // reasoned but unvalidated against real outcome data. If outcome
  // data ever shows the asymmetry misleads users, revisit here first.
  const WEIGHT_AUTHORITY = 0.35;
  const WEIGHT_CONCENTRATION = 0.25;
  const WEIGHT_GENERALIST = 0.25;
  const WEIGHT_MONETIZATION = 0.15;

  // FIX: previously the full 15% monetization weight applied even when
  // getMonetizationBenchmark() fell through to the unverified default
  // (no real category keyword matched — confirmed at 18% of real test
  // queries, e.g. "restoring vintage mechanical calculators", "resume
  // tips for career changers"). A guessed default was being treated as
  // equally informative as a real category match. When the match is a
  // default, monetization is excluded from the pressure calculation and
  // its weight is redistributed proportionally across the other three
  // factors, rather than diluting the score with a non-differentiating
  // signal.
  let pressure: number;
  if (monetizationRes.matchedBy === 'default') {
    const remainingWeightSum = WEIGHT_AUTHORITY + WEIGHT_CONCENTRATION + WEIGHT_GENERALIST;
    pressure =
      (WEIGHT_AUTHORITY / remainingWeightSum) * authorityPressure +
      (WEIGHT_CONCENTRATION / remainingWeightSum) * concentrationPressure +
      (WEIGHT_GENERALIST / remainingWeightSum) * generalistAuthorityShare;
  } else {
    pressure =
      WEIGHT_AUTHORITY * authorityPressure +
      WEIGHT_CONCENTRATION * concentrationPressure +
      WEIGHT_GENERALIST * generalistAuthorityShare +
      WEIGHT_MONETIZATION * monetizationPressure;
  }

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
  if (trendsData && (trendsData as TrendsRawData & { suspectedFailure?: boolean }).suspectedFailure) {
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