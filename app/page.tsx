"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { calculateExecutionFitScore, ExecutionAnswers } from "@/lib/scoring/execution";
import { getMonetizationBenchmark } from "@/lib/scoring/monetization";
import { analyzeFormatFit } from "@/lib/scoring/format-fit";
import { evaluateAutomationFeasibility } from "@/lib/scoring/automation";
import { evaluateAdvertiserSafety } from "@/lib/scoring/advertiser-safety";
import { evaluateCopyrightRisk } from "@/lib/scoring/copyright-risk";
import { SynthesisResult } from "@/lib/synthesis-llm";
import { SearchResponse } from "@/lib/types";
import { useQuery } from "@/lib/hooks/useQuery";

// Tab Presenters
import { OverviewTab } from "@/components/tabs/OverviewTab";
import { StrategyTab } from "@/components/tabs/StrategyTab";
import { MarketTab } from "@/components/tabs/MarketTab";
import { CompetitorTab } from "@/components/tabs/CompetitorTab";

type TabType = 'overview' | 'strategy' | 'market' | 'competitors';

export default function Home() {
  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [executionAnswers, setExecutionAnswers] = useState<ExecutionAnswers>({});

  const [synthesis, setSynthesis] = useState<SynthesisResult | null>(null);
  const [synthesisLoading, setSynthesisLoading] = useState(false);
  const [synthesisError, setSynthesisError] = useState<string | null>(null);

  const fetcher = useCallback(async () => {
    if (!activeQuery) throw new Error("Empty search query");
    const res = await fetch(`/api/niche?q=${encodeURIComponent(activeQuery)}`);
    if (!res.ok) {
      const errJson = await res.json().catch(() => null);
      throw new Error(errJson?.error || `Search failed with status ${res.status}`);
    }
    return res.json() as Promise<SearchResponse>;
  }, [activeQuery]);

  const {
    data,
    error: queryError,
    isLoading: queryLoading,
    setData,
  } = useQuery<SearchResponse>(activeQuery, fetcher, { enabled: activeQuery.length >= 2 });

  const executionResult = useMemo(() => {
    return calculateExecutionFitScore(
      executionAnswers,
      data ? data.scoreResult.score : 0
    );
  }, [executionAnswers, data]);

  const samples = [
    "budget meal prep",
    "japanese chisel sharpening",
    "morning routine",
    "pottery for beginners",
    "restoring vintage mechanical calculators"
  ];

  const triggerSynthesis = useCallback(async (resData: SearchResponse, answers: ExecutionAnswers) => {
    setSynthesisLoading(true);
    setSynthesisError(null);
    setSynthesis(null);

    try {
      const execResult = calculateExecutionFitScore(answers, resData.scoreResult.score);
      const monetization = getMonetizationBenchmark(resData.scoreResult.query).benchmark;
      const formatFit = analyzeFormatFit(resData.videos);
      const automation = evaluateAutomationFeasibility(resData.scoreResult.query, resData.videos);
      const safety = evaluateAdvertiserSafety(resData.scoreResult.query, resData.videos);
      const copyright = evaluateCopyrightRisk(resData.scoreResult.query, resData.videos);
      const lifecycle = resData.trends?.lifecycle ?? { badge: 'N/A' };

      const inputPayload = {
        query: resData.scoreResult.query,
        opportunityScore: resData.scoreResult.score,
        executionScore: execResult.executionScore,
        quadrant: execResult.quadrantTitle,
        rpmRange: monetization.rpmRange,
        lifecycle: lifecycle.badge,
        formatFit: formatFit.badge,
        automation: automation.badge,
        safety: safety.badge,
        copyright: copyright.badge,
      };

      const res = await fetch('/api/synthesis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inputPayload),
      });

      if (!res.ok) {
        throw new Error('Synthesis request failed');
      }

      const json = await res.json();
      setSynthesis(json);
    } catch {
      setSynthesisError('Could not load AI synthesis blueprint.');
    } finally {
      setSynthesisLoading(false);
    }
  }, []);

  const executionAnswersRef = useRef(executionAnswers);
  useEffect(() => {
    executionAnswersRef.current = executionAnswers;
  }, [executionAnswers]);

  // 2. Automatically trigger AI synthesis when fresh data lands
  useEffect(() => {
    if (data) {
      triggerSynthesis(data, executionAnswersRef.current);
    }
  }, [data, triggerSynthesis]);

  const handleSearch = (searchQuery: string) => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setLocalError("Please enter at least 2 characters.");
      return;
    }
    setLocalError(null);
    setSynthesis(null);
    setSynthesisError(null);
    setActiveQuery(searchQuery);
    setQuery(searchQuery);
  };

  const currentError = localError || (queryError ? queryError.message : null);

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 selection:bg-blue-500 selection:text-white font-sans antialiased relative overflow-x-hidden">
      {/* Dynamic Background Glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-gradient-to-b from-blue-600/15 via-indigo-600/5 to-transparent blur-3xl pointer-events-none rounded-full" />
      <div className="absolute top-[300px] right-0 w-[500px] h-[400px] bg-purple-600/10 blur-3xl pointer-events-none rounded-full" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative z-10">
        {/* Header Branding */}
        <header className="flex flex-col items-center text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-mono font-medium mb-4 shadow-inner">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
            TrendSignal v2.0 &bull; Niche Opportunity & Creator Fit Validator
          </div>
          <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-white max-w-3xl leading-tight">
            Discover Underserved <span className="bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent">YouTube Niches</span>
          </h1>
          <p className="mt-4 text-zinc-400 text-sm sm:text-base max-w-2xl font-normal leading-relaxed">
            Validate search demand, generalist dominance, competitor concentration, and your personal execution fit before creating a single video.
          </p>
        </header>

        {/* Search Bar Input Container */}
        <div className="max-w-2xl mx-auto mb-10">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSearch(query);
            }}
            className="relative flex items-center shadow-2xl"
          >
            <label htmlFor="niche-search" className="sr-only">Search YouTube niches</label>
            <input
              type="text"
              id="niche-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g., pottery for beginners, budget meal prep..."
              className="w-full px-5 py-4 pl-12 pr-32 rounded-2xl bg-zinc-900/80 border border-zinc-800 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all backdrop-blur-xl text-sm sm:text-base shadow-inner"
            />
            <svg
              className="w-5 h-5 absolute left-4 text-zinc-500 pointer-events-none"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <button
              type="submit"
              disabled={queryLoading}
              className="absolute right-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-xs sm:text-sm shadow-md shadow-blue-500/20 transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {queryLoading ? (
                <>
                  <svg className="animate-spin w-4 h-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Analyzing...
                </>
              ) : (
                "Scan Niche"
              )}
            </button>
          </form>

          {/* Sample Prompts List */}
          <div className="mt-3 flex items-center justify-center flex-wrap gap-2 text-xs text-zinc-500">
            <span className="font-mono text-[11px]">Try searching:</span>
            {samples.map((s) => (
              <button
                key={s}
                disabled={queryLoading}
                onClick={() => handleSearch(s)}
                className="px-3 py-1.5 rounded-full bg-zinc-950/40 hover:bg-zinc-800/80 border border-zinc-800 text-[11px] text-zinc-400 hover:text-zinc-200 transition-all"
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Error Alert Box */}
        {currentError && (
          <div className="max-w-2xl mx-auto mb-8 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs sm:text-sm flex items-center gap-3">
            <svg className="w-5 h-5 shrink-0 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{currentError}</span>
          </div>
        )}

        {/* Dashboard Results Container */}
        {data && (
          <div className="space-y-8 animate-fade-in">
            {/* Sticky 4-Tab Navigation Bar */}
            <div className="sticky top-4 z-40 bg-zinc-950/85 border border-zinc-800/80 backdrop-blur-xl rounded-2xl p-1.5 shadow-2xl flex flex-wrap gap-1">
              {[
                { id: 'overview', label: '📊 Overview' },
                { id: 'strategy', label: '🎯 Creator & Strategy' },
                { id: 'market', label: '💰 Market & Monetization' },
                { id: 'competitors', label: `🎬 Competitor SERP (${data.videos.length})` },
              ].map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as TabType)}
                    className={`flex-1 min-w-[130px] px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* TAB CONTENTS */}
            {activeTab === 'overview' && (
              <OverviewTab
                data={data}
                synthesis={synthesis}
                synthesisLoading={synthesisLoading}
                synthesisError={synthesisError}
                triggerSynthesis={() => triggerSynthesis(data, executionAnswers)}
                executionResult={executionResult}
              />
            )}

            {activeTab === 'strategy' && (
              <StrategyTab
                data={data}
                executionAnswers={executionAnswers}
                setExecutionAnswers={setExecutionAnswers}
                executionResult={executionResult}
                handleSearch={handleSearch}
              />
            )}

            {activeTab === 'market' && (
              <MarketTab data={data} />
            )}

            {activeTab === 'competitors' && (
              <CompetitorTab data={data} />
            )}
          </div>
        )}
      </div>
    </main>
  );
}
