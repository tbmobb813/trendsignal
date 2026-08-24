# TrendSignal — YouTube Niche Explorer

TrendSignal is a data-driven tool for discovering and evaluating YouTube niches. It combines live YouTube Data API v3 results, Google Trends demand signals, and a set of derived market/creator-fit metrics into a single **Opportunity Score (0–100)** — plus a companion **Execution Fit** score and an AI-generated pilot video blueprint.

---

## How It Works

```
[ User Query ]
      │
      ├───► YouTube search.list (Original Query) ──► Competitor Channel Stats
      │
      └───► LLM / Heuristic Simplification ──► Google Trends (0-100 Interest + Related Queries)
                                                     │
                                              [ Scoring Engine ]
                                                     │
                                    Opportunity Score + Signal Cards + Synthesis
```

### 1. The Opportunity Score Formula

The core competition score is a weighted composite of four pressures (higher pressure = lower score = harder niche):

- **Authority Pressure (35%)** — how large the median competitor channel is, log-scaled. A field of smaller channels means a lower barrier to entry. The comparison range can adaptively recalibrate against your own accumulated query history once 5+ queries are cached — this recalibration is a newer addition and hasn't been independently validated, so treat it as directional.
- **Concentration Pressure (25%)** — Herfindahl-Hirschman Index on search-result occupancy. High concentration means a handful of channels systematically own the top rankings for this exact query (e.g. recurring monthly "best GPU" refresh videos), which is harder to break into than the same competitor count spread across more unique channels.
- **Generalist Authority Share (25%)** — the *subscriber mass* (not headcount) held by channels flagged as generalists dipping into the niche rather than owning it. This is what catches cases like "how to invest for beginners," where only a few generalist channels appear but they dominate total reach.
- **Monetization Pressure (15%)** — inverse of a category-based RPM/CPM benchmark lookup (see caveat below).

### 2. The Demand Floor

Google Trends coverage over the trailing 24 months gates the final score:
- **< 20% coverage** → score multiplied by 0.3 (a niche with virtually no search interest is a bad opportunity even with zero competition)
- **20–50% coverage** → score multiplied by 0.7
- **Trends fetch suspected to have failed** (near-zero data across the *entire* multi-year history, which is a much stronger signal of a blocked/rate-limited request than of genuine zero demand) → **no penalty applied**, and the score is flagged as unverified on the demand side rather than punished for a request failure

### 3. Signal Cards

Beyond the core score, each search surfaces additional derived signals: monetization RPM tier, format fit (Shorts vs. long-form), SERP upload freshness, audience engagement/loyalty, revenue-stream diversity, copyright/Content ID risk, advertiser-safety rating, automation/faceless-production feasibility, and barrier-to-entry estimate. Several of these (copyright risk, engagement, freshness) analyze the actual fetched video titles/descriptions/timestamps rather than the query text alone; others start from a query-keyword baseline. Treat any card as a heuristic estimate, not a guarantee — none of these are official platform data.

### 4. Execution Fit & Synthesis

A short creator self-assessment produces an **Execution Fit** score, which combines with the Opportunity Score into a quadrant verdict (Best Bet / Stretch / Safe Grind / Avoid). An LLM call (OpenRouter, with a rule-based local fallback when no API key is configured or the call fails) then generates a 3-bullet executive summary and a 2-week pilot video blueprint from the combined signals.

---

## Known Caveats — Read Before Trusting Scores

- **CPM/RPM benchmark figures are unsourced estimates**, not verified published data — there's no official CPM API. Category *ordering* (finance/tech high, gaming/vlogs low) is directionally consistent with public creator-economy reporting, but exact dollar figures should be treated as placeholders.
- **Monetization category matching is keyword-based** and will miss long-tail, specific queries — these fall through to a general-interest default rather than a wrong category (this was a real bug, since fixed: keyword matching now requires whole-word boundaries, not substrings).
- **The adaptive authority-pressure calibration is untested** — it's a reasonable idea (recalibrate against your own query history) but unvalidated against real outcomes.
- **Google Trends is an unofficial, reverse-engineered API** — it can silently rate-limit or return empty-looking data. The demand floor has failure detection to avoid mistaking this for genuine zero demand, but Trends should generally be treated as directionally useful, not authoritative.

---

## Tech Stack

- **Framework**: Next.js 16 (App Router, React 19)
- **Styling**: Tailwind CSS v4
- **Database / Cache**: Supabase (PostgreSQL) — 7-day TTL cache on niche lookups
- **APIs**: YouTube Data API v3, Google Trends (unofficial), OpenRouter (query simplification + executive synthesis, with rule-based fallback for both)
- **Testing**: Vitest — 9 test files, 42 tests covering the scoring engine, monetization matcher, synthesis fallback/success paths, and the API routes

---

## Setup & Local Development

### 1. Clone & Install
```bash
npm install
```

### 2. Environment Variables

Create a `.env.local` in the project root:
```env
# YouTube Data API Key (required)
YOUTUBE_API_KEY=your_key_here

# LLM providers for query simplification + synthesis (optional — both fall
# back to rule-based/local logic if unset or if a call fails). If both are
# set, Anthropic is tried first by default; override order with
# LLM_PROVIDER_ORDER="openrouter,anthropic"
ANTHROPIC_API_KEY=your_key_here
OPENROUTER_API_KEY=your_key_here

# Supabase credentials (used for 7-day result caching)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

Note: a Claude.ai Pro/Max subscription does **not** grant `ANTHROPIC_API_KEY` access — that requires a separate Console account with its own billing. OpenRouter is a simpler pay-as-you-go alternative if you don't want a separate Anthropic Console account.

### 3. Database Schema Setup

Run the SQL in `supabase/schema.sql` in your Supabase SQL Editor to provision the cache table.

### 4. Run the Dev Server
```bash
npm run dev
```
Open <http://localhost:3000>.

### 5. Run Tests
```bash
npm run test
```

---

## API Endpoints

### `GET /api/niche?q=<query>`
Returns YouTube + Trends data, the full scoring breakdown, and per-channel metrics for a search term. Rate-limited per IP; cached for 7 days.

### `POST /api/synthesis`
Given a computed score result and derived signal badges, returns a 3-bullet executive summary and pilot video blueprint. Separated from `/api/niche` to keep search latency independent of LLM response time.

---

## Project Structure

```
app/            Next.js routes (pages + API endpoints)
components/     UI components, including per-signal cards and tab views
lib/            Core logic: YouTube/Trends clients, scoring engine, synthesis
lib/scoring/    Opportunity score, monetization, and individual signal modules
lib/data/       Static benchmark data (CPM table)
test-data/      Real captured API fixtures used by the test suite
supabase/       Database schema
```