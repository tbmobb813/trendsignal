# Authority / Concentration Pressure — Findings & Open Decisions

**Status:** IMPLEMENTED in `lib/scoring/competition.ts` (2026-08-24) — both the authority-pressure decomposition (Sections 10-12) and the concentration-pressure rescale (Sections 13-14) are live in production, with regression tests locked into `competition.test.ts` and `refinement-fixes.test.ts`. Sections 1-9 are the investigation history that led there (several rejected/superseded prototypes) — kept for context on what was tried and why it didn't work, not a live TODO list. Companion scripts: `scripts/concentration-vs-authority-scenarios.ts`, `scripts/prototype8-concentration-reweight.ts`, `scripts/prototype9-concentration-rescale.ts`, `scripts/prototype9b-rescale-sensitivity.ts`, `scripts/concentration-scale-survey.ts`.

**Method:** two or three synthetic `YouTubeNicheRawData` fixtures per scenario, run through the real `computeCompetitionScore()` (not reimplemented/approximated), with the same query string held constant across all scenarios so monetization pressure can't explain any score difference. This isolates the authority / concentration / generalist mechanism specifically.

---

## 1. The original question

Does the current weighting (Authority 35% / Concentration 25% / Generalist 25% / Monetization 15%) correctly treat two structurally different ways a niche can be "locked up" by a small number of channels:

- **Volume concentration** — a few channels own the SERP through frequent posting (the "monthly GPU refresh" pattern), regardless of channel size.
- **Reach concentration** — a few *large* channels own the field through subscriber mass, regardless of how much SERP real estate they occupy.

## 2. Scenario A vs B — confirmed asymmetry

| | Scenario A (volume) | Scenario B (reach) |
|---|---|---|
| Setup | 5 mid-size specialists, 80% SERP occupancy, none generalist-flagged | 2 giant generalist-flagged channels, 24% SERP occupancy, 89% of subscriber mass |
| authorityPressure | 0.288 | 0.362 |
| concentrationPressure (HHI) | 0.136 | 0.059 |
| generalistAuthorityShare | 0.000 | 0.889 |
| **Score** | **84** | **57** |

**Finding:** a field where a few channels own 3.3x more of the actual ranking slots (A) scores *more leniently* than a field where a few channels own less SERP but dominate subscriber mass (B). Mechanically: with monetization defaulted out (query hits no CPM category), the effective weights become Authority ~41%, Concentration ~29%, Generalist ~29%. Concentration pressure contributes the least to both scores (0.040 pressure-points in A, 0.017 in B) despite being the only metric measuring *actual, current SERP occupancy* rather than a proxy for why a channel might dominate.

## 3. Scenario C — authority pressure is composition-fragile, not just conservative

Scenario C combines both patterns: 2 giants, generalist-flagged, at 80% SERP occupancy (same giants as B, but now also owning most of the ranking slots).

| | B | C |
|---|---|---|
| authorityPressure | 0.362 | **0.149** (lower, despite same giants) |
| concentrationPressure | 0.059 | 0.328 |
| generalistAuthorityShare | 0.889 | 0.997 |
| Score | 57 | 55 |

**Finding:** C should read as strictly worse than B (same giants, now also owning the SERP) but scores almost identically (55 vs 57, a 2-point gap) because `authorityPressure` *drops* from B to C. Root cause: authority pressure is a plain median over all meaningful (non-thin) channels. C has only 7 meaningful channels (2 giants + 5 small fillers at 5,000 subs each); the median lands on a filler channel, not anywhere near the giants. B has 21 meaningful channels (2 giants + 19 varied specialists 30k-66k), so the median lands closer to the specialist field. **The metric is sensitive to how many small channels happen to be in the result set, not to how big the dominant channels actually are** — at 35% weight, the single largest lever in the formula is also the noisiest.

## 4. Four prototype fixes tested, in order

All prototypes hold concentration and generalist-share calculations untouched; only the authority-pressure input changes. Scores recomputed using the real weight-redistribution logic (monetization excluded, weights renormalized across the remaining three).

