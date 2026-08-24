/**
 * One-off exploratory script (not a test) — builds two synthetic scenarios
 * representing the two ways "a few channels have locked up a niche" can
 * happen, and runs them through the REAL computeCompetitionScore function
 * to see how the current weights (Authority 35 / Concentration 25 /
 * Generalist 25 / Monetization 15) treat them differently.
 *
 * Scenario A: volume concentration. 5 mid-size, non-generalist channels
 * post prolifically and occupy 20 of 25 top-search-result slots (80%
 * occupancy) for this exact query. None individually huge.
 *
 * Scenario B: reach concentration. 2 giant, generalist-flagged channels
 * occupy only 6 of 25 slots (24% occupancy) but hold most of the
 * subscriber mass among the field.
 *
 * Query is held constant across both scenarios so monetization pressure
 * (which depends only on the query string) cannot explain any of the
 * score difference — isolates the authority/concentration/generalist
 * mechanism specifically.
 */
import { computeCompetitionScore } from '../lib/scoring/competition';
import { YouTubeNicheRawData, YouTubeChannelStats, YouTubeVideoResult } from '../lib/youtube';

const QUERY = 'restoring vintage mechanical calculators'; // confirmed default (no category match) in README caveats

function makeChannel(
  id: string,
  subscriberCount: number,
  videoCount: number,
  viewsPerVideo: number
): YouTubeChannelStats {
  return {
    channelId: id,
    title: id,
    subscriberCount,
    videoCount,
    viewCount: Math.round(videoCount * viewsPerVideo),
    publishedAt: '2021-01-01T00:00:00Z',
  };
}

function repeatVideos(channelId: string, count: number): YouTubeVideoResult[] {
  return Array.from({ length: count }, (_, i) => ({
    videoId: `${channelId}-v${i}`,
    title: `${channelId} video ${i}`,
    description: '',
    channelId,
    channelTitle: channelId,
    publishedAt: '2026-01-01T00:00:00Z',
  }));
}

// ---------- Scenario A: volume concentration ----------
// 5 specialist channels, mid-size (40k-150k subs, none generalist-flagged),
// each posting frequently enough that together they occupy 20/25 = 80%
// of the top results for this query. Remaining 5 slots spread across 5
// distinct one-off small channels (so the field isn't literally just 5
// channels total, mirroring how a real SERP looks).
const scenarioAChannels: YouTubeChannelStats[] = [
  makeChannel('A-spec-1', 145_000, 400, 8_000),
  makeChannel('A-spec-2', 120_000, 350, 7_500),
  makeChannel('A-spec-3', 90_000, 300, 6_000),
  makeChannel('A-spec-4', 60_000, 250, 5_000),
  makeChannel('A-spec-5', 40_000, 200, 4_000),
  ...Array.from({ length: 5 }, (_, i) => makeChannel(`A-small-${i}`, 5_000, 40, 1_500)),
];
const scenarioAVideos: YouTubeVideoResult[] = [
  ...repeatVideos('A-spec-1', 4),
  ...repeatVideos('A-spec-2', 4),
  ...repeatVideos('A-spec-3', 4),
  ...repeatVideos('A-spec-4', 4),
  ...repeatVideos('A-spec-5', 4),
  ...Array.from({ length: 5 }, (_, i) => repeatVideos(`A-small-${i}`, 1)).flat(),
];

const scenarioA: YouTubeNicheRawData = {
  query: QUERY,
  fetchedAt: '2026-08-24T00:00:00Z',
  videos: scenarioAVideos,
  channels: scenarioAChannels,
};

// ---------- Scenario B: reach concentration ----------
// 2 giant channels (2M+ subs, over the 500k generalist size-flag
// threshold) each posting only 3 of the 25 top results (6/25 = 24%
// occupancy) but dominating subscriber mass. Remaining 19 slots spread
// across 19 distinct small/mid specialist channels.
const scenarioBChannels: YouTubeChannelStats[] = [
  makeChannel('B-giant-1', 4_500_000, 900, 40_000),
  makeChannel('B-giant-2', 2_800_000, 700, 35_000),
  ...Array.from({ length: 19 }, (_, i) =>
    makeChannel(`B-spec-${i}`, 30_000 + i * 2_000, 150, 3_000)
  ),
];
const scenarioBVideos: YouTubeVideoResult[] = [
  ...repeatVideos('B-giant-1', 3),
  ...repeatVideos('B-giant-2', 3),
  ...Array.from({ length: 19 }, (_, i) => repeatVideos(`B-spec-${i}`, 1)).flat(),
];

