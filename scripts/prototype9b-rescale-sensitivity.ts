/**
 * Sensitivity check for CONCENTRATION_MIN/MAX (Prototype 9). Same
 * methodology as the DOMINANCE_BUMP sensitivity check: test several
 * candidate (min, max) pairs, holding the weight exactly constant at
 * 25%, and compare synthetic-scenario gaps + real-fixture aggregate
 * behavior across all of them before picking one.
 *
 * Candidates:
 *  - tight (0.04 / 0.20): closely hugs the observed real range
 *    (0.045-0.19) with minimal margin — most aggressive/sensitive.
 *  - prototype9 (0.03 / 0.30): the value already tested, some margin.
 *  - moderate (0.03 / 0.25): less margin on the top end than prototype9.
 *  - wide (0.02 / 0.40): most conservative, most margin before clamping.
 */
import fs from 'fs';
import path from 'path';
import { computeCompetitionScore } from '../lib/scoring/competition';
import { YouTubeNicheRawData, YouTubeChannelStats, YouTubeVideoResult } from '../lib/youtube';

const FIXTURE_DIR = path.join(__dirname, '..', 'test-data');
const WEIGHT_AUTHORITY = 0.35;
const WEIGHT_CONCENTRATION = 0.25;
const WEIGHT_GENERALIST = 0.25;
const WEIGHT_MONETIZATION = 0.15;

interface RangeCandidate { name: string; min: number; max: number; }
const CANDIDATES: RangeCandidate[] = [
  { name: 'tight (0.04/0.20)', min: 0.04, max: 0.20 },
  { name: 'prototype9 (0.03/0.30)', min: 0.03, max: 0.30 },
  { name: 'moderate (0.03/0.25)', min: 0.03, max: 0.25 },
  { name: 'wide (0.02/0.40)', min: 0.02, max: 0.40 },
];

