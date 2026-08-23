## Reusability verdict — direct answer

**TrendPost: nothing.** The repo you linked contains no functioning code — three files, no `src/`, README describing an app that lives in a different, unverified repo. There's nothing to fork.

**Trend-Tracker: a narrow, specific slice — roughly 10–15% of the codebase, not the app itself.** What's reusable:

- The `PromptTemplate` type shape (system prompt / user prompt template / typed variables / examples / chainable metadata) and the two utility functions `interpolatePrompt()` and `validatePromptVariables()`. This is a clean pattern for the *final synthesis step* of a validator — feeding real fetched data into a constrained prompt.
- The Zustand store scaffolding pattern (config state, generation history, running statistics) — structurally fine to adapt.
- The dual-provider `AIService` class — usable as a thin LLM-calling utility, **but only after fixing two real bugs**: the streaming/non-streaming OpenAI key-fallback inconsistency, and the stale hardcoded pricing tables (2024-era model names).

What is **not** reusable, at all: all 12 actual tool implementations (pure hallucination-generation, the opposite of what a validator needs), the chaining system (unimplemented — throws "not yet implemented"), and critically, the storage layer needs to be rebuilt before you'd trust it with real API keys — `AsyncStorage` is not encrypted despite the README's claim, and a validator tool holding YouTube/Google credentials can't inherit that as-is.

Net recommendation: **don't fork either repo.** Start a clean repository. Optionally copy the `PromptTemplate` type definitions and the two utility functions in as a starting point (that's maybe 100 lines worth keeping out of ~2,500+ across both projects), rewrite the AI service with the bugs fixed, and use `expo-secure-store` (or your existing Supabase-with-RLS pattern, keeping keys server-side rather than on-device) instead of plain AsyncStorage for anything credential-bearing.

---

## Full data-point inventory (consolidated from everything discussed)

**Niche Opportunity signals**
1. Demand trend direction (Google Trends slope, relative interest over time)
2. Supply/competition density (video count for the term)
3. Competition quality composite (views-per-subscriber ratio, upload consistency, content freshness, video age distribution of top-N results)
4. Monetization ceiling (CPM/RPM tier by IAB/content category)
5. Monetization diversity (affiliate commission rate by category, sponsorship density proxy via description/transcript scraping for sponsor mentions)
6. Format/algorithm fit (Shorts-compatible vs. long-form/session-duration-favored)
7. Trend lifecycle position (rising/peaking/saturated/declining — hype-cycle stage)
8. Loyalty/durability proxy (subscriber-to-view ratio, comment-to-view ratio of top channels)
9. Barrier to entry (equipment/skill cost implied by top-performing content)
10. Automation/AI-production feasibility (can this be done with narration + stock footage)
11. Advertiser-friendliness/demonetization risk flag
12. Sub-niche decomposition (keyword clustering into specific angles rather than broad topics)
13. Geographic/language arbitrage (saturated in one market, open in another)
14. Cross-platform triangulation (TikTok/Reddit/Amazon signal agreement) — confidence booster, not core

**Execution-Readiness signals (new — creator-specific, not niche-specific)**
15. Skill/equipment match — does the creator already have what top performers in this niche use
16. Production capacity — realistic sustainable upload cadence vs. what the niche's top channels maintain
17. Existing audience transferability — does the creator have a channel/following that carries over, or a cold start
18. Depth of expertise/interest — a probing self-assessment (not "are you passionate," but "can you produce 20 video ideas in this topic in 10 minutes without googling" — a much better durability test than self-rated enthusiasm)
19. Available budget for tools, outsourced editing, or paid research access

## Scoring model

**Niche Opportunity Score** (0–100, weighted composite):
- Demand trend — 25%
- Supply gap (demand relative to competition quality, not just competition count) — 25%
- Monetization ceiling + diversity — 20%
- Durability/loyalty proxy — 15%
- Barrier-to-entry risk adjustment (inverse-weighted; low-barrier opportunities get flagged as fragile, not penalized outright) — 15%

**Execution Fit Score** (0–100, separate axis, not blended into the same number):
- Weighted from items 15–19 above, self-reported with the "produce 20 ideas in 10 minutes" style probes to reduce self-report inflation.

