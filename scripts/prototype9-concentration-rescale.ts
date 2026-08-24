/**
 * Prototype 9: rescale concentrationPressure instead of reweighting it.
 *
 * Diagnosis (concentration-scale-survey.ts): raw HHI across all 22 real
 * fixtures ranges 0.045-0.190 (mean 0.076) vs authorityPressure's
 * 0.30-0.48 (mean 0.41) — concentration is >5x smaller in typical
 * magnitude, so no weight increase (Prototype 8) can make it
 * meaningfully move scores; it's compressed near zero before the
 * weight is even applied. This mirrors authorityPressure's own
 * original problem (raw median needed log-scale + calibration range,
 * not just a weight change).
 *
 * Candidate: min-max rescale raw HHI against an observed-range-based
 * band, same technique already used for authorityPressure
 * (CONCENTRATION_MIN=0.03, CONCENTRATION_MAX=0.30 — covers the real
 * 0.045-0.19 range with margin, and roughly covers synthetic Scenario
 * C's 0.328, which clamps to 1.0 as an intentional extreme-case ceiling).
 *
 * WEIGHT HELD EXACTLY CONSTANT at the current production value (0.25)
 * — this isolates whether rescaling alone (not reweighting) closes the
 * gap, avoiding the confound that sank the naive Prototype 8 weight
 * shift (uniform softening across all 22 fixtures, no exceptions).
 */
import fs from 'fs';
import path from 'path';
import { computeCompetitionScore } from '../lib/scoring/competition';
import { YouTubeNicheRawData, YouTubeChannelStats, YouTubeVideoResult } from '../lib/youtube';

const FIXTURE_DIR = path.join(__dirname, '..', 'test-data');
const WEIGHT_AUTHORITY = 0.35;
const WEIGHT_CONCENTRATION = 0.25; // held constant — same as production
const WEIGHT_GENERALIST = 0.25;
const WEIGHT_MONETIZATION = 0.15;
const CONCENTRATION_MIN = 0.03;
const CONCENTRATION_MAX = 0.30;

function rescaleConcentration(raw: number): number {
  return Math.max(0, Math.min(1, (raw - CONCENTRATION_MIN) / (CONCENTRATION_MAX - CONCENTRATION_MIN)));
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

function scoreWithRescaledConcentration(result: ReturnType<typeof computeCompetitionScore>): number {
  const rescaled = rescaleConcentration(result.concentrationPressure);
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

console.log('=== Synthetic scenarios: raw vs rescaled concentration (weight held at 25%) ===');
for (const [label, data] of [['A', scenarioA], ['B', scenarioB], ['C', scenarioC]] as const) {
  const result = computeCompetitionScore(data, [], null);
  const newScore = scoreWithRescaledConcentration(result);
  console.log(`Scenario ${label}: raw concentration=${result.concentrationPressure.toFixed(4)} -> rescaled=${rescaleConcentration(result.concentrationPressure).toFixed(4)}, score ${result.score} -> ${newScore}`);
}

const resultA = computeCompetitionScore(scenarioA, [], null);
const resultB = computeCompetitionScore(scenarioB, [], null);
const resultC = computeCompetitionScore(scenarioC, [], null);
const newA = scoreWithRescaledConcentration(resultA);
const newB = scoreWithRescaledConcentration(resultB);
const newC = scoreWithRescaledConcentration(resultC);
console.log(`\nGaps -- current: A-B=${resultA.score - resultB.score} A-C=${resultA.score - resultC.score} B-C=${resultB.score - resultC.score}`);
console.log(`Gaps -- rescaled: A-B=${newA - newB} A-C=${newA - newC} B-C=${newB - newC}`);

// ---------- All 22 real fixtures ----------
const files = fs.readdirSync(FIXTURE_DIR).filter((f) => f.endsWith('.json'));
const deltas = files.map((file) => {
  const data: YouTubeNicheRawData = JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, file), 'utf-8'));
  const result = computeCompetitionScore(data, [], null);
  const newScore = scoreWithRescaledConcentration(result);
  return { file, oldScore: result.score, newScore, delta: newScore - result.score };
});
deltas.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
console.log('\n=== All 22 real fixtures, rescaled concentration (weight unchanged at 25%) ===');
deltas.forEach((d) => console.log(`  ${d.file.padEnd(45)} ${d.oldScore} -> ${d.newScore}  (${d.delta > 0 ? '+' : ''}${d.delta})`));
console.log('\nMean |delta|:', (deltas.reduce((s, d) => s + Math.abs(d.delta), 0) / deltas.length).toFixed(2));
console.log('Positive deltas (more lenient):', deltas.filter((d) => d.delta > 0).length);
console.log('Negative deltas (harsher):', deltas.filter((d) => d.delta < 0).length);
console.log('Zero deltas:', deltas.filter((d) => d.delta === 0).length);