const scenarioB: YouTubeNicheRawData = {
  query: QUERY,
  fetchedAt: '2026-08-24T00:00:00Z',
  videos: scenarioBVideos,
  channels: scenarioBChannels,
};

// ---------- Scenario C: combined concentration ----------
// 2 giant channels (2M+ subs, over the 500k generalist size-flag
// threshold) post prolifically and occupy 20 of 25 slots (80%
// occupancy) AND hold most of the subscriber mass.
const scenarioCChannels: YouTubeChannelStats[] = [
  makeChannel('C-giant-1', 4_500_000, 900, 40_000),
  makeChannel('C-giant-2', 2_800_000, 700, 35_000),
  ...Array.from({ length: 5 }, (_, i) => makeChannel(`C-small-${i}`, 5_000, 40, 1_500)),
];
const scenarioCVideos: YouTubeVideoResult[] = [
  ...repeatVideos('C-giant-1', 10),
  ...repeatVideos('C-giant-2', 10),
  ...Array.from({ length: 5 }, (_, i) => repeatVideos(`C-small-${i}`, 1)).flat(),
];

const scenarioC: YouTubeNicheRawData = {
  query: QUERY,
  fetchedAt: '2026-08-24T00:00:00Z',
  videos: scenarioCVideos,
  channels: scenarioCChannels,
};

function report(label: string, data: YouTubeNicheRawData) {
  const result = computeCompetitionScore(data, [], null);
  console.log(`\n=== ${label} ===`);
  console.log('meaningfulCompetitorCount:', result.meaningfulCompetitorCount);
  console.log('specialistCompetitorCount:', result.specialistCompetitorCount);
  console.log('authorityPressure:', result.authorityPressure.toFixed(4));
  console.log('concentrationPressure (HHI):', result.concentrationPressure.toFixed(4));
  console.log('generalistAuthorityShare:', result.generalistAuthorityShare.toFixed(4));
  console.log('SCORE:', result.score);
  console.log('notes:');
  result.notes.forEach((n) => console.log('  -', n));

  const generalistFlagged = result.channels.filter((c) => c.isGeneralistSuspected).map((c) => c.channelId);
  console.log('generalist-flagged channels:', generalistFlagged);

  return result;
}

const resultA = report('Scenario A — volume concentration (5 mid-size specialists, 80% slot occupancy)', scenarioA);
const resultB = report('Scenario B — reach concentration (2 giant generalists, 24% slot occupancy)', scenarioB);
const resultC = report('Scenario C — combined concentration (2 giant generalists, 80% slot occupancy)', scenarioC);

console.log('\n=== DELTAS (current formula) ===');
console.log('Score A:', resultA.score);
console.log('Score B:', resultB.score);
console.log('Score C:', resultC.score);
console.log('Gap A vs B:', resultA.score - resultB.score);
console.log('Gap A vs C:', resultA.score - resultC.score);
console.log('Gap B vs C:', resultB.score - resultC.score);

/**
 * ---------------------------------------------------------------------
 * PROTOTYPE: top-N-median authority pressure
 * ---------------------------------------------------------------------
 * Scenario C showed authorityPressure is composition-fragile: it's a
 * plain median over ALL meaningful (non-thin) channels, so padding a
 * scenario with more small filler channels shifts the median away from
 * the actual dominant players, even when those players are unchanged.
 *
 * This prototype replaces "median of all meaningful subscriber counts"
 * with "median of the top N largest meaningful subscriber counts" —
 * intent: measure how big the channels that actually dominate the field
 * are, not how big the "middle" of an arbitrarily-sized result set is.
 *
 * N=5 is a first guess, not tuned — chosen because it roughly matches
 * "a handful of channels" in both scenarios A and C. Sensitivity to N
 * is checked below with N=3 and N=8 too.
 *
 * Everything else (concentration, generalist share, monetization
 * redistribution, weights) is held identical to the real formula so
 * this isolates the authority-pressure definition specifically. The
 * calibration range is the DEFAULT range (3.0-7.7) in all cases here,
 * since every scenario passes historicalDatasets=[] (< 5, so
 * calculateCalibrationRange in the real code falls back to default too)
 * — so using the default directly here is faithful to the real function,
 * not a simplification that changes behavior.
 */
