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

/**
 * Authority-pressure decomposition constants. See
 * docs/authority-concentration-findings.md for the full investigation
 * (synthetic scenarios + all 22 real test-data fixtures) that led here.
 *
 * Problem: a plain median over ALL meaningful channels was composition-
 * fragile (diluted by however many small filler channels happened to be
 * in the result set) AND, once fixed to be specialist-only, still
 * conflated two different questions in one number: "how big is a
 * typical specialist competitor" vs "is there a single standout
 * specialist dominating the niche." No blended median (plain, top-N,
 * mass-weighted, or capped) could answer both without a counter-example
 * — see Sections 3-9 of the findings doc for four rejected/superseded
 * attempts.
 *
 * Fix: split into two pieces of evidence. SPECIALIST_SIZE_OUTLIER_MULTIPLIER
 * (same value and rationale as VIRAL_OUTLIER_MULTIPLIER above, just
 * applied to subscriber size instead of views-per-video) flags standout
 * channels and excludes them from the "typical size" median, so it
 * stays robust to a lone dominant channel. Their combined subscriber-
 * mass share is then folded back in via DOMINANCE_BUMP, inside
 * authorityPressure's existing weight budget — deliberately NOT a new
 * top-level weight, to avoid the aggregate-score inflation confirmed in
 * Prototype 6 (a new weight slot diluted authority's effective share
 * from ~41% to ~29% whenever monetization defaults, independent of
 * whether the decomposition logic itself was sound).
 *
 * MIN_SAMPLE_FOR_OUTLIER_DETECTION guards against small specialist
 * pools (e.g. n=4) where a median-based outlier threshold is
 * statistically unreliable — confirmed on how-to-invest-for-beginners.json,
 * where no channel crossed a 5x-median bar at n=4 despite an obvious
 * size gradient among the 4 specialists.
 *
 * DOMINANCE_BUMP = 0.2 is a deliberate, conservative first-pass choice,
 * not a tuned value: 0.3 and 0.4 were also tested and rejected for
 * moving too close to the swing sizes already rejected in Prototype 4/6
 * (-9/-12 vs the already-rejected -7/-14). No real outcome data exists
 * yet to validate any of these three values — revisit if/when usage
 * outcome tracking exists (see project decision log, 2026-08-24).
 */
const SPECIALIST_SIZE_OUTLIER_MULTIPLIER = 5;
const MIN_SAMPLE_FOR_OUTLIER_DETECTION = 6;
const DOMINANCE_BUMP = 0.2;

/**
 * Concentration-pressure rescale. See docs/authority-concentration-findings.md
 * Sections 13-14 for the full investigation.
 *
 * Problem: raw HHI, clamped directly to [0,1], is compressed into a tiny
 * band in practice — surveyed across all 22 real test-data fixtures,
 * concentrationPressure ranged only 0.045-0.190 (mean 0.076), vs
 * authorityPressure's 0.30-0.48 (mean 0.41) and generalistAuthorityShare's
 * mean of 0.82. Concentration was structurally incapable of moving a
 * score much regardless of its weight — a reweighting attempt (tested:
 * 30/30/25/15, 25/35/25/15, 28/32/22/18, and their average) confirmed
 * this: every single one of the 22 real fixtures got MORE lenient under
 * every scheme tested, with zero exceptions — a systematic bias, not a
 * fix, because shifting weight from an always-larger component
 * (authority) to an always-smaller one (concentration) just softens
 * everything, independent of whether a given niche actually has a
 * concentration problem.
 *
 * Fix: min-max rescale raw HHI against its observed range before
 * applying the (unchanged) 25% weight — same technique already used for
 * authorityPressure (log-scale + calibration range), just applied here.
 * CONCENTRATION_MIN/MAX = 0.02/0.40 is a deliberately conservative
 * first-pass choice: tighter ranges (0.04/0.20, 0.03/0.30, 0.03/0.25)
 * were also tested and produced up to 3-4x larger per-fixture swings
 * (worst case -19 vs this range's -6) for the same underlying data.
 * Chosen for the smallest real-world impact that still fixes the
 * directional bug (confirmed: 0 of 22 real fixtures move the wrong way
 * under this range, same as every range tested) and still meaningfully
 * separates synthetic Scenario B from C (SERP-concentrated-and-reach-
 * dominated vs. reach-dominated-only) — gap widens from a broken 2
 * points to 15. No real outcome data exists yet to validate the exact
 * min/max values — revisit if/when usage outcome tracking exists.
 */
