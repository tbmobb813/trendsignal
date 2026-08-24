import fs from 'fs';
import path from 'path';
import { computeCompetitionScore } from '../lib/scoring/competition';
import { YouTubeNicheRawData } from '../lib/youtube';

const file = process.argv[2];
const data: YouTubeNicheRawData = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'test-data', file), 'utf-8'));
const result = computeCompetitionScore(data, [], null);

console.log('query:', data.query);
console.log('score:', result.score, 'authorityPressure:', result.authorityPressure.toFixed(3), 'generalistShare:', result.generalistAuthorityShare.toFixed(3));
console.log('\nmeaningful channels (sub count, thin, generalist):');
result.channels
  .filter((c) => !c.isThin)
  .sort((a, b) => (b.subscriberCount ?? 0) - (a.subscriberCount ?? 0))
  .forEach((c) => console.log(`  ${c.title.padEnd(35)} subs=${(c.subscriberCount ?? 0).toLocaleString().padEnd(12)} generalist=${c.isGeneralistSuspected} crossQueryAppearances=${c.crossQueryAppearances}`));
