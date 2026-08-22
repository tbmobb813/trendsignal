/**
 * Run with: ANTHROPIC_API_KEY=sk-... npx tsx scripts/test-llm-simplifier.ts
 *
 * This exists because the LLM simplifier could NOT be tested during
 * development — no API key was available in that environment. Run
 * this before trusting lib/query-simplifier-llm.ts in the live
 * pipeline. Compare the output against the "expected" column by eye —
 * there's no automated pass/fail here because "is this a good search
 * phrase" is a judgment call, not a strict equality check.
 */
import { simplifyQueryWithLLM } from '../lib/query-simplifier-llm';

const testCases: { query: string; expectedRoughly: string }[] = [
  { query: 'japanese chisel sharpening', expectedRoughly: 'chisel sharpening' },
  { query: 'custom mechanical keyboard soldering', expectedRoughly: 'keyboard soldering' },
  { query: 'restoring vintage mechanical calculators', expectedRoughly: 'vintage calculator restoration' },
  { query: 'meal prep for night shift nurses', expectedRoughly: 'night shift meal prep' },
  { query: 'cast iron seasoning for beginners', expectedRoughly: 'cast iron seasoning (unchanged concept)' },
  { query: 'budget meal prep', expectedRoughly: 'budget meal prep (already short, unchanged)' },
];

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY is not set. Run with: ANTHROPIC_API_KEY=sk-... npx tsx scripts/test-llm-simplifier.ts');
    process.exit(1);
  }

  for (const { query, expectedRoughly } of testCases) {
    const result = await simplifyQueryWithLLM(query);
    console.log(`"${query}"`);
    console.log(`  -> "${result}"`);
    console.log(`  expected roughly: "${expectedRoughly}"`);
    console.log('');
  }
}

main();
