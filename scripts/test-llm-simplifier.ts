/**
 * Run with either or both keys set:
 *   ANTHROPIC_API_KEY=sk-ant-... npx tsx scripts/test-llm-simplifier.ts
 *   OPENROUTER_API_KEY=sk-or-... npx tsx scripts/test-llm-simplifier.ts
 *   ANTHROPIC_API_KEY=... OPENROUTER_API_KEY=... npx tsx scripts/test-llm-simplifier.ts
 *
 * With both set, Anthropic is tried first by default (see
 * lib/query-simplifier-llm.ts getProviderOrder) — the console output
 * will show which provider actually served each result, so you can
 * confirm the fallback chain is working, not just that SOME result
 * came back.
 *
 * This exists because the LLM simplifier could NOT be tested during
 * development — no working API key was available in that
 * environment. Compare output against "expected" by eye — there's no
 * automated pass/fail since "is this a good search phrase" is a
 * judgment call, not strict equality.
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
  if (!process.env.ANTHROPIC_API_KEY && !process.env.OPENROUTER_API_KEY) {
    console.error('Neither ANTHROPIC_API_KEY nor OPENROUTER_API_KEY is set. Set at least one.');
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