const THIN_SUBSCRIBER_FLOOR = 1000;
const THIN_VIDEO_COUNT_FLOOR = 10;
const CALIBRATION_MIN = 3.0;
const CALIBRATION_MAX = 7.7;
const WEIGHT_AUTHORITY = 0.35;
const WEIGHT_CONCENTRATION = 0.25;
const WEIGHT_GENERALIST = 0.25;
// monetization weight (0.15) is dropped and redistributed in all three
// scenarios here, matching the real "default category" behavior confirmed
// in the notes output above.
const REMAINING_WEIGHT_SUM = WEIGHT_AUTHORITY + WEIGHT_CONCENTRATION + WEIGHT_GENERALIST;

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function meaningfulSubCounts(channels: YouTubeChannelStats[]): number[] {
  return channels
    .filter((c) => !(c.videoCount < THIN_VIDEO_COUNT_FLOOR || (c.subscriberCount !== null && c.subscriberCount < THIN_SUBSCRIBER_FLOOR)))
    .map((c) => c.subscriberCount)
    .filter((s): s is number => s !== null && s > 0);
}

function topNMedian(subCounts: number[], n: number): number {
  const sortedDesc = [...subCounts].sort((a, b) => b - a);
  return median(sortedDesc.slice(0, n));
}

function authorityPressureFromMedian(medianSubs: number): number {
  const medianLogSubs = medianSubs > 0 ? Math.log10(medianSubs) : 3;
  return Math.max(0, Math.min(1, (medianLogSubs - CALIBRATION_MIN) / (CALIBRATION_MAX - CALIBRATION_MIN)));
}

function recomputeScore(authorityPressure: number, concentrationPressure: number, generalistAuthorityShare: number): number {
  const pressure =
    (WEIGHT_AUTHORITY / REMAINING_WEIGHT_SUM) * authorityPressure +
    (WEIGHT_CONCENTRATION / REMAINING_WEIGHT_SUM) * concentrationPressure +
    (WEIGHT_GENERALIST / REMAINING_WEIGHT_SUM) * generalistAuthorityShare;
  return Math.round(Math.max(0, Math.min(100, (1 - pressure) * 100)));
}

function reportTopN(label: string, channels: YouTubeChannelStats[], result: ReturnType<typeof computeCompetitionScore>) {
  const subCounts = meaningfulSubCounts(channels);
  console.log(`\n--- ${label} ---`);
  console.log('meaningful subscriber counts (all):', subCounts.sort((a, b) => b - a));

  for (const n of [3, 5, 8]) {
    const topMedian = topNMedian(subCounts, n);
    const newAuthorityPressure = authorityPressureFromMedian(topMedian);
    const newScore = recomputeScore(newAuthorityPressure, result.concentrationPressure, result.generalistAuthorityShare);
    console.log(
      `  N=${n}: top-N median subs=${Math.round(topMedian).toLocaleString()}, authorityPressure ${result.authorityPressure.toFixed(4)} -> ${newAuthorityPressure.toFixed(4)}, score ${result.score} -> ${newScore}`
    );
  }
}

console.log('\n=== PROTOTYPE: top-N-median authority pressure ===');
reportTopN('Scenario A', scenarioAChannels, resultA);
reportTopN('Scenario B', scenarioBChannels, resultB);
reportTopN('Scenario C', scenarioCChannels, resultC);

