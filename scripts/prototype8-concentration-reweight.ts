/**
 * Prototype 8: concentration-reweighting candidates.
 *
 * The original question (docs/authority-concentration-findings.md
 * Section 2): with weights Authority 35 / Concentration 25 / Generalist
 * 25 / Monetization 15, concentration pressure — the only metric
 * measuring ACTUAL, CURRENT SERP occupancy rather than a proxy for why
 * a channel might dominate — contributes the least to score differences
 * between "volume concentration" (Scenario A) and "reach concentration"
 * (Scenario B) niches. Confirmed again just now against the SHIPPED
 * authority-pressure fix: A=85, B=57, C=55 — gaps 28/30/2, effectively
 * unchanged from before the fix (that change was orthogonal).
 *
 * This script re-weights the EXISTING pressure components (does not
 * change how authorityPressure/concentrationPressure/generalistShare
 * are computed — those are already final) across three candidate
 * schemes, checked against:
 *  (a) synthetic scenarios A/B/C — does the gap actually close?
 *  (b) all 22 real fixtures — aggregate mean |delta| vs current, to
 *      catch unintended over-harshening/softening across the board.
 */
import fs from 'fs';
import path from 'path';
import { computeCompetitionScore } from '../lib/scoring/competition';
import { YouTubeNicheRawData, YouTubeChannelStats, YouTubeVideoResult } from '../lib/youtube';

const FIXTURE_DIR = path.join(__dirname, '..', 'test-data');

interface WeightScheme {
  name: string;
  authority: number;
  concentration: number;
  generalist: number;
  monetization: number;
}

const SCHEMES: WeightScheme[] = [
  { name: 'current (35/25/25/15)', authority: 0.35, concentration: 0.25, generalist: 0.25, monetization: 0.15 },
  { name: 'candidate 1 (30/30/25/15)', authority: 0.30, concentration: 0.30, generalist: 0.25, monetization: 0.15 },
  { name: 'candidate 2 (25/35/25/15)', authority: 0.25, concentration: 0.35, generalist: 0.25, monetization: 0.15 },
  { name: 'candidate 3 (28/32/22/18)', authority: 0.28, concentration: 0.32, generalist: 0.22, monetization: 0.18 },
];
// Average of the 4 schemes above (including current), component-wise —
// tests whether "just average the candidates" produces something new,
// or is simply another point on the same line the candidates already
// traced (in which case it should inherit the same failure mode).
const avgOf = (key: keyof WeightScheme) =>
  SCHEMES.reduce((s, sch) => s + (sch[key] as number), 0) / SCHEMES.length;
SCHEMES.push({
  name: `averaged (${(avgOf('authority') * 100).toFixed(1)}/${(avgOf('concentration') * 100).toFixed(1)}/${(avgOf('generalist') * 100).toFixed(1)}/${(avgOf('monetization') * 100).toFixed(1)})`,
  authority: avgOf('authority'),
  concentration: avgOf('concentration'),
  generalist: avgOf('generalist'),
  monetization: avgOf('monetization'),
});

function monetizationInputs(result: ReturnType<typeof computeCompetitionScore>) {
  const matchedByDefault = result.notes.some((n) => n.includes('No specific monetization category matched'));
  let monetizationPressure = 0;
  if (!matchedByDefault) {
    // back out using the REAL production weights (35/25/25/15), since
    // that's what actually produced result.score
    const basePressure = 1 - result.score / 100;
    monetizationPressure =
      (basePressure - 0.35 * result.authorityPressure - 0.25 * result.concentrationPressure - 0.25 * result.generalistAuthorityShare) / 0.15;
  }
  return { matchedByDefault, monetizationPressure };
}

function scoreUnderScheme(result: ReturnType<typeof computeCompetitionScore>, scheme: WeightScheme): number {
  const { matchedByDefault, monetizationPressure } = monetizationInputs(result);
  let pressure: number;
  if (matchedByDefault) {
    const remaining = scheme.authority + scheme.concentration + scheme.generalist;
    pressure =
      (scheme.authority / remaining) * result.authorityPressure +
      (scheme.concentration / remaining) * result.concentrationPressure +
      (scheme.generalist / remaining) * result.generalistAuthorityShare;
  } else {
    pressure =
      scheme.authority * result.authorityPressure +
      scheme.concentration * result.concentrationPressure +
      scheme.generalist * result.generalistAuthorityShare +
      scheme.monetization * monetizationPressure;
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

console.log('=== Synthetic scenarios under each weight scheme ===');
for (const scheme of SCHEMES) {
  const a = scoreUnderScheme(resultA, scheme);
  const b = scoreUnderScheme(resultB, scheme);
  const c = scoreUnderScheme(resultC, scheme);
  console.log(`${scheme.name.padEnd(28)} A=${a}  B=${b}  C=${c}  |  gap A-B=${a - b}  gap A-C=${a - c}  gap B-C=${b - c}`);
}

// ---------- All 22 real fixtures ----------
const files = fs.readdirSync(FIXTURE_DIR).filter((f) => f.endsWith('.json'));
const fixtureResults = files.map((file) => {
  const data: YouTubeNicheRawData = JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, file), 'utf-8'));
  return { file, result: computeCompetitionScore(data, [], null) };
});

console.log('\n=== Aggregate stats across 22 real fixtures, vs current (35/25/25/15) ===');
for (const scheme of SCHEMES.slice(1)) {
  const deltas = fixtureResults.map(({ file, result }) => {
    const newScore = scoreUnderScheme(result, scheme);
    return { file, delta: newScore - result.score };
  });
  deltas.sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta));
  const meanAbs = deltas.reduce((s, d) => s + Math.abs(d.delta), 0) / deltas.length;
  console.log(`\n${scheme.name}: mean |delta|=${meanAbs.toFixed(2)}, max=${Math.max(...deltas.map((d) => d.delta))}, min=${Math.min(...deltas.map((d) => d.delta))}`);
  console.log('  top 5 by |delta|:', deltas.slice(0, 5).map((d) => `${d.file}(${d.delta > 0 ? '+' : ''}${d.delta})`).join(', '));
}
