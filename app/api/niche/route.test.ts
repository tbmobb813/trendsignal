import { expect, test, vi } from 'vitest';
import { GET } from './route';
import { NextRequest } from 'next/server';

vi.mock('@/lib/rate-limiter', () => ({
  isRateLimited: vi.fn().mockResolvedValue(false),
}));

vi.mock('@/lib/supabase-server', () => {
  const queryMock = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    insert: vi.fn().mockResolvedValue({ error: null }),
  };

  return {
    getSupabaseServerClient: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue(queryMock),
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) }
    }),
  };
});

vi.mock('@/lib/youtube', () => {
  const budgetFixture = require('../../../test-data/budget-meal-prep.json');
  return {
    fetchYouTubeNicheData: vi.fn().mockResolvedValue({
      query: budgetFixture.query,
      fetchedAt: new Date().toISOString(),
      videos: budgetFixture.videos,
      channels: budgetFixture.channels,
    }),
  };
});

vi.mock('@/lib/trends', () => {
  const budgetFixture = require('../../../test-data/budget-meal-prep.json');
  return {
    fetchTrendsData: vi.fn().mockResolvedValue(budgetFixture.trends),
  };
});

vi.mock('@/lib/query-simplifier-llm', () => ({
  simplifyQueryWithLLM: vi.fn().mockImplementation((q) => Promise.resolve(q)),
}));

test('GET /api/niche fetches niche opportunity metrics successfully', async () => {
  const req = new NextRequest('http://localhost:3000/api/niche?q=budget%20meal%20prep');
  const res = await GET(req);

  expect(res.status).toBe(200);
  const json = await res.json();
  
  expect(json.simplifiedQuery).toBe('budget meal prep');
  expect(json.scoreResult.score).toBeGreaterThan(0);
  expect(json.videos.length).toBeGreaterThan(0);
  expect(json.scoreResult.channels.length).toBeGreaterThan(0);
});
