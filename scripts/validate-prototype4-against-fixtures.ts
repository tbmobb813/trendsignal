/**
 * Validates Prototype 4 (specialist-only, mass-weighted median authority
 * pressure — see docs/authority-concentration-findings.md Section 4) against
 * every REAL captured fixture in test-data/, not just synthetic scenarios.
 *
 * For each fixture: run the real computeCompetitionScore() for the baseline
 * score, then recompute authorityPressure using the Prototype 4 definition
 * and see what the resulting score would have been. Reports every fixture,
 * flags fixtures where Prototype 4 hits the no-specialists-left fallback
 * path (untested in the synthetic scenarios), and flags any large swings
 * for manual sanity-checking against the fixture's actual query.
 */
import fs from 'fs';
import path from 'path';
import { computeCompetitionScore } from '../lib/scoring/competition';
import { YouTubeNicheRawData } from '../lib/youtube';

const FIXTURE_DIR = path.join(__dirname, '..', 'test-data');
const CALIBRATION_MIN = 3.0;
const CALIBRATION_MAX = 7.7;
const WEIGHT_AUTHORITY = 0.35;
const WEIGHT_CONCENTRATION = 0.25;
const WEIGHT_GENERALIST = 0.25;
const WEIGHT_MONETIZATION = 0.15;

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

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

function authorityPressureFromMedian(medianSubs: number): number {
  const medianLogSubs = medianSubs > 0 ? Math.log10(medianSubs) : 3;
  return Math.max(0, Math.min(1, (medianLogSubs - CALIBRATION_MIN) / (CALIBRATION_MAX - CALIBRATION_MIN)));
}

// Mirrors the REAL monetization-default weight redistribution in
// competition.ts so the recomputed score is directly comparable to the
// baseline score (same redistribution logic, only authorityPressure input
// swapped for the Prototype 4 value).
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

const files = fs.readdirSync(FIXTURE_DIR).filter((f) => f.endsWith('.json'));

interface RowResult {
  file: string;
  query: string;
  meaningfulCount: number;
  specialistCount: number;
  usedFallback: boolean;
  baselineAuthority: number;
  p4Authority: number;
  baselineScore: number;
  p4Score: number;
  delta: number;
}

const rows: RowResult[] = [];

for (const file of files) {
  const raw = fs.readFileSync(path.join(FIXTURE_DIR, file), 'utf-8');
  const data: YouTubeNicheRawData = JSON.parse(raw);

  const result = computeCompetitionScore(data, [], null);

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
  const p4Authority = authorityPressureFromMedian(weightedMedian);

  // Determine whether this query's monetization matched a real category or
  // hit the default fallback, purely from the baseline notes (the real
  // function doesn't expose monetizationRes directly) — every fixture's
  // notes array says so verbatim when it's a default match.
  const monetizationMatchedByDefault = result.notes.some((n) => n.includes('No specific monetization category matched'));

  // We don't have direct access to monetizationPressure here without
  // reimplementing getMonetizationBenchmark; for fixtures with a real
  // category match, back it out algebraically from the baseline score,
  // since baseline score is already the ground truth for the OTHER three
  // inputs (authority/concentration/generalist), which we have directly.
  let monetizationPressure = 0;
  if (!monetizationMatchedByDefault) {
    const basePressure = 1 - result.score / 100;
    // baseline pressure = 0.35*auth + 0.25*conc + 0.25*gen + 0.15*monet
    // solve for monet:
    monetizationPressure =
      (basePressure -
        WEIGHT_AUTHORITY * result.authorityPressure -
        WEIGHT_CONCENTRATION * result.concentrationPressure -
        WEIGHT_GENERALIST * result.generalistAuthorityShare) /
      WEIGHT_MONETIZATION;
  }

  const p4Score = recomputeScore(
    p4Authority,
    result.concentrationPressure,
    result.generalistAuthorityShare,
    monetizationPressure,
    monetizationMatchedByDefault
  );

  rows.push({
    file,
    query: data.query,
    meaningfulCount: allMeaningfulSubCounts.length,
    specialistCount: specialistSubCounts.length,
    usedFallback,
    baselineAuthority: result.authorityPressure,
    p4Authority,
    baselineScore: result.score,
    p4Score,
    delta: p4Score - result.score,
  });
}

rows.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

console.log(
  'file'.padEnd(42),
  'meaningful/spec'.padEnd(16),
  'fallback'.padEnd(9),
  'authPress old->new'.padEnd(20),
  'score old->new'.padEnd(16),
  'delta'
);
for (const r of rows) {
  console.log(
    r.file.padEnd(42),
    `${r.meaningfulCount}/${r.specialistCount}`.padEnd(16),
    String(r.usedFallback).padEnd(9),
    `${r.baselineAuthority.toFixed(3)}->${r.p4Authority.toFixed(3)}`.padEnd(20),
    `${r.baselineScore}->${r.p4Score}`.padEnd(16),
    r.delta > 0 ? `+${r.delta}` : `${r.delta}`
  );
}

const fallbackRows = rows.filter((r) => r.usedFallback);
const bigSwings = rows.filter((r) => Math.abs(r.delta) >= 10);

console.log('\n=== SUMMARY ===');
console.log('Total fixtures:', rows.length);
console.log('Fixtures hitting no-specialists-left fallback:', fallbackRows.length, fallbackRows.map((r) => r.file));
console.log('Fixtures with |delta| >= 10:', bigSwings.length, bigSwings.map((r) => `${r.file} (${r.delta})`));
console.log('Mean |delta|:', (rows.reduce((s, r) => s + Math.abs(r.delta), 0) / rows.length).toFixed(2));
console.log('Max delta:', Math.max(...rows.map((r) => r.delta)), ' Min delta:', Math.min(...rows.map((r) => r.delta)));