### Prototype 1 — top-N median (N=3, 5, 8)

Median of only the N largest meaningful subscriber counts, instead of all of them.

| Scenario | Original | N=3 | N=5 | N=8 |
|---|---|---|---|---|
| A | 84 | 78 | 79 | 81 |
| B | 57 | **42** | 56 | 56 |
| C | 55 | **31** | **55** | **55** |

**Verdict: rejected.** Fixes A correctly (removes filler dilution), but for B/C the result depends entirely on an arbitrary headcount parameter — N=5/8 completely miss the giants in C (0 change from baseline, the exact bug this was meant to fix), while N=3 overcorrects to a 24-point swing on the same data. Relocates the composition-sensitivity rather than removing it.

### Prototype 2 — mass-weighted median (no N parameter)

Weight each channel's subscriber count by itself; find the value where cumulative subscriber mass crosses 50% of the field's total.

| Scenario | Original | Mass-weighted |
|---|---|---|
| A | 84 | 78 |
| B | 57 | 40 |
| C | 55 | 29 |

**Verdict: partially rejected.** No arbitrary parameter, and fixes the filler-dilution bug smoothly (C no longer washes out to zero change). But in both B and C the weighted median lands *exactly* on a generalist-size channel (≥500k subs — the same threshold `flagGeneralists` uses). This makes `authorityPressure` re-detect the same dominance `generalistAuthorityShare` already measures, at 35% weight instead of 25% — increasing redundancy between the two largest proxy signals rather than diversifying the evidence.

### Prototype 3 — specialist-only median (excludes generalist-flagged channels)

Plain median, but computed only over non-generalist-flagged meaningful channels.

| Scenario | Original | Specialist-only |
|---|---|---|
| A | 84 | 84 (no change) |
| B | 57 | 57 (no change) |
| C | 55 | 55 (no change) |

