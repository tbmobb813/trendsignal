/**
 * Prototype 5: specialist-only median authority pressure, mass-weighted
 * but with each channel's weight CAPPED at a fraction of total specialist
 * subscriber mass before computing the weighted-median crossing point.
 *
 * Motivation (see docs/authority-concentration-findings.md Section 8):
 * Prototype 4 (uncapped mass-weighting) correctly fixed filler-dilution
 * and generalist-redundancy, but is still fully sensitive to a SINGLE
 * dominant specialist channel holding a large fraction of a thin niche's
 * subscriber mass (e.g. "restoring vintage mechanical calculators":
 * CuriousMarc alone holds 59% of specialist mass, and the weighted
 * median lands exactly on him, pushing authorityPressure from 0.164 to
 * 0.508 — a 14-point score swing on a field with zero generalists).
 *
 * This prototype caps any single channel's weight contribution at
 * `capFraction` of total mass, so no one channel can single-handedly
 * define the median the way an uncapped weighted median allows once a
 * channel crosses 50% of total mass alone.
 *
 * Tests three cap fractions (0.25 / 0.35 / 0.5) against:
 *  (a) the two real fixtures that exposed the problem
 *      (restoring-vintage-mechanical-calculators, home-espresso-setup)
 *  (b) the flagship redundancy fixture (how-to-invest-for-beginners) to
 *      confirm the original fix still holds
 *  (c) all 22 real fixtures, aggregate stats
 *  (d) synthetic scenarios A/B/C to confirm no regression on the
 *      original investigation
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

function cappedWeightedMedianSubs(subCounts: number[], capFraction: number): number {
  if (subCounts.length === 0) return 0;
  const totalMass = subCounts.reduce((s, v) => s + v, 0);
  const cap = capFraction * totalMass;
  const pairs = subCounts.map((v) => ({ value: v, weight: Math.min(v, cap) })).sort((a, b) => a.value - b.value);
  const totalWeight = pairs.reduce((s, p) => s + p.weight, 0);
  const half = totalWeight / 2;
  let cumulative = 0;
  for (const p of pairs) {
    cumulative += p.weight;
    if (cumulative >= half) return p.value;
  }
  return pairs[pairs.length - 1].value;
}

function authorityPressureFromMedian(medianSubs: number): number {
  const medianLogSubs = medianSubs > 0 ? Math.log10(medianSubs) : 3;
  return Math.max(0, Math.min(1, (medianLogSubs - CALIBRATION_MIN) / (CALIBRATION_MAX - CALIBRATION_MIN)));
}

function recomputeScore(
  authorityPressure: number,
  concentrationPressure: number,
  generalistAuthorityShare: number,
  monetizationPressure: number,
  monetizationMatchedByDefault: boolean
): number {
  let pressure: number;
  if (monetizationMatchedByDefault) {
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
  return Math.round(Math.max(0, Math.min(100, (1 - pressure) * 100)));
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

function monetizationInputs(result: ReturnType<typeof computeCompetitionScore>) {
  const matchedByDefault = result.notes.some((n) => n.includes('No specific monetization category matched'));
  let monetizationPressure = 0;
  if (!matchedByDefault) {
    const basePressure = 1 - result.score / 100;
    monetizationPressure =
      (basePressure -
        WEIGHT_AUTHORITY * result.authorityPressure -
        WEIGHT_CONCENTRATION * result.concentrationPressure -
        WEIGHT_GENERALIST * result.generalistAuthorityShare) /
      WEIGHT_MONETIZATION;
  }
  return { matchedByDefault, monetizationPressure };
}

function scoreWithCap(result: ReturnType<typeof computeCompetitionScore>, capFraction: number): number {
  const basis = specialistBasis(result);
  const capped = cappedWeightedMedianSubs(basis, capFraction);
  const newAuthority = authorityPressureFromMedian(capped);
  const { matchedByDefault, monetizationPressure } = monetizationInputs(result);
  return recomputeScore(newAuthority, result.concentrationPressure, result.generalistAuthorityShare, monetizationPressure, matchedByDefault);
}

// ---------- (a) + (b): the three key real fixtures ----------
const KEY_FIXTURES = ['restoring-vintage-mechanical-calculators.json', 'home-espresso-setup.json', 'how-to-invest-for-beginners.json'];
const CAP_FRACTIONS = [0.25, 0.35, 0.5];

console.log('=== Key fixtures across cap fractions ===');
for (const file of KEY_FIXTURES) {
  const data: YouTubeNicheRawData = JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, file), 'utf-8'));
  const result = computeCompetitionScore(data, [], null);
  const basis = specialistBasis(result);
  console.log(`\n${file} (baseline score ${result.score}, baseline authorityPressure ${result.authorityPressure.toFixed(3)})`);
  console.log('  specialist basis subs (desc):', [...basis].sort((a, b) => b - a).map((n) => n.toLocaleString()));
  for (const cap of CAP_FRACTIONS) {
    const cappedMedian = cappedWeightedMedianSubs(basis, cap);
    const newAuthority = authorityPressureFromMedian(cappedMedian);
    const newScore = scoreWithCap(result, cap);
    console.log(
      `  cap=${cap}: median subs=${Math.round(cappedMedian).toLocaleString()}, authorityPressure->${newAuthority.toFixed(3)}, score->${newScore} (delta ${newScore - result.score})`
    );
  }
}

// ---------- (c): all 22 fixtures, aggregate, at cap=0.35 ----------
const CHOSEN_CAP = 0.35;
const files = fs.readdirSync(FIXTURE_DIR).filter((f) => f.endsWith('.json'));
const deltas: { file: string; delta: number }[] = [];
for (const file of files) {
  const data: YouTubeNicheRawData = JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, file), 'utf-8'));
  const result = computeCompetitionScore(data, [], null);
  const newScore = scoreWithCap(result, CHOSEN_CAP);
  deltas.push({ file, delta: newScore - result.score });
}
deltas.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
console.log(`\n=== All 22 fixtures at cap=${CHOSEN_CAP} (sorted by |delta|) ===`);
deltas.forEach((d) => console.log(`  ${d.file.padEnd(45)} delta=${d.delta > 0 ? '+' : ''}${d.delta}`));
console.log('\nMean |delta|:', (deltas.reduce((s, d) => s + Math.abs(d.delta), 0) / deltas.length).toFixed(2));
console.log('Max delta:', Math.max(...deltas.map((d) => d.delta)), ' Min delta:', Math.min(...deltas.map((d) => d.delta)));

// ---------- (d): synthetic scenarios A/B/C regression check, cap=0.35 ----------
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

console.log(`\n=== Synthetic scenario regression check, cap=${CHOSEN_CAP} ===`);
for (const [label, data] of [['A', scenarioA], ['B', scenarioB], ['C', scenarioC]] as const) {
  const result = computeCompetitionScore(data, [], null);
  const newScore = scoreWithCap(result, CHOSEN_CAP);
  console.log(`  Scenario ${label}: baseline=${result.score}, prototype4(uncapped)=?, capped(${CHOSEN_CAP})=${newScore}`);
}