**Why two separate scores, not one blended number:** collapsing them into a single score hides the actual decision structure. A 2×2 quadrant (Niche Opportunity × Execution Fit) is the honest output — "Best Bet" (high/high), "Stretch" (high opportunity, needs skill-building or outsourcing), "Safe Grind" (you're well-suited but the market's tight, differentiation-dependent), "Avoid" (low/low). This is a direct, deliberate application of the Blue Ocean / portfolio-matrix pattern, and it's also the honest fix to the structural problem I raised at the very start: a single "go/no-go" score overclaims certainty a pre-hoc model can't actually deliver. A quadrant with clear tradeoffs is defensible; a single number pretending to be a verdict is not.

**Critical addition given the Lean Startup point from earlier:** the tool's final output screen shouldn't just be a score — it should recommend a specific next action: "make one low-cost test video in this niche within 2 weeks, here's what metrics to check." A validator that ends at a number is an oracle-pretender. A validator that ends at a scored, prioritized empirical test is the honest version of this product.

## MVP — what actually gets built first, scoped for a solo founder with a day job

Data-point breadth is the enemy of shipping here. Cut hard for v1.

**In MVP (v1):**
1. Single search-term input → YouTube Data API v3 pull of top 20–30 search results + channel stats (official, free tier, no scraping/ToS risk). This gets you items 2, 3, 8.
2. Google Trends integration via an unofficial but stable library (`google-trends-api` npm package, or a small Python microservice using `pytrends` if you want more reliability) for item 1.
3. A static, hand-curated CPM/monetization lookup table keyed to YouTube's ~15–20 category taxonomy or IAB categories — not a live pipeline, just a maintained JSON file you update quarterly from published benchmark reports (Social Blade, Influencer Marketing Hub). Covers item 4 at "good enough" fidelity for v1; defer the creator-panel real-RPM system to v2.
4. Sub-niche suggestions (item 12) via Google Trends "related queries" + YouTube autocomplete — cheap, no clustering/embeddings model needed yet. Real semantic clustering is v2.
5. Execution-readiness questionnaire (items 15–19) — a structured form, weighted rubric, no ML. This is the cheapest high-value piece to build and it's the actual differentiator nobody else in this space has (confirmed from the earlier competitor research — VidIQ, TubeBuddy, OutlierKit, NexLev, TubeLab all score the niche; none score the creator against it).
6. Composite scoring engine implementing the two-axis model above.
7. Result caching layer (Supabase, matching your existing stack) — mandatory, not optional, because of API quota: YouTube Data API's free tier is 10,000 units/day and a single `search.list` call costs 100 units, so you get roughly 100 searches/day before hitting the wall. Cache every result with a TTL (weekly refresh is plenty for demand data that doesn't move daily) or you'll burn quota on repeat/dev testing alone.
8. LLM synthesis step (Claude, using the cleaned-up `PromptTemplate` pattern from Trend-Tracker) that turns the computed scores into a plain-language readout — explicitly prompt-constrained with an instruction like "only reference the numeric values provided in this data block; never estimate or invent a figure not given to you." This is the one place carrying over Trend-Tracker's architecture is legitimately useful, with the hallucination risk deliberately engineered out.

**Explicitly deferred (v2+):** real CPM creator-panel data collection, cross-platform triangulation (TikTok/Reddit/Amazon), embedding-based semantic sub-niche clustering, automation-feasibility scoring, geographic/language arbitrage detection, any multi-step chained workflow.

**Realistic scope check:** items 1, 2, 5, 6, 7, 8 are a legitimately shippable MVP for one person working around a full-time job — probably 3–5 weeks of focused evening/weekend work given your existing Node/TS/Supabase/API-integration experience. Items 3 and 4 add maybe another week each if done at "good enough" fidelity rather than gold-plated. That's a real v1, not a fantasy one — but only if you resist the urge to build all 14 opportunity signals and both execution-readiness depth and cross-platform triangulation before shipping anything. Given your own flagged pattern of research/framework consumption substituting for shipping, the actual risk on this project isn't technical difficulty — it's scope creep dressed up as thoroughness. Ship the two-axis MVP with 4 real data sources before touching anything on the deferred list.
