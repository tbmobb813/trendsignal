import { YouTubeNicheRawData, YouTubeChannelStats } from '../youtube';
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
 * datasets for cross-query generalist detection), compute the full
 * competition-quality picture.
 */
export function computeCompetitionScore(
  data: YouTubeNicheRawData,
  historicalDatasets: YouTubeNicheRawData[] = []
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

  // First-pass scoring formula: fewer specialist competitors relative to
  // total search results returned = more room. This is deliberately
  // simple and almost certainly wrong in its exact weighting — the
  // point right now is to have SOMETHING to compare across niches and
  // refine, not a final formula. Treat the score as directional, not
  // authoritative.
  const totalResultsConsidered = data.videos.length || 1;
  const specialistDensity = specialistCompetitorCount / totalResultsConsidered;
  const score = Math.round(Math.max(0, Math.min(100, (1 - specialistDensity) * 100)));

  return {
    query: data.query,
    channels,
    rawCompetitorCount,
    meaningfulCompetitorCount,
    specialistCompetitorCount,
    generalistDipInGap,
    medianVideoCount,
    score,
    notes,
  };
}
