# TrendSignal — YouTube Niche Explorer

TrendSignal is a data-driven tool designed to discover and evaluate YouTube niches. By analyzing live data from the YouTube Data API v3 and Google Trends, it calculates a comprehensive **Opportunity Score (0-100)** indicating how viable a niche is for a new, dedicated channel.

---

## How It Works

TrendSignal evaluates search query data across two major axes: **competition density** and **search demand**.

```
   [ User Query ]
         │
         ├───► YouTube search.list (Original Query) ──► Competitor Channel Stats
         │
         └───► Claude / Heuristic Simplification ──► Google Trends (0-100 Interest)
                                                            │
                                                     [Scoring Engine]
                                                            │
                                                    Opportunity Score
```

### 1. The v2 Scoring Formula
The opportunity score is derived from three structural competition pressures, scaled dynamically and gated by a search demand floor:

- **Authority Pressure (40%)**: Measures how dominant large channels (median subscriber counts) are in the niche. A field of smaller channels indicates a lower barrier to entry.
- **Concentration Pressure (30%)**: Calculates the Herfindahl-Hirschman Index (HHI) based on search result page (SERP) occupancy. High concentration means a few channels systematically occupy most top positions (e.g., repeating review updates).
- **Generalist Authority Share (30%)**: Assesses the subscriber *mass* held by generalist channels dipping into the niche. This prevents the "beginner investment guides" false positive where generalists are few in headcount but dominate in reach.
- **Demand Floor (Multiplier)**: Gated by Google Trends coverage over the trailing 24 months. If Trends shows insufficient interest (e.g. `<20%` of months had any signal), the overall score is heavily penalized (multiplied by `0.3`) because lack of demand is a fatal flaw for a niche.

---

## Tech Stack

- **Framework**: Next.js 16 (App Router, React 19)
- **Styling**: Tailwind CSS v4 (Glassmorphism & dark-mode-first aesthetic)
- **Database / Cache**: Supabase (PostgreSQL)
- **APIs**: YouTube Data API v3, Google Trends API, Anthropic Claude API (Query Simplification)

---

## Setup & Local Development

### 1. Clone & Install
```bash
npm install
```

### 2. Environment Variables
Create a `.env.local` in the root of the project with the following:
```env
# YouTube Data API Key
YOUTUBE_API_KEY=your_key_here

# Anthropic API Key (Optional — falls back to rule-based simplification if missing)
ANTHROPIC_API_KEY=your_key_here

# Supabase Credentials (Used for caching search results for 7 days)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

### 3. Database Schema Setup
Execute the SQL statements inside [`supabase/schema.sql`](file:///home/nixstation-remote/Development/trendsignal/supabase/schema.sql) in your Supabase SQL Editor to provision the cache table.

### 4. Run the Dev Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to access the dashboard.

---

## API Endpoints

### `GET /api/niche?q=<query>`
Returns full niche analysis including raw results, competitor metadata, and computed scores.

**Example Response**:
```json
{
  "source": "live",
  "fetchedAt": "2026-08-22T21:24:45Z",
  "simplifiedQuery": "chisel sharpening",
  "scoreResult": {
    "query": "japanese chisel sharpening",
    "score": 88,
    "rawCompetitorCount": 25,
    "meaningfulCompetitorCount": 18,
    "specialistCompetitorCount": 16,
    "authorityPressure": 0.32,
    "concentrationPressure": 0.08,
    "generalistAuthorityShare": 0.12,
    "notes": [
      "Low concentration pressure: search results are distributed widely among unique channels."
    ]
  }
}
```
