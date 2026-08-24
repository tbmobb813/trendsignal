import { expect, test, vi } from 'vitest';
import { POST } from './route';
import { NextRequest } from 'next/server';

vi.mock('@/lib/rate-limiter', () => ({
  isRateLimited: vi.fn().mockResolvedValue(false),
}));

vi.mock('@/lib/synthesis-llm', () => ({
  fetchExecutiveSynthesis: vi.fn().mockResolvedValue({
    executiveSummary: [
      'Low barrier to entry with digital setups.',
      'Strong monetization options from sponsorships.'
    ],
    pilotVideoBlueprint: {
      concept: 'Create a 10-minute guide to local coding tools.',
      titleIdeas: ['Build Local AI Apps in 5 Mins', 'Local weights are the future'],
      outline: ['Hook: Why run locally', 'Setup guide', 'Outro'],
      productionStrategy: 'Digital capture using screen recorders'
    }
  }),
}));

test('POST /api/synthesis returns executive synthesis recommendations successfully', async () => {
  const payload = {
    query: 'local ai coding',
    opportunityScore: 78,
    executionScore: 82,
    quadrant: 'High Opportunity / High Fit',
    rpmRange: '$15 - $25',
    lifecycle: 'Accelerating Growth',
    formatFit: 'Long-Form Favored',
    automation: 'High Faceless Potential',
    safety: 'Premium Ad Eligible',
    copyright: '100% Original Footage'
  };

  const req = new NextRequest('http://localhost:3000/api/synthesis', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const res = await POST(req);
  expect(res.status).toBe(200);

  const json = await res.json();
  expect(json.executiveSummary.length).toBe(2);
  expect(json.pilotVideoBlueprint.titleIdeas[0]).toBe('Build Local AI Apps in 5 Mins');
});