/**
 * ---------------------------------------------------------------------
 * PROTOTYPE 2: mass-weighted median authority pressure
 * ---------------------------------------------------------------------
 * top-N-median just relocated the composition-sensitivity onto an
 * arbitrary N (scenario C: N=5/8 landed on filler channels and gave
 * ZERO change from baseline; N=3 gave a 24-point swing from the same
 * data). This version removes N entirely: instead of "median by
 * channel headcount," weight each channel's subscriber count by
 * itself (its own mass) and find the value at which cumulative
 * subscriber mass crosses 50% of the field's total. A channel (or
 * small group) holding most of the subscriber mass will dominate the
 * result regardless of how many small filler channels are also present
 * — no headcount parameter to get wrong.
 */
function weightedMedianSubs(subCounts: number[]): number {
  if (subCounts.length === 0) return 0;
  const sorted = [...subCounts].sort((a, b) => a - b);
  const totalMass = sorted.reduce((sum, s) => sum + s, 0);
  const half = totalMass / 2;
  let cumulative = 0;
  for (const s of sorted) {
    cumulative += s;
    if (cumulative >= half) return s;
  }
  return sorted[sorted.length - 1];
}

function reportMassWeighted(label: string, channels: YouTubeChannelStats[], result: ReturnType<typeof computeCompetitionScore>) {
  const subCounts = meaningfulSubCounts(channels);
  const weightedMedian = weightedMedianSubs(subCounts);
  const newAuthorityPressure = authorityPressureFromMedian(weightedMedian);
  const newScore = recomputeScore(newAuthorityPressure, result.concentrationPressure, result.generalistAuthorityShare);

  // Check whether the channel the weighted median landed on is itself
  // generalist-flagged — tests whether this metric is actually
  // independent evidence or just re-detecting the same generalist
  // dominance that generalistAuthorityShare (25% weight) already covers.
  const landingChannel = channels.find((c) => c.subscriberCount === weightedMedian);
  const landingIsGeneralistSize = (landingChannel?.subscriberCount ?? 0) >= 500_000;

  console.log(`\n--- ${label} ---`);
  console.log(
    `  weighted-median subs=${Math.round(weightedMedian).toLocaleString()} (landing channel: ${landingChannel?.channelId}, generalist-size: ${landingIsGeneralistSize})`
  );
  console.log(`  authorityPressure ${result.authorityPressure.toFixed(4)} -> ${newAuthorityPressure.toFixed(4)}`);
  console.log(`  score ${result.score} -> ${newScore}`);
}

console.log('\n=== PROTOTYPE 2: mass-weighted median authority pressure ===');
reportMassWeighted('Scenario A', scenarioAChannels, resultA);
reportMassWeighted('Scenario B', scenarioBChannels, resultB);
reportMassWeighted('Scenario C', scenarioCChannels, resultC);

/**
 * ---------------------------------------------------------------------
 * PROTOTYPE 3: specialist-only median authority pressure
 * ---------------------------------------------------------------------
 * Both prior prototypes eventually landed the "typical size" measure
 * on a generalist-size channel whenever one dominated the field —
 * making authorityPressure redundant with generalistAuthorityShare
 * (both keyed off subscriber size, both then pushing the score in the
 * same direction, effectively double-counting one signal at ~66%
 * combined weight).
 *
 * This variant excludes generalist-flagged channels from the authority
 * calculation entirely (plain median, no top-N/mass-weighting changes)
 * — the intent being: authorityPressure should measure "how big are
 * the SPECIALIST channels I'd actually be competing against," which is
 * independent evidence from "how much of the field's reach do
 * generalists hold." If no specialists remain (generalists-only field),
 * falls back to the plain meaningful-channel median as a defined
 * edge case, and flags that in the note.
 */
