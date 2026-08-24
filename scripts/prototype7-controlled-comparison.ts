/**
 * Prototype 7: controlled comparison — isolates whether Prototype 6's
 * decomposition itself (robust median + dominance share) is responsible
 * for its results, separate from the weight-scheme change that was
 * confounded with it.
 *
 * Prototype 6 used a NEW 5-term weight scheme (25/25/25/10/15), which
 * dropped authority's effective weight from ~41% (original formula,
 * monetization-default redistribution among 3 terms: 35/85) to ~29%
 * (redistribution among 4 terms: 25/85) — a large dilution on its own,
 * independent of whether the decomposition logic is good.
 *
 * This version holds the REAL formula's weights EXACTLY constant
 * (Authority 0.35 / Concentration 0.25 / Generalist 0.25 /
 * Monetization 0.15, same 3-term redistribution-on-default logic as
 * competition.ts) and folds dominanceShare INTO the authority term
 * itself, inside the same 35% budget:
 *
 *   authorityPressureV3 = clamp(authorityPressureFromMedian(robustMedian)
 *                                + DOMINANCE_BUMP * dominanceShare, 0, 1)
 *
 * Also adds a minimum-sample-size guard (MIN_SAMPLE_FOR_OUTLIER = 6)
 * before attempting outlier detection at all, addressing the n=4
 * unreliable-threshold issue flagged against how-to-invest-for-beginners
 * in Prototype 6's results — below that sample size, robust median
 * falls back to the plain specialist median (Prototype 3's definition)
 * and dominanceShare is forced to 0 rather than computed from a
 * statistically unreliable 4-point sample.
 *
 * Tests DOMINANCE_BUMP = 0.2 / 0.3 / 0.4 for sensitivity.
 */
import fs from 'fs';
import path from 'path';
import { computeCompetitionScore } from '../lib/scoring/competition';
import { YouTubeNicheRawData, YouTubeChannelStats, YouTubeVideoResult } from '../lib/youtube';

const FIXTURE_DIR = path.join(__dirname, '..', 'test-data');
const CALIBRATION_MIN = 3.0;
const CALIBRATION_MAX = 7.7;
const WEIGHT_AUTHORITY = 0.35;
const WEIGHT_CONCENTRATION = 0.25;
const WEIGHT_GENERALIST = 0.25;
const WEIGHT_MONETIZATION = 0.15;
const OUTLIER_MULTIPLIER = 5;
const MIN_SAMPLE_FOR_OUTLIER = 6;

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

function decompose(subCounts: number[]) {
  if (subCounts.length < MIN_SAMPLE_FOR_OUTLIER) {
    return { robustMedian: median(subCounts), dominanceShare: 0, outlierCount: 0, totalCount: subCounts.length, skippedForSampleSize: true };
  }
  const baseMedian = median(subCounts);
  const outlierThreshold = baseMedian * OUTLIER_MULTIPLIER;
  const outliers = baseMedian > 0 ? subCounts.filter((s) => s > outlierThreshold) : [];
  const nonOutliers = subCounts.filter((s) => !(baseMedian > 0 && s > outlierThreshold));
  const robustBasis = nonOutliers.length > 0 ? nonOutliers : subCounts;
  const robustMedian = median(robustBasis);
  const totalMass = subCounts.reduce((s, v) => s + v, 0);
  const outlierMass = outliers.reduce((s, v) => s + v, 0);
  const dominanceShare = totalMass > 0 ? outlierMass / totalMass : 0;
  return { robustMedian, dominanceShare, outlierCount: outliers.length, totalCount: subCounts.length, skippedForSampleSize: false };
}

function monetizationInputs(result: ReturnType<typeof computeCompetitionScore>) {
  const matchedByDefault = result.notes.some((n) => n.includes('No specific monetization category matched'));
  let monetizationPressure = 0;
  if (!matchedByDefault) {
    const basePressure = 1 - result.score / 100;
    monetizationPressure =
      (basePressure - WEIGHT_AUTHORITY * result.authorityPressure - WEIGHT_CONCENTRATION * result.concentrationPressure - WEIGHT_GENERALIST * result.generalistAuthorityShare) / WEIGHT_MONETIZATION;
  }
  return { matchedByDefault, monetizationPressure };
}