const CONCENTRATION_MIN = 0.02;
const CONCENTRATION_MAX = 0.40;

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

  // FIX: previously the median was computed over ALL meaningful channels,
  // which conflated two different questions in one number — see the
  // SPECIALIST_SIZE_OUTLIER_MULTIPLIER/DOMINANCE_BUMP doc comment above.
  // Basis is specialist-only (generalist dominance is already fully
  // captured by generalistAuthorityShare below — including generalists
  // here double-counted that signal, confirmed on
  // how-to-invest-for-beginners.json). Falls back to all meaningful
  // channels if every meaningful channel happens to be generalist-flagged.
  const specialistSubCounts = specialists
    .map((c) => c.subscriberCount)
    .filter((s): s is number => s !== null && s > 0);
  const authorityBasis = specialistSubCounts.length > 0 ? specialistSubCounts : meaningfulSubCounts;

  let robustMedianSubs: number;
  let dominanceShare = 0;
  if (authorityBasis.length < MIN_SAMPLE_FOR_OUTLIER_DETECTION) {
    // Sample too small for a median-based outlier threshold to be
    // reliable (confirmed unreliable at n=4) — use the plain median,
    // no dominance adjustment.
    robustMedianSubs = median(authorityBasis);
  } else {
    const baseMedian = median(authorityBasis);
    const outlierThreshold = baseMedian * SPECIALIST_SIZE_OUTLIER_MULTIPLIER;
    const outliers = baseMedian > 0 ? authorityBasis.filter((s) => s > outlierThreshold) : [];
    const nonOutliers = authorityBasis.filter((s) => !(baseMedian > 0 && s > outlierThreshold));
    robustMedianSubs = median(nonOutliers.length > 0 ? nonOutliers : authorityBasis);

    const totalBasisMass = authorityBasis.reduce((sum, s) => sum + s, 0);
    const outlierMass = outliers.reduce((sum, s) => sum + s, 0);
    dominanceShare = totalBasisMass > 0 ? outlierMass / totalBasisMass : 0;

    if (dominanceShare > 0.3) {
      notes.push(
        `${outliers.length} specialist channel(s) hold ${Math.round(dominanceShare * 100)}% of the specialist field's subscriber mass — a standout niche leader, distinct from cross-topic generalist dominance, factored into authority pressure.`
      );
    }
  }

  const medianLogSubs = robustMedianSubs > 0 ? Math.log10(robustMedianSubs) : 3;
  const calibrationRange = calculateCalibrationRange(historicalDatasets);
  const baseAuthorityPressure = Math.max(
    0,
    Math.min(
      1,
      (medianLogSubs - calibrationRange.minLogSubs) /
        (calibrationRange.maxLogSubs - calibrationRange.minLogSubs || 1)
    )
  );
  const authorityPressure = Math.max(0, Math.min(1, baseAuthorityPressure + DOMINANCE_BUMP * dominanceShare));

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
  // Rescaled against CONCENTRATION_MIN/MAX (see doc comment above) —
  // raw HHI alone is compressed too tightly near 0 to be a meaningful
  // scoring input at any weight.
  const concentrationPressure = Math.max(0, Math.min(1, (hhi - CONCENTRATION_MIN) / (CONCENTRATION_MAX - CONCENTRATION_MIN)));

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
  // NOTE: uses the raw HHI (`hhi`), not the rescaled `concentrationPressure`
  // used for scoring — this note describes the actual real-world SERP
  // structure, not the internal scoring transform, and the 0.15 threshold
  // was calibrated against real fixtures' raw HHI range (0.045-0.19).
  if (hhi > 0.15) {
    notes.push(
      `Search results are concentrated among a small number of channels (HHI ${hhi.toFixed(2)}) — possibly a few channels systematically dominating this exact query (e.g. recurring refresh content), not genuinely open competition.`
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