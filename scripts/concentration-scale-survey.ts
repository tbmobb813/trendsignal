/**
 * Survey concentrationPressure's actual observed range across all real
 * fixtures + the synthetic scenarios, to test the hypothesis from
 * Prototype 8: reweighting failed to move scores meaningfully because
 * concentration pressure (raw HHI) is small in magnitude across nearly
 * all real data, so even a bigger weight multiplier can't produce a
 * large score swing — the signal itself may need rescaling (like
 * authority pressure's log+calibration-range treatment), not a bigger
 * weight.
 */
import fs from 'fs';
import path from 'path';
import { computeCompetitionScore } from '../lib/scoring/competition';
import { YouTubeNicheRawData } from '../lib/youtube';

const FIXTURE_DIR = path.join(__dirname, '..', 'test-data');
const files = fs.readdirSync(FIXTURE_DIR).filter((f) => f.endsWith('.json'));

const rows = files.map((file) => {
  const data: YouTubeNicheRawData = JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, file), 'utf-8'));
  const result = computeCompetitionScore(data, [], null);
  return { file, concentration: result.concentrationPressure, authority: result.authorityPressure, generalist: result.generalistAuthorityShare };
});

rows.sort((a, b) => a.concentration - b.concentration);
console.log('=== concentrationPressure across all 22 real fixtures (sorted) ===');
rows.forEach((r) => console.log(`  ${r.file.padEnd(45)} concentration=${r.concentration.toFixed(4)}  authority=${r.authority.toFixed(3)}  generalist=${r.generalist.toFixed(3)}`));

const concVals = rows.map((r) => r.concentration);
const authVals = rows.map((r) => r.authority);
const genVals = rows.map((r) => r.generalist);
function stats(vals: number[]) {
  const sorted = [...vals].sort((a, b) => a - b);
  const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
  const median = sorted[Math.floor(sorted.length / 2)];
  return { min: sorted[0], max: sorted[sorted.length - 1], mean, median };
}
console.log('\n=== Summary stats ===');
console.log('concentrationPressure:', stats(concVals));
console.log('authorityPressure:    ', stats(authVals));
console.log('generalistAuthorityShare:', stats(genVals));

// How much of the theoretical [0,1] range does concentration actually use?
const concRange = Math.max(...concVals) - Math.min(...concVals);
const authRange = Math.max(...authVals) - Math.min(...authVals);
console.log(`\nconcentration observed range: ${concRange.toFixed(4)} (of theoretical 1.0)`);
console.log(`authority observed range:     ${authRange.toFixed(4)} (of theoretical 1.0)`);
