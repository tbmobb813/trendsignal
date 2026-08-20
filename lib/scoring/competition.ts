import { YouTubeNicheRawData, YouTubeChannelStats } from '../youtube';
import { TrendsRawData } from '../trends';
import { ChannelMetrics, CompetitionScoreResult } from './types';

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
 * to OTHER channels in the same niche result set — not an absolute
 * threshold, since "high" varies hugely by niche scale (see Spizee vs.
 * NurseZee in the night-shift-nurses fixture: both anomalous, at
 * completely different absolute scales).
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
 * Counts how many distinct past query datasets each channel has
 * appeared in. Pass in whatever historical raw datasets you have
 * (from the cache table, or in-memory during testing). A channel
 * appearing across multiple UNRELATED niches is the strongest signal
 * of "generalist dipping in" — stronger than a raw subscriber
 * threshold, because it's behavioral, not size-based.
 *
 * Cold start: with only one dataset (or none), this always returns 0
 * for every channel — that's expected and correct. Fall back to
 * computeGeneralistFlags's subscriber-based heuristic until you've
 * accumulated a few queries' worth of history.
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
 * Decides which channels count as "generalist-suspected" for this
 * query, using cross-query appearance history when available and
 * falling back to a subscriber-count heuristic when it isn't
 * (cold start — see computeCrossQueryAppearances docs).
 */
function flagGeneralists(
  channels: Omit<ChannelMetrics, 'isViralOutlier' | 'isGeneralistSuspected' | 'crossQueryAppearances'>[],
  crossQueryAppearances: Map<string, number>
): Set<string> {
  const flagged = new Set<string>();

  for (const c of channels) {
    const appearances = crossQueryAppearances.get(c.channelId) ?? 0;

    // Behavioral signal: recurs across enough unrelated past queries.
    const behavioralFlag = appearances >= GENERALIST_APPEARANCE_THRESHOLD;

    // Size-based signal: runs independently, NOT gated on appearances === 0.
    // A channel can be a single-appearance generalist on its first sighting
    // in your dataset (e.g. an 8.6M-sub fitness channel showing up once for
    // "morning routine") — waiting for zero history before applying this
    // check misses exactly that case. This is still a rough proxy (false
    // positives on large legitimate specialists, false negatives on
    // mid-size generalists) — refine once you have enough query history
    // that the behavioral signal can carry more of the weight.
    const sizeFlag = c.subscriberCount !== null && c.subscriberCount >= GENERALIST_SUBSCRIBER_FALLBACK;

    if (behavioralFlag || sizeFlag) {
      flagged.add(c.channelId);
    }
  }

  return flagged;
}

/**
 * Main entry point: given raw niche data (and optionally, historical
 * datasets for cross-query generalist detection, and Trends data for
 * the demand floor), compute the full competition-quality picture.
 *
 * trendsData is optional deliberately — the Trends client is an
 * unofficial API that can fail (see lib/trends.ts) and the score
 * should still be computable without it, just less trustworthy. When
 * absent, a note is added rather than silently treating the niche as
 * having no demand problem.
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

  // ---- v2 scoring formula ----
  // Fixes three confirmed failure modes from testing against 12 real queries:
  //   1. Generalist HEADCOUNT (v1) said little — "how to invest for beginners" had
  //      only 4 generalist channels by count but they held the overwhelming majority
  //      of subscriber mass. Weight by subscribers, not headcount.
  //   2. Raw channel diversity alone missed "SERP concentration" — a query dominated
  //      by a few channels posting frequent refresh content (e.g. monthly "best GPU"
  //      videos) looks like low competition by unique-channel-count but is actually
  //      hard to break into because those few channels systematically own the ranking
  //      positions. Measured here via Herfindahl-Hirschman Index on result-share.
  //   3. The two must-pass validation cases from testing: "pottery for beginners" and
  //      "resume tips for career changers" (both near-zero generalist contamination,
  //      genuine specialist fields) need to score HIGH under this formula — if they
  //      don't, the formula is still wrong. See scripts/test-scoring.ts output.

  // --- Authority pressure: how large are the channels in this field, generally ---
  const meaningfulSubCounts = meaningful
    .map((c) => c.subscriberCount)
    .filter((s): s is number => s !== null && s > 0);
  const medianSubs = median(meaningfulSubCounts);
  // log10(1,000) = 3, log10(50,000,000) ≈ 7.7 — normalize that range to 0-1
  const medianLogSubs = medianSubs > 0 ? Math.log10(medianSubs) : 3;
  const authorityPressure = Math.max(0, Math.min(1, (medianLogSubs - 3) / (7.7 - 3)));

  // --- Concentration pressure: HHI on search-RESULT share per channel ---
  // (not video-count on the channel overall — specifically how many of the top N
  // search results a single channel occupies, which is what "owns the SERP" means)
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

  // --- Generalist authority share: subscriber MASS held by generalists, not headcount ---
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

  const WEIGHT_AUTHORITY = 0.4;
  const WEIGHT_CONCENTRATION = 0.3;
  const WEIGHT_GENERALIST = 0.3;

  const pressure =
    WEIGHT_AUTHORITY * authorityPressure +
    WEIGHT_CONCENTRATION * concentrationPressure +
    WEIGHT_GENERALIST * generalistAuthorityShare;

  const score = Math.round(Math.max(0, Math.min(100, (1 - pressure) * 100)));

  // ---- Demand floor ----
  // Fixes the confirmed gap from testing: "restoring vintage mechanical
  // calculators" scored 91 (highest of 22 real queries) under pure
  // competition scoring, because near-zero competition reads as pure
  // opportunity with nothing checking whether anyone is actually
  // searching for it. Verified against real Google Trends data: this
  // query returns hasData:false across virtually its entire recent
  // history — there is no meaningful search demand to speak of.
  //
  // This floor MULTIPLIES the competition score down when demand
  // coverage is low, rather than averaging it in — a niche with zero
  // demand should not be rescued by having zero competition, because
  // "nobody is searching for this" is disqualifying on its own, not
  // just one input among several.
  let finalScore = score;
  if (trendsData) {
    const coverage = trendsData.recentDataCoverage; // 0-1
    if (coverage < 0.2) {
      notes.push(
        `Google Trends shows almost no search interest for this query (${Math.round(coverage * 100)}% of recent months had any signal at all) — the competition score above may be misleadingly high, since low competition here likely reflects low demand, not open opportunity.`
      );
      finalScore = Math.round(score * 0.3); // heavy penalty, not zero — some legitimately tiny niches are still viable microniches
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