function reportSpecialistOnly(label: string, result: ReturnType<typeof computeCompetitionScore>) {
  const specialistSubCounts = result.channels
    .filter((c) => !c.isThin && !c.isGeneralistSuspected)
    .map((c) => c.subscriberCount)
    .filter((s): s is number => s !== null && s > 0);

  const allMeaningfulSubCounts = result.channels
    .filter((c) => !c.isThin)
    .map((c) => c.subscriberCount)
    .filter((s): s is number => s !== null && s > 0);

  const usedFallback = specialistSubCounts.length === 0;
  const basisSubCounts = usedFallback ? allMeaningfulSubCounts : specialistSubCounts;
  const specialistMedian = median(basisSubCounts);
  const newAuthorityPressure = authorityPressureFromMedian(specialistMedian);
  const newScore = recomputeScore(newAuthorityPressure, result.concentrationPressure, result.generalistAuthorityShare);

  console.log(`\n--- ${label} ---`);
  console.log(`  specialist (non-generalist) meaningful channels: ${specialistSubCounts.length} of ${allMeaningfulSubCounts.length}`);
  console.log(`  ${usedFallback ? 'FALLBACK: no specialists left, used all-meaningful median' : 'median of specialist subs'}=${Math.round(specialistMedian).toLocaleString()}`);
  console.log(`  authorityPressure ${result.authorityPressure.toFixed(4)} -> ${newAuthorityPressure.toFixed(4)}`);
  console.log(`  generalistAuthorityShare (unchanged): ${result.generalistAuthorityShare.toFixed(4)}`);
  console.log(`  score ${result.score} -> ${newScore}`);
}

console.log('\n=== PROTOTYPE 3: specialist-only median authority pressure ===');
reportSpecialistOnly('Scenario A', resultA);
reportSpecialistOnly('Scenario B', resultB);
reportSpecialistOnly('Scenario C', resultC);

/**
 * ---------------------------------------------------------------------
 * PROTOTYPE 4: specialist-only, mass-weighted median authority pressure
 * ---------------------------------------------------------------------
 * Combines prototype 2 (mass-weighted median — fixes filler-channel
 * dilution) with prototype 3 (specialist-only basis — fixes
 * redundancy with generalistAuthorityShare). Intent: measure how much
 * subscriber mass the SPECIALIST competitors command, immune to being
 * diluted by tiny filler channels and not re-detecting generalist
 * dominance that's already captured elsewhere.
 *
 * Same generalist-only-field fallback as prototype 3: if no specialists
 * remain, falls back to the mass-weighted median over all meaningful
 * channels.
 */
function reportSpecialistMassWeighted(label: string, result: ReturnType<typeof computeCompetitionScore>) {
  const specialistSubCounts = result.channels
    .filter((c) => !c.isThin && !c.isGeneralistSuspected)
    .map((c) => c.subscriberCount)
    .filter((s): s is number => s !== null && s > 0);

  const allMeaningfulSubCounts = result.channels
    .filter((c) => !c.isThin)
    .map((c) => c.subscriberCount)
    .filter((s): s is number => s !== null && s > 0);

  const usedFallback = specialistSubCounts.length === 0;
  const basisSubCounts = usedFallback ? allMeaningfulSubCounts : specialistSubCounts;
  const weightedMedian = weightedMedianSubs(basisSubCounts);
  const newAuthorityPressure = authorityPressureFromMedian(weightedMedian);
  const newScore = recomputeScore(newAuthorityPressure, result.concentrationPressure, result.generalistAuthorityShare);

  console.log(`\n--- ${label} ---`);
  console.log(`  specialist (non-generalist) meaningful channels: ${specialistSubCounts.length} of ${allMeaningfulSubCounts.length}`);
  console.log(`  ${usedFallback ? 'FALLBACK: no specialists left, used all-meaningful mass-weighted median' : 'mass-weighted median of specialist subs'}=${Math.round(weightedMedian).toLocaleString()}`);
  console.log(`  authorityPressure ${result.authorityPressure.toFixed(4)} -> ${newAuthorityPressure.toFixed(4)}`);
  console.log(`  generalistAuthorityShare (unchanged): ${result.generalistAuthorityShare.toFixed(4)}`);
  console.log(`  score ${result.score} -> ${newScore}`);
}

console.log('\n=== PROTOTYPE 4: specialist-only, mass-weighted median authority pressure ===');
reportSpecialistMassWeighted('Scenario A', resultA);
reportSpecialistMassWeighted('Scenario B', resultB);
reportSpecialistMassWeighted('Scenario C', resultC);
