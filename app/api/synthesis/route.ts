import { NextRequest, NextResponse } from 'next/server';
import { fetchExecutiveSynthesis, SynthesisInput } from '@/lib/synthesis-llm';
import { isRateLimited } from '@/lib/rate-limiter';
import { logScoreEvent } from '@/lib/event-logger';

/**
 * POST /api/synthesis
 *
 * Generates an executive summary and 2-week pilot video blueprint on-demand.
 * Keeping this separate from /api/niche prevents API blockages and keeps search speeds fast.
 */
import { z } from 'zod';

const synthesisInputSchema = z.object({
  query: z.string().min(1, 'Missing query parameter.').max(100),
  opportunityScore: z.number().min(0).max(100),
  executionScore: z.number().min(0).max(100),
  quadrant: z.string().default('N/A'),
  rpmRange: z.string().default('N/A'),
  lifecycle: z.string().default('N/A'),
  formatFit: z.string().default('N/A'),
  automation: z.string().default('N/A'),
  safety: z.string().default('N/A'),
  copyright: z.string().default('N/A'),
});

/**
 * POST /api/synthesis
 *
 * Generates an executive summary and 2-week pilot video blueprint on-demand.
 * Keeping this separate from /api/niche prevents API blockages and keeps search speeds fast.
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
  if (await isRateLimited(ip)) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait a minute before scanning again.' },
      { status: 429 }
    );
  }

  try {
    const rawInput = await req.json();
    const resultValidation = synthesisInputSchema.safeParse(rawInput);
    if (!resultValidation.success) {
      return NextResponse.json(
        { error: 'Invalid synthesis input: ' + resultValidation.error.message },
        { status: 400 }
      );
    }

    const input = resultValidation.data;

    const result = await fetchExecutiveSynthesis(input);

    // Strongest "user engaged with this score" signal available
    // pre-launch — see lib/event-logger.ts.
    await logScoreEvent({
      eventType: 'synthesis_requested',
      query: input.query,
      normalizedQuery: input.query.trim().toLowerCase().replace(/\s+/g, ' '),
      opportunityScore: input.opportunityScore,
      executionScore: input.executionScore,
      quadrant: input.quadrant,
    });

    return NextResponse.json(result);
  } catch (err: unknown) {
    console.error('Executive synthesis API error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
