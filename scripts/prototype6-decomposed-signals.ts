/**
 * Prototype 6 (Option 2): decompose authority pressure into two signals
 * instead of one blended statistic.
 *
 *  - authorityPressure: plain median over specialist (non-thin,
 *    non-generalist) channels, EXCLUDING statistical size-outliers
 *    (subs > median * OUTLIER_MULTIPLIER). Reuses the exact convention
 *    already in competition.ts's flagViralOutliers (median * 5), just
 *    applied to subscriber size instead of views-per-video.
 *  - specialistDominanceShare (NEW): share of specialist subscriber
 *    mass held by those excluded outlier channels. Parallel in spirit
 *    to generalistAuthorityShare, but catches local/niche-specific
 *    giants that aren't cross-topic generalists.
 *
 * Test weights (first guess, NOT tuned): Authority 25 / Concentration 25
 * / Generalist 25 / Dominance 10 / Monetization 15, with the same
 * proportional redistribution-on-monetization-default logic as the real
 * formula, extended to four terms.
 */
import fs from 'fs';
import path from 'path';
import { computeCompetitionScore } from '../lib/scoring/competition';
import { YouTubeNicheRawData, YouTubeChannelStats, YouTubeVideoResult } from '../lib/youtube';

const FIXTURE_DIR = path.join(__dirname, '..', 'test-data');
const CALIBRATION_MIN = 3.0;
const CALIBRATION_MAX = 7.7;

const WEIGHT_AUTHORITY = 0.25;
const WEIGHT_CONCENTRATION = 0.25;
const WEIGHT_GENERALIST = 0.25;
const WEIGHT_DOMINANCE = 0.10;
const WEIGHT_MONETIZATION = 0.15;

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function authorityPressureFromMedian(medianSubs: number): number {
  const medianLogSubs = medianSubs > 0 ? Math.log10(medianSubs) : 3;
  return Math.max(0, Math.min(1, (medianLogSubs - CALIBRATION_MIN) / (CALIBRATION_MAX - CALIBRATION_MIN)));
}

function specialistBasis(result: ReturnType<typeof computeCompetitionScore>): number[] {
  const specialistSubCounts = result.channels
    .filter((c) => !c.isThin && !c.isGeneralistSuspected)
    .map((c) => c.subscriberCount)
    .filter((s): s is number => s !== null && s > 0);
  if (specialistSubCounts.length > 0) return specialistSubCounts;
  return result.channels
    .filter((c) => !c.isThin)
    .map((c) => c.subscriberCount)
    .filter((s): s is number => s !== null && s > 0);
}

function decompose(subCounts: number[], multiplier: number) {
  const baseMedian = median(subCounts);
  const outlierThreshold = baseMedian * multiplier;
  const outliers = baseMedian > 0 ? subCounts.filter((s) => s > outlierThreshold) : [];
  const nonOutliers = subCounts.filter((s) => !(baseMedian > 0 && s > outlierThreshold));
  const robustBasis = nonOutliers.length > 0 ? nonOutliers : subCounts;
  const robustMedian = median(robustBasis);
  const totalMass = subCounts.reduce((s, v) => s + v, 0);
  const outlierMass = outliers.reduce((s, v) => s + v, 0);
  const dominanceShare = totalMass > 0 ? outlierMass / totalMass : 0;
  return { robustMedian, dominanceShare, outlierCount: outliers.length, totalCount: subCounts.length };
}

function monetizationInputs(result: ReturnType<typeof computeCompetitionScore>) {
  const matchedByDefault = result.notes.some((n) => n.includes('No specific monetization category matched'));
  let monetizationPressure = 0;
  if (!matchedByDefault) {
    const basePressure = 1 - result.score / 100;
    // back out monetizationPressure algebraically from the REAL (current)
    // formula's known inputs, since we don't have direct access here
    const REAL_WA = 0.35, REAL_WC = 0.25, REAL_WG = 0.25, REAL_WM = 0.15;
    monetizationPressure =
      (basePressure - REAL_WA * result.authorityPressure - REAL_WC * result.concentrationPressure - REAL_WG * result.generalistAuthorityShare) / REAL_WM;
  }
  return { matchedByDefault, monetizationPressure };
}