function rescale(raw: number, min: number, max: number): number {
  return Math.max(0, Math.min(1, (raw - min) / (max - min)));
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

function scoreWithRescale(result: ReturnType<typeof computeCompetitionScore>, min: number, max: number): number {
  const rescaled = rescale(result.concentrationPressure, min, max);
  const { matchedByDefault, monetizationPressure } = monetizationInputs(result);
  let pressure: number;
  if (matchedByDefault) {
    const remaining = WEIGHT_AUTHORITY + WEIGHT_CONCENTRATION + WEIGHT_GENERALIST;
    pressure = (WEIGHT_AUTHORITY / remaining) * result.authorityPressure + (WEIGHT_CONCENTRATION / remaining) * rescaled + (WEIGHT_GENERALIST / remaining) * result.generalistAuthorityShare;
  } else {
    pressure = WEIGHT_AUTHORITY * result.authorityPressure + WEIGHT_CONCENTRATION * rescaled + WEIGHT_GENERALIST * result.generalistAuthorityShare + WEIGHT_MONETIZATION * monetizationPressure;
  }
  return Math.round(Math.max(0, Math.min(100, (1 - pressure) * 100)));
}

// ---------- Synthetic scenarios A/B/C ----------
function makeChannel(id: string, subscriberCount: number, videoCount: number, viewsPerVideo: number): YouTubeChannelStats {
  return { channelId: id, title: id, subscriberCount, videoCount, viewCount: Math.round(videoCount * viewsPerVideo), publishedAt: '2021-01-01T00:00:00Z' };
}
function repeatVideos(channelId: string, count: number): YouTubeVideoResult[] {
  return Array.from({ length: count }, (_, i) => ({ videoId: `${channelId}-v${i}`, title: `${channelId} video ${i}`, description: '', channelId, channelTitle: channelId, publishedAt: '2026-01-01T00:00:00Z' }));
}
const QUERY = 'restoring vintage mechanical calculators';

const scenarioAChannels: YouTubeChannelStats[] = [
  makeChannel('A-spec-1', 145_000, 400, 8_000), makeChannel('A-spec-2', 120_000, 350, 7_500), makeChannel('A-spec-3', 90_000, 300, 6_000),
  makeChannel('A-spec-4', 60_000, 250, 5_000), makeChannel('A-spec-5', 40_000, 200, 4_000),
  ...Array.from({ length: 5 }, (_, i) => makeChannel(`A-small-${i}`, 5_000, 40, 1_500)),
];
const scenarioA: YouTubeNicheRawData = {
  query: QUERY, fetchedAt: '2026-08-24T00:00:00Z',
  videos: [...repeatVideos('A-spec-1', 4), ...repeatVideos('A-spec-2', 4), ...repeatVideos('A-spec-3', 4), ...repeatVideos('A-spec-4', 4), ...repeatVideos('A-spec-5', 4), ...Array.from({ length: 5 }, (_, i) => repeatVideos(`A-small-${i}`, 1)).flat()],
  channels: scenarioAChannels,
};
const scenarioBChannels: YouTubeChannelStats[] = [
  makeChannel('B-giant-1', 4_500_000, 900, 40_000), makeChannel('B-giant-2', 2_800_000, 700, 35_000),
  ...Array.from({ length: 19 }, (_, i) => makeChannel(`B-spec-${i}`, 30_000 + i * 2_000, 150, 3_000)),
];
const scenarioB: YouTubeNicheRawData = {
  query: QUERY, fetchedAt: '2026-08-24T00:00:00Z',
  videos: [...repeatVideos('B-giant-1', 3), ...repeatVideos('B-giant-2', 3), ...Array.from({ length: 19 }, (_, i) => repeatVideos(`B-spec-${i}`, 1)).flat()],
  channels: scenarioBChannels,
};
const scenarioCChannels: YouTubeChannelStats[] = [
  makeChannel('C-giant-1', 4_500_000, 900, 40_000), makeChannel('C-giant-2', 2_800_000, 700, 35_000),
  ...Array.from({ length: 5 }, (_, i) => makeChannel(`C-small-${i}`, 5_000, 40, 1_500)),
];
const scenarioC: YouTubeNicheRawData = {
  query: QUERY, fetchedAt: '2026-08-24T00:00:00Z',
  videos: [...repeatVideos('C-giant-1', 10), ...repeatVideos('C-giant-2', 10), ...Array.from({ length: 5 }, (_, i) => repeatVideos(`C-small-${i}`, 1)).flat()],
  channels: scenarioCChannels,
};

const resultA = computeCompetitionScore(scenarioA, [], null);
const resultB = computeCompetitionScore(scenarioB, [], null);
const resultC = computeCompetitionScore(scenarioC, [], null);

console.log('=== Synthetic scenarios across candidate ranges ===');
console.log(`baseline (no rescale): A=${resultA.score} B=${resultB.score} C=${resultC.score}  gaps A-B=${resultA.score - resultB.score} B-C=${resultB.score - resultC.score} A-C=${resultA.score - resultC.score}`);
for (const cand of CANDIDATES) {
  const a = scoreWithRescale(resultA, cand.min, cand.max);
  const b = scoreWithRescale(resultB, cand.min, cand.max);
  const c = scoreWithRescale(resultC, cand.min, cand.max);
  console.log(`${cand.name.padEnd(24)} A=${a}  B=${b}  C=${c}  |  gap A-B=${a - b}  gap B-C=${b - c}  gap A-C=${a - c}`);
}

// ---------- All 22 real fixtures ----------
const files = fs.readdirSync(FIXTURE_DIR).filter((f) => f.endsWith('.json'));
const fixtureResults = files.map((file) => {
  const data: YouTubeNicheRawData = JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, file), 'utf-8'));
  return { file, result: computeCompetitionScore(data, [], null) };
});

console.log('\n=== Real-fixture aggregate stats per candidate range ===');
for (const cand of CANDIDATES) {
  const deltas = fixtureResults.map(({ file, result }) => {
    const newScore = scoreWithRescale(result, cand.min, cand.max);
    return { file, delta: newScore - result.score, rescaled: rescale(result.concentrationPressure, cand.min, cand.max) };
  });
  const meanAbs = deltas.reduce((s, d) => s + Math.abs(d.delta), 0) / deltas.length;
  const positives = deltas.filter((d) => d.delta > 0).length;
  const negatives = deltas.filter((d) => d.delta < 0).length;
  const zeros = deltas.filter((d) => d.delta === 0).length;
  const clampedToZero = deltas.filter((d) => d.rescaled === 0).length;
  const clampedToOne = deltas.filter((d) => d.rescaled === 1).length;
  const maxDelta = Math.min(...deltas.map((d) => d.delta)); // most negative (harshest)
  deltas.sort((x, y) => x.delta - y.delta);
  console.log(
    `\n${cand.name}: mean|delta|=${meanAbs.toFixed(2)}  harsher=${negatives}  lenient=${positives}  unchanged=${zeros}  clampedTo0=${clampedToZero}/22  clampedTo1=${clampedToOne}/22  maxHarshening=${maxDelta}`
  );
  console.log('  harshest 3:', deltas.slice(0, 3).map((d) => `${d.file}(${d.delta})`).join(', '));
}
