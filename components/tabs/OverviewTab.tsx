"use client";

import { SearchResponse, VideoResult } from "@/lib/types";
import { SynthesisResult } from "@/lib/synthesis-llm";
import { TrendsChart } from "../TrendsChart";
import { getScoreLabel, getScoreColorClass, getScoreBadgeColorClass } from "@/lib/scoring/utils";

interface OverviewTabProps {
  data: SearchResponse;
  synthesis: SynthesisResult | null;
  synthesisLoading: boolean;
  synthesisError: string | null;
  triggerSynthesis: () => void;
  executionResult: { quadrantTitle: string };
}

export function OverviewTab({
  data,
  synthesis,
  synthesisLoading,
  synthesisError,
  triggerSynthesis,
  executionResult,
}: OverviewTabProps) {
  return (
    <div className="space-y-8">
      {/* Top Cards: Score and Query Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Radial Score Gauge */}
        <div className="bg-zinc-900/35 border border-zinc-800/60 backdrop-blur-xl rounded-2xl p-8 flex flex-col items-center justify-center text-center shadow-lg relative overflow-hidden">
          <div className="absolute inset-0 bg-radial-gradient from-blue-500/5 to-transparent pointer-events-none" />
          <h3 className="text-zinc-400 text-xs font-bold font-mono tracking-wider uppercase mb-6">
            Opportunity Score
          </h3>
          <div className="relative w-40 h-40 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="40"
                className="stroke-zinc-800/70"
                strokeWidth="8"
                fill="transparent"
              />
              <circle
                cx="50"
                cy="50"
                r="40"
                className={`${getScoreColorClass(data.scoreResult.score).split(" ")[1]} transition-all duration-1000 ease-out`}
                strokeWidth="8"
                strokeDasharray={251.2}
                strokeDashoffset={251.2 - (251.2 * data.scoreResult.score) / 100}
                strokeLinecap="round"
                fill="transparent"
              />
            </svg>
            <div className="absolute text-center">
              <span className="text-5xl font-black tracking-tight text-white">
                {data.scoreResult.score}
              </span>
              <span className="text-zinc-500 block text-[10px] font-bold tracking-wider uppercase mt-1">
                out of 100
              </span>
            </div>
          </div>

          <div className="mt-6">
            <span className={`px-3.5 py-1.5 rounded-full text-xs font-bold ${getScoreBadgeColorClass(data.scoreResult.score)}`}>
              {getScoreLabel(data.scoreResult.score)}
            </span>
          </div>
        </div>

        {/* Takeaway and Simplified Search */}
        <div className="lg:col-span-2 bg-zinc-900/35 border border-zinc-800/60 backdrop-blur-xl rounded-2xl p-8 flex flex-col justify-between shadow-lg">
          <div>
            <div className="flex items-center justify-between gap-4 mb-4">
              <span className="text-zinc-500 text-xs font-mono font-bold uppercase tracking-wider">
                Query Analysis &bull; {data.source === 'cache' ? 'Cached Result' : 'Live Scan'}
              </span>
              <span className="text-[10px] font-mono text-zinc-500">
                {new Date(data.fetchedAt).toLocaleDateString()}
              </span>
            </div>

            <h2 className="text-2xl font-bold text-white mb-2">
              &ldquo;{data.scoreResult.query}&rdquo;
            </h2>

            {data.simplifiedQuery !== data.scoreResult.query && (
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-zinc-950/60 border border-zinc-800 text-xs text-zinc-400 mb-4 font-mono">
                <span>Google Trends Query:</span>
                <span className="text-blue-400 font-bold">&ldquo;{data.simplifiedQuery}&rdquo;</span>
              </div>
            )}

            <p className="text-zinc-300 text-xs sm:text-sm leading-relaxed mb-6">
              Analyzed {data.scoreResult.rawCompetitorCount} total YouTube search results, identifying {data.scoreResult.meaningfulCompetitorCount} meaningful channels and {data.scoreResult.specialistCompetitorCount} dedicated specialists in this vertical.
            </p>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-3 gap-4 pt-6 border-t border-zinc-800/60">
            <div>
              <span className="text-zinc-500 text-[10px] font-mono uppercase block mb-1">Generalist Gap</span>
              <span className="text-lg font-bold text-white">
                {data.scoreResult.generalistDipInGap > 0 ? `+${data.scoreResult.generalistDipInGap} dip-ins` : 'Clean'}
              </span>
            </div>
            <div>
              <span className="text-zinc-500 text-[10px] font-mono uppercase block mb-1">Median Videos</span>
              <span className="text-lg font-bold text-white">
                {data.scoreResult.medianVideoCount} vids
              </span>
            </div>
            <div>
              <span className="text-zinc-500 text-[10px] font-mono uppercase block mb-1">Execution Verdict</span>
              <span className="text-lg font-bold text-blue-400">
                {executionResult.quadrantTitle}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* AI Executive Synthesis & Video Blueprint Section */}
      <div className="bg-zinc-900/35 border border-zinc-800/60 backdrop-blur-xl rounded-2xl p-6 sm:p-8 shadow-lg">
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-zinc-800/60">
          <div>
            <h3 className="text-zinc-200 text-sm font-bold flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-500/10 text-indigo-400 text-xs font-mono font-bold border border-indigo-500/20">
                🤖
              </span>
              AI Niche Synthesis & Pilot Blueprint
            </h3>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              Claude-synthesized analysis and customized 2-week launch schedule.
            </p>
          </div>
          <button
            onClick={triggerSynthesis}
            disabled={synthesisLoading}
            className="px-3 py-1.5 rounded-lg bg-zinc-950/60 border border-zinc-800 text-[10px] font-mono text-zinc-400 hover:text-white hover:bg-zinc-900 transition-all disabled:opacity-40"
          >
            {synthesisLoading ? "Regenerating..." : "Sync & Refresh"}
          </button>
        </div>

        {synthesisLoading ? (
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-zinc-800/60 rounded w-3/4"></div>
            <div className="h-4 bg-zinc-800/60 rounded w-5/6"></div>
            <div className="h-4 bg-zinc-800/60 rounded w-2/3"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
              <div className="h-28 bg-zinc-800/40 rounded-xl"></div>
              <div className="h-28 bg-zinc-800/40 rounded-xl"></div>
            </div>
          </div>
        ) : synthesisError ? (
          <div className="text-xs text-zinc-500 font-mono py-4 text-center">
            {synthesisError}
          </div>
        ) : synthesis ? (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Left: Summary bullets */}
            <div className="lg:col-span-2 space-y-4">
              <h4 className="text-xs font-bold text-zinc-400 uppercase font-mono tracking-wider">
                Executive Verdict Takeaways
              </h4>
              <ul className="space-y-3">
                {synthesis.executiveSummary.map((bullet: string, idx: number) => (
                  <li key={idx} className="text-xs text-zinc-300 flex items-start gap-2.5 leading-relaxed bg-zinc-950/30 p-3.5 rounded-xl border border-zinc-800/40">
                    <span className="text-indigo-400 font-bold mt-0.5 shrink-0">✓</span>
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Right: Pilot blueprint details */}
            <div className="lg:col-span-3 bg-zinc-950/45 p-6 rounded-xl border border-zinc-800/60 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-xs font-bold text-zinc-200 uppercase font-mono tracking-wider">
                    🎬 2-Week Test Video Blueprint
                  </h4>
                  <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 text-[10px] font-mono">
                    Lean Launch Concept
                  </span>
                </div>

                <div className="mb-4">
                  <span className="text-[10px] font-mono text-zinc-500 uppercase block mb-1 font-bold">Concept Pitch</span>
                  <p className="text-xs text-zinc-300 leading-relaxed font-medium">
                    {synthesis.pilotVideoBlueprint.concept}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <span className="text-[10px] font-mono text-zinc-500 uppercase block mb-1.5 font-bold">CTR Title Angles</span>
                    <ul className="space-y-1.5">
                      {synthesis.pilotVideoBlueprint.titleIdeas.map((title: string, idx: number) => (
                        <li key={idx} className="text-[11px] text-zinc-300 italic font-medium leading-tight">
                          &ldquo;{title}&rdquo;
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <span className="text-[10px] font-mono text-zinc-500 uppercase block mb-1.5 font-bold">Suggested Script Outline</span>
                    <ol className="space-y-1 text-[11px] text-zinc-400">
                      {synthesis.pilotVideoBlueprint.outline.map((step: string, idx: number) => (
                        <li key={idx} className="line-clamp-1">
                          {idx + 1}. {step}
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>

                <div className="pt-3 border-t border-zinc-850 flex flex-col sm:flex-row justify-between sm:items-center gap-2 text-[11px]">
                  <span className="text-zinc-500 font-mono">Recommended Production Strategy:</span>
                  <span className="text-zinc-300 font-bold sm:text-right">{synthesis.pilotVideoBlueprint.productionStrategy}</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-xs text-zinc-500 font-mono py-6 text-center">
            Search a niche to generate an AI blueprint summary.
          </div>
        )}
      </div>

      {/* Google Trends Search Interest over time chart */}
      {data.trends && data.trends.points.length > 0 && (
        <TrendsChart trends={data.trends} simplifiedQuery={data.simplifiedQuery} />
      )}

      {/* System Findings & Alerts */}
      {data.scoreResult.notes.length > 0 && (
        <div className="bg-zinc-900/35 border border-zinc-800/60 backdrop-blur-xl rounded-2xl p-8 shadow-lg">
          <h3 className="text-zinc-400 text-xs font-bold font-mono tracking-wider uppercase mb-4">
            System Findings & Alerts
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.scoreResult.notes.map((note, index) => {
              const isAlert = note.includes("Google Trends shows almost no") || note.includes("Generalists hold") || note.includes("concentrated");
              const isWarning = note.includes("inconsistent search interest") || note.includes("No Trends data available") || note.includes("No historical query");

              return (
                <div
                  key={index}
                  className={`flex gap-3 px-4 py-3.5 rounded-xl text-xs border leading-relaxed ${
                    isAlert
                      ? "bg-rose-500/5 border-rose-500/10 text-rose-300"
                      : isWarning
                      ? "bg-amber-500/5 border-amber-500/10 text-amber-300"
                      : "bg-zinc-950/40 border-zinc-800 text-zinc-300"
                  }`}
                >
                  <svg className="w-4.5 h-4.5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span>{note}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