// EXACT same weight/redistribution logic as competition.ts — nothing new added
function recomputeScore(authorityPressure: number, concentrationPressure: number, generalistAuthorityShare: number, monetizationPressure: number, monetizationMatchedByDefault: boolean): number {
  let pressure: number;
  if (monetizationMatchedByDefault) {
    const remaining = WEIGHT_AUTHORITY + WEIGHT_CONCENTRATION + WEIGHT_GENERALIST;
    pressure = (WEIGHT_AUTHORITY / remaining) * authorityPressure + (WEIGHT_CONCENTRATION / remaining) * concentrationPressure + (WEIGHT_GENERALIST / remaining) * generalistAuthorityShare;
  } else {
    pressure = WEIGHT_AUTHORITY * authorityPressure + WEIGHT_CONCENTRATION * concentrationPressure + WEIGHT_GENERALIST * generalistAuthorityShare + WEIGHT_MONETIZATION * monetizationPressure;
  }
  return Math.round(Math.max(0, Math.min(100, (1 - pressure) * 100)));
}

function run(result: ReturnType<typeof computeCompetitionScore>, bump: number) {
  const basis = specialistBasis(result);
  const { robustMedian, dominanceShare, outlierCount, totalCount, skippedForSampleSize } = decompose(basis);
  const baseAuthority = authorityPressureFromMedian(robustMedian);
  const authorityV3 = Math.max(0, Math.min(1, baseAuthority + bump * dominanceShare));
  const { matchedByDefault, monetizationPressure } = monetizationInputs(result);
  const newScore = recomputeScore(authorityV3, result.concentrationPressure, result.generalistAuthorityShare, monetizationPressure, matchedByDefault);
  return { robustMedian, baseAuthority, authorityV3, dominanceShare, outlierCount, totalCount, skippedForSampleSize, newScore };
}

// ---------- Key fixtures across bump values ----------
const KEY_FIXTURES = ['restoring-vintage-mechanical-calculators.json', 'home-espresso-setup.json', 'how-to-invest-for-beginners.json'];
const BUMPS = [0.2, 0.3, 0.4];

console.log('=== Key fixtures, controlled comparison (weights held at 35/25/25/15) ===');
for (const file of KEY_FIXTURES) {
  const data: YouTubeNicheRawData = JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, file), 'utf-8'));
  const result = computeCompetitionScore(data, [], null);
  console.log(`\n${file} (baseline score ${result.score}, baseline authorityPressure ${result.authorityPressure.toFixed(3)})`);
  for (const bump of BUMPS) {
    const r = run(result, bump);
    console.log(
      `  bump=${bump}: sampleSkipped=${r.skippedForSampleSize}, outliers=${r.outlierCount}/${r.totalCount}, robustMedian=${Math.round(r.robustMedian).toLocaleString()}, baseAuthority=${r.baseAuthority.toFixed(3)}, dominanceShare=${r.dominanceShare.toFixed(3)}, authorityV3=${r.authorityV3.toFixed(3)}, score->${r.newScore} (delta ${r.newScore - result.score})`
    );
  }
}

// ---------- All 22 fixtures at bump=0.3 ----------
const CHOSEN_BUMP = 0.3;
const files = fs.readdirSync(FIXTURE_DIR).filter((f) => f.endsWith('.json'));
const rows: { file: string; delta: number; outliers: number; total: number; dominance: number; skipped: boolean }[] = [];
for (const file of files) {
  const data: YouTubeNicheRawData = JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, file), 'utf-8'));
  const result = computeCompetitionScore(data, [], null);
  const r = run(result, CHOSEN_BUMP);
  rows.push({ file, delta: r.newScore - result.score, outliers: r.outlierCount, total: r.totalCount, dominance: r.dominanceShare, skipped: r.skippedForSampleSize });
}
rows.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
console.log(`\n=== All 22 fixtures, bump=${CHOSEN_BUMP} (sorted by |delta|) ===`);
rows.forEach((r) => console.log(`  ${r.file.padEnd(45)} delta=${r.delta > 0 ? '+' : ''}${r.delta}  outliers=${r.outliers}/${r.total}  dominanceShare=${r.dominance.toFixed(3)}  sampleSkipped=${r.skipped}`));
console.log('\nMean |delta|:', (rows.reduce((s, r) => s + Math.abs(r.delta), 0) / rows.length).toFixed(2));
console.log('Max delta:', Math.max(...rows.map((r) => r.delta)), ' Min delta:', Math.min(...rows.map((r) => r.delta)));
console.log('Fixtures with sample-size guard triggered (skipped outlier detection):', rows.filter((r) => r.skipped).length);

// ---------- Synthetic scenario regression check, bump=0.3 ----------
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

console.log(`\n=== Synthetic scenario regression check, bump=${CHOSEN_BUMP} ===`);
for (const [label, data] of [['A', scenarioA], ['B', scenarioB], ['C', scenarioC]] as const) {
  const result = computeCompetitionScore(data, [], null);
  const r = run(result, CHOSEN_BUMP);
  console.log(`  Scenario ${label}: baseline=${result.score}, controlled=${r.newScore}, outliers=${r.outlierCount}/${r.totalCount}, dominanceShare=${r.dominanceShare.toFixed(3)}`);
}