function recomputeScore(
  authorityPressure: number,
  concentrationPressure: number,
  generalistAuthorityShare: number,
  dominanceShare: number,
  monetizationPressure: number,
  monetizationMatchedByDefault: boolean
): number {
  let pressure: number;
  if (monetizationMatchedByDefault) {
    const remaining = WEIGHT_AUTHORITY + WEIGHT_CONCENTRATION + WEIGHT_GENERALIST + WEIGHT_DOMINANCE;
    pressure =
      (WEIGHT_AUTHORITY / remaining) * authorityPressure +
      (WEIGHT_CONCENTRATION / remaining) * concentrationPressure +
      (WEIGHT_GENERALIST / remaining) * generalistAuthorityShare +
      (WEIGHT_DOMINANCE / remaining) * dominanceShare;
  } else {
    pressure =
      WEIGHT_AUTHORITY * authorityPressure +
      WEIGHT_CONCENTRATION * concentrationPressure +
      WEIGHT_GENERALIST * generalistAuthorityShare +
      WEIGHT_DOMINANCE * dominanceShare +
      WEIGHT_MONETIZATION * monetizationPressure;
  }
  return Math.round(Math.max(0, Math.min(100, (1 - pressure) * 100)));
}

function run(result: ReturnType<typeof computeCompetitionScore>, multiplier: number) {
  const basis = specialistBasis(result);
  const { robustMedian, dominanceShare, outlierCount, totalCount } = decompose(basis, multiplier);
  const newAuthority = authorityPressureFromMedian(robustMedian);
  const { matchedByDefault, monetizationPressure } = monetizationInputs(result);
  const newScore = recomputeScore(newAuthority, result.concentrationPressure, result.generalistAuthorityShare, dominanceShare, monetizationPressure, matchedByDefault);
  return { robustMedian, newAuthority, dominanceShare, outlierCount, totalCount, newScore };
}

// ---------- Key real fixtures, multiplier=5 (precedented) and multiplier=8 (sensitivity check) ----------
const KEY_FIXTURES = ['restoring-vintage-mechanical-calculators.json', 'home-espresso-setup.json', 'how-to-invest-for-beginners.json'];

console.log('=== Key fixtures, decomposed signals ===');
for (const file of KEY_FIXTURES) {
  const data: YouTubeNicheRawData = JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, file), 'utf-8'));
  const result = computeCompetitionScore(data, [], null);
  console.log(`\n${file} (baseline score ${result.score}, baseline authorityPressure ${result.authorityPressure.toFixed(3)})`);
  for (const mult of [5, 8]) {
    const r = run(result, mult);
    console.log(
      `  multiplier=${mult}: outliers=${r.outlierCount}/${r.totalCount}, robust median subs=${Math.round(r.robustMedian).toLocaleString()}, authorityPressure->${r.newAuthority.toFixed(3)}, dominanceShare=${r.dominanceShare.toFixed(3)}, score->${r.newScore} (delta ${r.newScore - result.score})`
    );
  }
}

// ---------- All 22 fixtures at multiplier=5 ----------
const files = fs.readdirSync(FIXTURE_DIR).filter((f) => f.endsWith('.json'));
const rows: { file: string; delta: number; outliers: number; total: number; dominance: number }[] = [];
for (const file of files) {
  const data: YouTubeNicheRawData = JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, file), 'utf-8'));
  const result = computeCompetitionScore(data, [], null);
  const r = run(result, 5);
  rows.push({ file, delta: r.newScore - result.score, outliers: r.outlierCount, total: r.totalCount, dominance: r.dominanceShare });
}
rows.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
console.log('\n=== All 22 fixtures, multiplier=5 (sorted by |delta|) ===');
rows.forEach((r) => console.log(`  ${r.file.padEnd(45)} delta=${r.delta > 0 ? '+' : ''}${r.delta}  outliers=${r.outliers}/${r.total}  dominanceShare=${r.dominance.toFixed(3)}`));
console.log('\nMean |delta|:', (rows.reduce((s, r) => s + Math.abs(r.delta), 0) / rows.length).toFixed(2));
console.log('Max delta:', Math.max(...rows.map((r) => r.delta)), ' Min delta:', Math.min(...rows.map((r) => r.delta)));
console.log('Fixtures with >=1 outlier flagged:', rows.filter((r) => r.outliers > 0).length, 'of', rows.length);

