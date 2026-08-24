import { getSupabaseServerClient } from './supabase-server';

export interface ScoreEvent {
  eventType: 'niche_search' | 'synthesis_requested';
  query: string;
  normalizedQuery: string;
  opportunityScore?: number | null;
  executionScore?: number | null;
  quadrant?: string | null;
  source?: 'cache' | 'live' | null;
  userId?: string | null;
}

/**
 * Best-effort usage/engagement event logging — lightweight groundwork
 * for future outcome validation (see
 * docs/authority-concentration-findings.md Section 15). NOT outcome
 * tracking: this captures usage signals only, never "did the niche
 * succeed."
 *
 * Awaited by callers (not fire-and-forget) despite being best-effort:
 * an un-awaited promise can be killed mid-flight when a serverless
 * function's response is sent, so it may never actually complete.
 * Failures here are caught and logged, never thrown — a logging
 * failure must never break a user-facing response.
 */
export async function logScoreEvent(event: ScoreEvent): Promise<void> {
  try {
    const supabase = getSupabaseServerClient();
    const { error } = await supabase.from('score_events').insert({
      event_type: event.eventType,
      query: event.query,
      normalized_query: event.normalizedQuery,
      opportunity_score: event.opportunityScore ?? null,
      execution_score: event.executionScore ?? null,
      quadrant: event.quadrant ?? null,
      source: event.source ?? null,
      created_by: event.userId ?? null,
    });
    if (error) {
      console.error('Event log write error:', error);
    }
  } catch (err) {
    console.error('Event log write failed:', err);
  }
}
