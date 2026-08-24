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

console.log('\n=== DELTA ===');
console.log('Score A:', resultA.score, ' Score B:', resultB.score, ' Gap:', resultA.score - resultB.score);