**Verdict: rejected alone.** Removes the redundancy with `generalistAuthorityShare` in principle, but every score is unchanged from baseline — generalists are a small minority *by headcount* even when they dominate by mass, so excluding them barely moves a plain median. Still fully exposed to the filler-dilution bug from Section 3 (C's specialist median is still 5,000 — same artifact, now for a different reason).

### Prototype 4 — specialist-only + mass-weighted (combination)

| Scenario | Original | Prototype 4 |
|---|---|---|
| A | 84 | **78** |
| B | 57 | **57** (unchanged, legitimately) |
| C | 55 | **55** (unchanged, legitimately) |

**Verdict: adopt, on its own terms.** No arbitrary N. A behaves correctly (0.288 → 0.442 authority pressure — dilution removed). B and C are unchanged from baseline, but for a *sound* reason this time: once the giants are excluded (already fully counted via `generalistAuthorityShare`), C's remaining specialist channels are genuinely uniform at 5,000 subs each — there's no distribution to weight, so 5,000 is the correct, non-fragile answer, not a coincidence of headcount. This is real, non-redundant new evidence ("how serious is the specialist field once you set the giants aside") that the formula didn't previously have.

---

## 5. The unresolved part — this does NOT close the original question

Prototype 4 fixes authority pressure's own defects (composition-fragility, generalist-redundancy) but the **B vs C gap stays at 2 points**, and now for a legitimate structural reason rather than a bug: C's leftover specialist field (5 tiny channels) is weaker than B's (19 varied channels), which numerically offsets C's higher concentration pressure. That's a defensible outcome, not an artifact — but it also means:

**Authority-pressure redesign and concentration-reweighting are two separate decisions, not one.** Fixing authority pressure does not substitute for deciding whether concentration (0.25 weight, measuring actual current SERP occupancy) should carry more relative weight against the two size-based proxies. That original question — raised in Section 2 — is still open.

## 6. Where this leaves the decision

1. **Authority pressure redesign (Prototype 4 / specialist-only, mass-weighted median):** tested across 3 scenarios, no counter-example found, fixes two independently-verified defects (fragility + redundancy). Reasonably low-risk to implement; should be validated against the existing test fixtures in `test-data/` before shipping, since all testing so far is synthetic.
2. **Concentration reweighting:** still an open, unvalidated judgment call (per the original three framed options — document as known tradeoff / reweight now / hold for real outcome data). Prototype 4 makes this decision *cleaner* to evaluate (no more redundancy noise), but doesn't resolve it.
3. **Recommended sequencing if you pursue both:** do the authority-pressure redesign first (or at least concurrently) — reweighting concentration against the *current* fragile/redundant authority metric risks tuning weights against a definition you're about to change, wasting some of that work.

## 7. Caveats on the synthetic-scenario testing

- All scenarios (A/B/C) are synthetic, hand-constructed fixtures — not real YouTube data. Directionally informative, not validated against real outcomes on their own.
- All scenarios pass `historicalDatasets: []`, so `calculateCalibrationRange()` always falls back to its default range (log-subs 3.0–7.7) and cross-query generalist detection always falls back to the subscriber-count heuristic. Real usage with 5+ cached queries could behave differently — untested here.
- Only one query string was tested across A/B/C. Section 8 addresses this by validating against real fixtures.

---

## 8. Validation against real captured fixtures

Ran Prototype 4 against all 22 real fixtures in `test-data/` (actual YouTube API captures, not synthetic) — including `how-to-invest-for-beginners.json`, the exact case `generalistAuthorityShare` was originally built to fix (see code comments in `competition.ts`), and `restoring-vintage-mechanical-calculators.json`, the exact case the README cites for the monetization-default fallback. Script: `scripts/validate-prototype4-against-fixtures.ts`.

### Aggregate result

- **22/22 fixtures processed, 0 hit the no-specialists-left fallback path** (every real fixture had at least one non-generalist meaningful channel) — that fallback path remains structurally untested by real data.
- **Mean |delta|: 3.55 points.** Most fixtures move by 0-5 points.
- **Score range of change: -14 to +5.** No fixture flipped its quadrant verdict in the tested set based on score alone, but see the two case studies below — some deltas are large enough to matter at quadrant boundaries in other queries.

| file | meaningful/specialist | authorityPressure old→new | score old→new | delta |
|---|---|---|---|---|
| restoring-vintage-mechanical-calculators.json | 13/13 | 0.164 → 0.508 | 90 → 76 | **-14** |
| resume-tips-for-career-changers.json | 19/18 | 0.340 → 0.532 | 74 → 66 | -8 |
| custom-mechanical-keyboard-soldering.json | 20/15 | 0.279 → 0.484 | 62 → 55 | -7 |
| home-espresso-setup.json | 20/15 | 0.350 → 0.563 | 60 → 53 | -7 |
| how-to-invest-for-beginners.json | 17/4 | 0.671 → 0.524 | 50 → 55 | +5 |
| money.json | 20/9 | 0.610 → 0.524 | 44 → 48 | +4 |
| morning-routine.json | 23/10 | 0.627 → 0.513 | 42 → 46 | +4 |
| *(16 more, all \|delta\| ≤ 4 — see script output)* | | | | |

### Case study: `how-to-invest-for-beginners` — behaves as designed

This is the flagship case cited in `types.ts`/`competition.ts` comments as the reason `generalistAuthorityShare` exists: 13 of 17 meaningful channels are size-flagged generalists (760k-8.83M subs — Mark Tilbury, Ali Abdaal, etc.), only 4 are real finance specialists (289k, 153k, 37.9k, 3.7k subs). Baseline authority pressure (0.671) was computed from the full 17-channel median, so it was substantially inflated by the same 13 generalists that `generalistAuthorityShare` (0.989) was already fully counting. Prototype 4 computes authority pressure from the 4 specialists only, landing on the mass-weighted center (~289k, the largest specialist) → 0.524. **Net score moves 50 → 55, a modest 5-point softening, not a verdict change** — the query is still scored hard (generalist share alone still contributes the dominant share of pressure), but the redundant double-count from Section 2/3 is gone. This is the intended fix working correctly on the case it was designed for.

### Case study: `restoring-vintage-mechanical-calculators` — the outlier, and a new property worth flagging

This fixture has **zero generalist-flagged channels** — 13 genuine specialists, ranging from 1,100 to 243,000 subscribers (CuriousMarc, the best-known channel in this specific restoration niche, is the outlier at 243k; everyone else is under 100k, most under 10k). Baseline authority pressure (0.164) reads this correctly as "mostly small, accessible field." Prototype 4's mass-weighted median lands squarely on CuriousMarc's own subscriber count (243,000 — it alone holds ~59% of the field's specialist subscriber mass), pushing authority pressure to 0.508 and the score down 14 points (90 → 76).

**This is not a bug in the sense Sections 3/4 identified** (no filler-dilution artifact, no generalist redundancy — the channel really is that outsized relative to peers) — but it does reveal a real behavioral property: **mass-weighting a specialist-only field is still fully sensitive to a single dominant specialist**, not just to generalist-flagged channels. `home-espresso-setup.json` shows the same pattern more mildly (Lance Hedrick / Ryantagcoffee at 444k/461k, both under the 500k generalist-size threshold, pull the weighted median toward them, -7 points).

Whether that's *correct* is a judgment call, not an obvious bug: arguably a lone channel commanding 59% of a niche's specialist subscriber mass genuinely is a structural barrier to a new entrant (established audience, algorithmic favor within that specific niche) even without being a cross-topic generalist — but it's a different kind of "authority" than what the metric originally measured (general field size), and it means Prototype 4 will read as harsher than the current formula specifically in thin niches with one standout specialist channel. Worth a explicit decision before shipping, not just inheriting silently.

## 9. Prototype 5 — capped/winsorized weighted median (rejected)

Attempted fix for Section 8's single-dominant-specialist finding: cap any one channel's weight contribution at a fraction (`capFraction`) of total specialist mass before computing the weighted-median crossing point, so no single channel can define the median outright the way an uncapped weighted median allows once it exceeds 50% of mass alone. Script: `scripts/prototype5-capped-weighted.ts`.

| Fixture | Baseline | Prototype 4 (uncapped) | Cap 0.25 | Cap 0.35 | Cap 0.5 |
|---|---|---|---|---|---|
| restoring-vintage-mechanical-calculators | 90 | 76 (-14) | 79 (-11) | 79 (-11) | 76 (-14, identical to uncapped) |
| home-espresso-setup | 60 | 53 (-7) | 53 (-7, no change at all) | 53 (-7) | 53 (-7) |
| how-to-invest-for-beginners (flagship) | 50 | 55 (+5) | 57 (+7) | 57 (+7) | 55 (+5) |

All-22-fixtures mean |delta| at cap=0.35: 3.50, vs Prototype 4's 3.55 — no meaningful aggregate improvement.

**Verdict: rejected.** Capping only shifts the median's crossing point when the rest of the field (below the cap) has enough combined mass to cross 50% without the capped channel. In `home-espresso-setup`, the 13 smaller specialists total only $383,700 — nowhere near half the field's $1,288,700 — so no cap fraction tested changes the answer; one of the two leaders always has to be added to cross the threshold, landing the median on their exact value regardless. In `restoring-vintage-mechanical-calculators`, capping shifts the answer only one step down (14-point swing becomes an 11-point swing) — a marginal improvement, not a fix, and cap=0.5 is indistinguishable from uncapped, reproducing the exact same threshold-effect/arbitrary-parameter problem Prototype 1 (top-N-median) was rejected for in Section 4.

**Root cause, stated plainly:** this is not a tuning problem. Robustness to filler-dilution (Prototype 4's original goal) *requires* letting large channels influence the median; robustness to a single dominant leader *requires not* letting them. No single blended statistic can satisfy both properties across every field-size regime — you can only trade one failure mode for the other. This is the argument for Option 2 (Section 10): stop asking one number to answer two different questions.

## 10. Prototype 6 — Option 2, decomposed into two signals

Instead of one authority-pressure number trying to answer both "how big is a typical specialist competitor" and "is there a runaway leader," split it into two independent signals, mirroring the existing architecture (concentration / authority / generalist share are already three separate proxies, not one blended number):

- **`authorityPressure` (redefined):** plain median over specialist channels, but first **excluding statistical size-outliers** — channels whose subscriber count exceeds `median × OUTLIER_MULTIPLIER`. This reuses the exact convention already in the codebase for `flagViralOutliers` (competition.ts:50-65, `VIRAL_OUTLIER_MULTIPLIER = 5`, currently wired for informational display only, explicitly flagged in the code as "a plausible future refinement... deliberately left out for now" — this is that refinement, extended to subscriber size). Answers: "excluding the standout(s), how big is the rest of the specialist field?"
- **`specialistDominanceShare` (new):** share of total specialist subscriber mass held by those same outlier-flagged channels. Structurally parallel to `generalistAuthorityShare`, but catches *local* giants — a channel that dominates one specific niche's mass without being a cross-topic generalist (the exact category `CuriousMarc` and the `home-espresso-setup` leaders fall into: not generalist-flagged, but still dominant within their niche). Answers: "is there a standout, and how much of the field do they hold?"

Test weight scheme (first guess, not tuned): Authority 25% / Concentration 25% / Generalist 25% / **Dominance 10%** / Monetization 15%, with the same proportional-redistribution-on-monetization-default logic as the real formula, extended to four terms. Script: `scripts/prototype6-decomposed-signals.ts`.

### Results

| Fixture | Baseline | Prototype 4 | Prototype 5 (best cap) | Prototype 6 |
|---|---|---|---|---|
| restoring-vintage-mechanical-calculators | 90 | 76 (-14) | 79 (-11) | **83 (-7)** |
| home-espresso-setup | 60 | 53 (-7) | 53 (-7) | **57 (-3)** |
| how-to-invest-for-beginners (flagship) | 50 | 55 (+5) | 57 (+7) | **63 (+13)** |

All-22-fixtures mean \|delta\|: **4.41** (worse than Prototype 4's 3.55 and Prototype 5's 3.50). 17 of 22 real fixtures triggered at least one outlier flag (dominanceShare 0.2–0.9) — a "single dominant specialist" is closer to the norm than the exception in real niche data.

**Mixed verdict, with a confound.** The decomposition mechanism works on the two cases it was built for — vintage-calculators' swing shrinks from -14 to -7, home-espresso's from -7 to -3, driven by genuinely new evidence (`dominanceShare` explicitly capturing what the single blended median couldn't). But the flagship redundancy-fix case got *worse* (+13 vs Prototype 4's +5), because at n=4 specialist channels, none crossed the `median × 5` outlier threshold (289k vs. a 477k bar) — small-sample outlier detection is unreliable. Worse, the new 5-term weight scheme (25/25/25/10/15) drops authority's *effective* weight from ~41% (original 3-term redistribution: 35/85) to ~29% (4-term redistribution: 25/85) whenever monetization defaults — a large, unintended dilution that's entangled with the decomposition itself and likely explains most of the aggregate mean-delta increase. Section 11 isolates this.

## 11. Prototype 7 — controlled comparison, weights held exactly constant

Re-ran the decomposition with the real formula's weights held byte-for-byte identical to production (Authority 0.35 / Concentration 0.25 / Generalist 0.25 / Monetization 0.15, same 3-term redistribution-on-default logic) — `dominanceShare` is folded *inside* the existing 35% authority budget instead of getting its own weight slot:

```
authorityPressureV3 = clamp(authorityPressureFromMedian(robustMedian) + DOMINANCE_BUMP × dominanceShare, 0, 1)
```

Also added a minimum-sample-size guard (`MIN_SAMPLE_FOR_OUTLIER = 6`): below 6 specialist channels, outlier detection is skipped entirely and `robustMedian` falls back to the plain specialist median (Prototype 3's definition), rather than trusting a 4-point sample's threshold crossing. Tested `DOMINANCE_BUMP` = 0.2 / 0.3 / 0.4. Script: `scripts/prototype7-controlled-comparison.ts`.

### Results (bump = 0.3)

| Fixture | Baseline | Prototype 6 (new weights) | **Prototype 7 (weights held constant)** |
|---|---|---|---|
| restoring-vintage-mechanical-calculators | 90 | 83 (-7) | **81 (-9)** |
| home-espresso-setup | 60 | 57 (-3) | **54 (-6)** |
| how-to-invest-for-beginners (flagship) | 50 | 63 (+13) | **59 (+9)** |

All-22-fixtures mean \|delta\| at bump=0.3: **3.59** — essentially identical to Prototype 4 (3.55) and Prototype 5 (3.50), and far below Prototype 6's 4.41. Only 1 of 22 fixtures (how-to-invest-for-beginners, n=4) triggered the sample-size guard.

Synthetic scenario regression check (bump=0.3): A 84→83, B 57→57, C 55→55 — the original A/B/C differentiation from Section 2/3 is preserved, no regression.

### Interpretation — the confound is confirmed

Holding weights constant **fixes most of Prototype 6's aggregate cost**: mean |delta| drops from 4.41 back to 3.59, right in line with every other prototype tested. That confirms the hypothesis directly — Prototype 6's aggregate-movement increase was mostly the weight-redistribution side effect, not something inherent to decomposing the signal. The two originally-flagged fixtures still improve meaningfully relative to Prototype 4 (vintage-calculators -14→-9, home-espresso -7→-6), via a real, isolated mechanism this time (one new parameter, `DOMINANCE_BUMP`, inside an unchanged weight budget, not a wholesale weight-scheme change).

The flagship case's overcorrection shrinks (+13→+9) but doesn't fully resolve — the residual +9 is now attributable almost entirely to the specialist-only definition itself (excluding the 13 generalists drops authority pressure regardless of outlier logic, since the sample-size guard skips outlier detection here) plus the switch from Prototype 4's *mass-weighted* median (which lands on 289k, the top specialist) to Prototype 7's *plain* median at n=4 (95,450, the midpoint of 4 values) — a genuinely separate, still-open design choice: should authority pressure at very small specialist-sample sizes weight toward the top of the range or the middle? Untested here.

`DOMINANCE_BUMP` remains a real, undetermined parameter (0.2 gives -6/-4 on the two key fixtures, 0.4 gives -12/-9) — narrower and easier to reason about than Prototype 6's full weight redesign, but still needs either a principled derivation or real outcome data to set with confidence, not a guess.

### Conclusion

Prototype 7 is the strongest candidate produced by this investigation: real, isolated improvement on both originally-flagged fixtures, no aggregate regression, the flagship case's overcorrection is reduced (not eliminated), and the design surface is now down to two named, small parameters (`OUTLIER_MULTIPLIER = 5`, reused from existing code precedent, and `DOMINANCE_BUMP`, still needing calibration) instead of a full weight redesign. Before implementing: (1) decide `DOMINANCE_BUMP` deliberately rather than defaulting to 0.3, (2) decide whether small-specialist-sample authority (n < 6) should use plain or mass-weighted median, since that's the last open piece of the how-to-invest-for-beginners residual delta, and (3) add both `restoring-vintage-mechanical-calculators`-shape and `how-to-invest-for-beginners`-shape fixtures to `competition.test.ts` as permanent regression cases once a final version ships.

### Conclusion

Prototype 4 validates well in aggregate (mean move of 3.55 points, no fallback-path fixtures encountered, the flagship redundancy case behaves as intended) and is ready for a real implementation attempt — but ship it with the single-dominant-specialist behavior (Section 8, case 2) called out explicitly as an intentional design property, not a side effect, so it doesn't surprise anyone debugging a future score. Recommend adding 1-2 fixtures with this "thin niche, one standout leader" shape to the permanent test suite (`competition.test.ts`) alongside the `how-to-invest-for-beginners`-style generalist-dominant case, so both properties are locked in by regression tests once implemented.

## 12. IMPLEMENTED — authority-pressure decomposition (2026-08-24)

Prototype 7 shipped to `lib/scoring/competition.ts` as-is: `DOMINANCE_BUMP = 0.2` (chosen conservative — 0.3/0.4 were tested and rejected for approaching swing sizes already rejected in Prototype 4/6), `SPECIALIST_SIZE_OUTLIER_MULTIPLIER = 5` (reused from the existing `VIRAL_OUTLIER_MULTIPLIER` convention), `MIN_SAMPLE_FOR_OUTLIER_DETECTION = 6`. Weights held exactly at production values (35/25/25/15) — no new top-level weight. Regression anchors locked into `competition.test.ts`:

- `restoring-vintage-mechanical-calculators.json`: 90 (old plain-median) → 84 (authority-only fix) → **80 (final, both fixes)**
- `how-to-invest-for-beginners.json`: 50 (old) → 58 (authority-only fix) → **56 (final, both fixes)**

The n<6 small-specialist-sample question (plain vs. mass-weighted median, Section 11's residual gap) remains genuinely unresolved and is called out as such directly in the test comments — not silently absorbed into "done."

## 13. Concentration-reweighting — reweighting rejected, rescaling is the real fix

Returned to the ORIGINAL question that started this entire investigation (Section 2): with the authority-pressure fix now live, is the A-vs-B asymmetry (volume-concentration scored more leniently than reach-concentration) resolved? **No — confirmed orthogonal.** Re-run against the shipped fix: A=85, B=57, C=55 (gaps 28/30/2), essentially unchanged from the pre-fix baseline (84/57/55, gaps 27/29/2). Fixing authority pressure never touched concentration's weighting problem, as predicted.

### Prototype 8 — naive reweighting (rejected)

Tested three candidate weight schemes shifting weight from authority toward concentration (30/30/25/15, 25/35/25/15, 28/32/22/18) plus their component-wise average, against synthetic A/B/C and all 22 real fixtures. Script: `scripts/prototype8-concentration-reweight.ts`.

**Result: rejected, decisively.** Every single one of the 22 real fixtures got *more lenient* under every scheme tested, with zero exceptions (mean |delta| 1.73–3.91, all positive). The A-B gap barely narrowed (28→24 at best) while A-C and B-C gaps got *worse* (A-C: 30→34; B-C: 2→8). The averaged scheme (component-wise mean of the three candidates) added no new information — it landed at an intermediate point on the same line, inheriting the identical systematic-softening failure mode at a middling intensity (mean |delta| 2.27).

**Root cause:** concentration pressure's raw HHI is simply small in magnitude across real data — surveyed via `scripts/concentration-scale-survey.ts` across all 22 fixtures: concentrationPressure (pre-rescale) ranged 0.045-0.190 (mean 0.076), vs authorityPressure's 0.30-0.48 (mean 0.41) and generalistAuthorityShare's mean of 0.82 — concentration is over 5x smaller in typical magnitude. Shifting weight *from* an always-larger component *to* an always-smaller one mechanically softens nearly every score, independent of whether a given niche has an actual concentration problem. The weight was never the bottleneck — the scale was.

### Prototype 9 — concentration rescale (adopted)

Applied the exact same fix already used for authority pressure: min-max rescale the raw HHI against its observed range before applying the (unchanged) weight, instead of clamping raw HHI directly to [0,1]. Tested with weight held exactly constant at 25% to isolate the effect. Script: `scripts/prototype9-concentration-rescale.ts`.

**Result, with CONCENTRATION_MIN=0.03/MAX=0.30: all 22 real fixtures moved in a single consistent direction** — 0 more lenient, 19 harsher, 3 unchanged, mean |delta| 2.45. Synthetic scenario gaps: A-B narrowed 28→22 (the original ask), B-C widened 2→21 (correctly — Scenario C, the same giants as B *plus* SERP lockup, should score meaningfully worse than B, and the original formula badly failed to show that). This is a fundamentally more reliable class of fix than anything in Sections 4-9: no threshold cliffs, no arbitrary-headcount sensitivity — a smooth, monotonic, one-directional correction.

### Prototype 9b — CONCENTRATION_MIN/MAX sensitivity (adopted: 0.02/0.40)

Tested four (min, max) pairs — tight (0.04/0.20), the original 0.03/0.30, moderate (0.03/0.25), wide (0.02/0.40) — against synthetic scenarios and all 22 fixtures. Script: `scripts/prototype9b-rescale-sensitivity.ts`.

| Range | Real-fixture mean \|delta\| | Worst single swing | Gap B-C |
|---|---|---|---|
| tight (0.04/0.20) | 3.91 | -19 | 21 |
| 0.03/0.30 | 2.45 | -10 | 21 |
| moderate (0.03/0.25) | 3.41 | -13 | 20 |
| **wide (0.02/0.40)** | **1.86** | **-6** | **15** |

**All four ranges preserved the correct direction with zero exceptions and zero clamping to 0 or 1 across all 22 real fixtures** — this parameter degrades gracefully with no cliffs, unlike every earlier rejected parameter (top-N's headcount cutoff, the capping fraction). The choice among them is purely "how aggressive," not "which mechanism is correct." **Adopted `wide (0.02/0.40)`** as the conservative first-pass choice — smallest real-world impact that still fixes the directional bug and still meaningfully separates B from C (gap 15, vs. the broken baseline of 2).

## 14. IMPLEMENTED — concentration-pressure rescale (2026-08-24)

Shipped to `lib/scoring/competition.ts`: `CONCENTRATION_MIN = 0.02`, `CONCENTRATION_MAX = 0.40`, applied to raw HHI before the existing 25% weight (weight itself untouched — reweighting was rejected in Section 13). The informational note at `hhi > 0.15` (competition.ts, near the generalist-share note) was recalibrated to read the raw `hhi` value directly rather than the now-rescaled `concentrationPressure`, since that threshold was calibrated against real fixtures' raw HHI range and the note describes real-world SERP structure, not the internal scoring transform. `types.ts`'s doc comment for `concentrationPressure` was updated to clarify it's rescaled, not raw HHI.

Regression tests updated:
- `refinement-fixes.test.ts`: the thin-channel-filtering test's expected values updated from raw HHI (1/3, 0.1) to their rescaled equivalents (≈0.8246, ≈0.2105) — the underlying filtering logic being tested is unchanged, only the exposed scale.
- `competition.test.ts` regression anchors, final values with both fixes live: `restoring-vintage-mechanical-calculators.json` → **80**, `how-to-invest-for-beginners.json` → **56**.

Full suite: 50/50 passing. All 22 real fixtures sanity-swept post-implementation, scores land in a sane 47-80 range with no anomalies.

## 15. What's still open

- **Small-specialist-sample authority (n<6):** plain vs. mass-weighted median at very small sample sizes — the residual gap from Section 11/12, not addressed by anything since.
- **No real outcome data exists** for any of the constants set during this investigation (`DOMINANCE_BUMP`, `SPECIALIST_SIZE_OUTLIER_MULTIPLIER`, `CONCENTRATION_MIN/MAX`) — all are reasoned, conservative first-pass guesses in the same category as every other hand-set constant already in the file, chosen via extensive synthetic-scenario and real-fixture testing rather than arbitrarily, but unvalidated against actual niche outcomes. TrendSignal is pre-launch with no outcome-tracking pipeline as of this writing — revisit if/when real usage data exists.
- **Further parameter tuning was deliberately stopped here.** Every genuinely different structural lever has been tested (weight redistribution — rejected; authority-pressure definition — fixed; concentration-pressure scale — fixed). Continued shuffling of the remaining magnitude parameters against these same synthetic scenarios would risk overfitting to fixtures built for this investigation rather than producing real improvement — the next genuine gain requires actual outcome data, not more scenario testing.