// ---------- Synthetic scenario regression check, multiplier=5 ----------
function makeChannel(id: string, subscriberCount: number, videoCount: number, viewsPerVideo: number): YouTubeChannelStats {
  return { channelId: id, title: id, subscriberCount, videoCount, viewCount: Math.round(videoCount * viewsPerVideo), publishedAt: '2021-01-01T00:00:00Z' };
}
function repeatVideos(channelId: string, count: number): YouTubeVideoResult[] {
  return Array.from({ length: count }, (_, i) => ({ videoId: `${channelId}-v${i}`, title: `${channelId} video ${i}`, description: '', channelId, channelTitle: channelId, publishedAt: '2026-01-01T00:00:00Z' }));
}
const QUERY = 'restoring vintage mechanical calculators';

const scenarioAChannels: YouTubeChannelStats[] = [
  makeChannel('A-spec-1', 145_000, 400, 8_000),
  makeChannel('A-spec-2', 120_000, 350, 7_500),
  makeChannel('A-spec-3', 90_000, 300, 6_000),
  makeChannel('A-spec-4', 60_000, 250, 5_000),
  makeChannel('A-spec-5', 40_000, 200, 4_000),
  ...Array.from({ length: 5 }, (_, i) => makeChannel(`A-small-${i}`, 5_000, 40, 1_500)),
];
const scenarioA: YouTubeNicheRawData = {
  query: QUERY, fetchedAt: '2026-08-24T00:00:00Z',
  videos: [...repeatVideos('A-spec-1', 4), ...repeatVideos('A-spec-2', 4), ...repeatVideos('A-spec-3', 4), ...repeatVideos('A-spec-4', 4), ...repeatVideos('A-spec-5', 4), ...Array.from({ length: 5 }, (_, i) => repeatVideos(`A-small-${i}`, 1)).flat()],
  channels: scenarioAChannels,
};

const scenarioBChannels: YouTubeChannelStats[] = [
  makeChannel('B-giant-1', 4_500_000, 900, 40_000),
  makeChannel('B-giant-2', 2_800_000, 700, 35_000),
  ...Array.from({ length: 19 }, (_, i) => makeChannel(`B-spec-${i}`, 30_000 + i * 2_000, 150, 3_000)),
];
const scenarioB: YouTubeNicheRawData = {
  query: QUERY, fetchedAt: '2026-08-24T00:00:00Z',
  videos: [...repeatVideos('B-giant-1', 3), ...repeatVideos('B-giant-2', 3), ...Array.from({ length: 19 }, (_, i) => repeatVideos(`B-spec-${i}`, 1)).flat()],
  channels: scenarioBChannels,
};

const scenarioCChannels: YouTubeChannelStats[] = [
  makeChannel('C-giant-1', 4_500_000, 900, 40_000),
  makeChannel('C-giant-2', 2_800_000, 700, 35_000),
  ...Array.from({ length: 5 }, (_, i) => makeChannel(`C-small-${i}`, 5_000, 40, 1_500)),
];
const scenarioC: YouTubeNicheRawData = {
  query: QUERY, fetchedAt: '2026-08-24T00:00:00Z',
  videos: [...repeatVideos('C-giant-1', 10), ...repeatVideos('C-giant-2', 10), ...Array.from({ length: 5 }, (_, i) => repeatVideos(`C-small-${i}`, 1)).flat()],
  channels: scenarioCChannels,
};

console.log('\n=== Synthetic scenario regression check, multiplier=5 ===');
for (const [label, data] of [['A', scenarioA], ['B', scenarioB], ['C', scenarioC]] as const) {
  const result = computeCompetitionScore(data, [], null);
  const r = run(result, 5);
  console.log(`  Scenario ${label}: baseline=${result.score}, decomposed=${r.newScore}, outliers=${r.outlierCount}/${r.totalCount}, dominanceShare=${r.dominanceShare.toFixed(3)}`);
}
