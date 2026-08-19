/**
 * Run with: npx tsx scripts/test-scoring.ts
 * (npm install -D tsx if you don't have it)
 *
 * Loads all five real fixture datasets and runs the competition
 * scoring engine against each — once in isolation (no cross-query
 * history) and once with the OTHER four datasets passed in as
 * history, so you can see the generalist-detection logic actually
 * fire on real recurring channels (Jeff Nippard, Noel Deyzel, etc.)
 * instead of guessing whether it works.
 */
import fs from 'fs';
import path from 'path';
import { computeCompetitionScore } from '../lib/scoring/competition';
import { YouTubeNicheRawData } from '../lib/youtube';

const FIXTURE_DIR = path.join(__dirname, '..', 'test-data');

function loadFixture(filename: string): YouTubeNicheRawData {
  const raw = fs.readFileSync(path.join(FIXTURE_DIR, filename), 'utf-8');
  return JSON.parse(raw);
}

const fixtures = [
  loadFixture('budget-meal-prep.json'),
  loadFixture('one-person.json'),
  loadFixture('night-shift.json'),
  loadFixture('money.json'),
  loadFixture('morning-routine.json'),
];

for (const fixture of fixtures) {
  const otherFixtures = fixtures.filter((f) => f.query !== fixture.query);

  console.log('\n' + '='.repeat(70));
  console.log(`QUERY: "${fixture.query}"`);
  console.log('='.repeat(70));

  const result = computeCompetitionScore(fixture, otherFixtures);

  console.log(`Raw competitor count:        ${result.rawCompetitorCount}`);
  console.log(`Meaningful (non-thin) count: ${result.meaningfulCompetitorCount}`);
  console.log(`Specialist count:            ${result.specialistCompetitorCount}`);
  console.log(`Generalist dip-in gap:       ${result.generalistDipInGap}`);
  console.log(`Median specialist output:    ${result.medianVideoCount} videos`);
  console.log(`Opportunity score (0-100):   ${result.score}`);

  if (result.notes.length > 0) {
    console.log('Notes:');
    result.notes.forEach((n) => console.log(`  - ${n}`));
  }

  const generalists = result.channels.filter((c) => c.isGeneralistSuspected);
  if (generalists.length > 0) {
    console.log('Flagged as generalist-suspected:');
    generalists.forEach((c) =>
      console.log(
        `  - ${c.title} (${c.crossQueryAppearances} cross-query appearances, ${c.subscriberCount ?? 'hidden'} subs)`
      )
    );
  }

  const outliers = result.channels.filter((c) => c.isViralOutlier);
  if (outliers.length > 0) {
    console.log('Flagged as viral outliers:');
    outliers.forEach((c) =>
      console.log(`  - ${c.title} (${Math.round(c.viewsPerVideo).toLocaleString()} views/video)`)
    );
  }
}
