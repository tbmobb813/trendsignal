'use client';

import React from 'react';
import { ExecutionResult } from '../lib/scoring/execution';

interface MatrixQuadrantProps {
  nicheOpportunityScore: number;
  executionResult: ExecutionResult;
}

export function MatrixQuadrant({
  nicheOpportunityScore,
  executionResult,
}: MatrixQuadrantProps) {
  const { quadrant, quadrantTitle, quadrantBadge, quadrantColor, description, recommendedAction, executionScore } = executionResult;

  // Determine badge background colors based on quadrant color key
  const colorStyles = {
    emerald: {
      bg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
      marker: 'bg-emerald-400 shadow-emerald-500/50',
      actionBg: 'bg-emerald-500/5 border-emerald-500/20 text-emerald-300',
    },
    amber: {
      bg: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
      marker: 'bg-amber-400 shadow-amber-500/50',
      actionBg: 'bg-amber-500/5 border-amber-500/20 text-amber-300',
    },
    blue: {
      bg: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
      marker: 'bg-blue-400 shadow-blue-500/50',
      actionBg: 'bg-blue-500/5 border-blue-500/20 text-blue-300',
    },
    rose: {
      bg: 'bg-rose-500/10 border-rose-500/30 text-rose-400',
      marker: 'bg-rose-400 shadow-rose-500/50',
      actionBg: 'bg-rose-500/5 border-rose-500/20 text-rose-300',
    },
  }[quadrantColor];

  return (
    <div className="bg-zinc-900/40 border border-zinc-800/60 backdrop-blur-xl rounded-2xl p-6 sm:p-8 shadow-lg flex flex-col justify-between">
      <div>
        {/* Header Title & Quadrant Badge */}
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 mb-6 pb-4 border-b border-zinc-800/60">
          <div>
            <h3 className="text-zinc-400 text-xs font-bold font-mono tracking-wider uppercase">
              2×2 Strategic Opportunity Matrix
            </h3>
            <span className="text-xl font-extrabold text-white mt-1 block">
              Verdict: <span className="underline decoration-2 underline-offset-4">{quadrantTitle}</span>
            </span>
          </div>

          <div className={`px-3.5 py-1.5 rounded-xl border text-xs font-bold self-start sm:self-auto ${colorStyles.bg}`}>
            {quadrantBadge}
          </div>
        </div>

        {/* Dual Scores Summary */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-zinc-950/50 border border-zinc-800/50 rounded-xl p-4 text-center">
            <span className="text-[10px] font-mono font-bold text-zinc-500 uppercase block mb-1">
              Market Opportunity
            </span>
            <span className="text-2xl font-black text-white">{nicheOpportunityScore}</span>
            <span className="text-xs text-zinc-500 font-mono"> / 100</span>
          </div>

          <div className="bg-zinc-950/50 border border-zinc-800/50 rounded-xl p-4 text-center">
            <span className="text-[10px] font-mono font-bold text-zinc-500 uppercase block mb-1">
              Creator Execution Fit
            </span>
            <span className="text-2xl font-black text-white">{executionScore}</span>
            <span className="text-xs text-zinc-500 font-mono"> / 100</span>
          </div>
        </div>

        {/* 2x2 Matrix Grid */}
        <div className="relative bg-zinc-950/80 border border-zinc-800/80 rounded-xl p-4 mb-6 aspect-square sm:aspect-[4/3] flex flex-col">
          {/* Axis Labels */}
          <div className="absolute top-2 left-3 text-[10px] font-mono font-bold text-zinc-500">
            ▲ High Execution Fit (100)
          </div>
          <div className="absolute bottom-2 right-3 text-[10px] font-mono font-bold text-zinc-500 text-right">
            High Opportunity (100) ▶
          </div>

          {/* 4 Quadrants Grid */}
          <div className="grid grid-cols-2 grid-rows-2 h-full w-full gap-2 relative">
            {/* Top-Left: SAFE GRIND (Low Opp, High Fit) */}
            <div
              className={`rounded-lg p-3 border flex flex-col justify-between transition-all ${
                quadrant === 'SAFE_GRIND'
                  ? 'bg-blue-500/10 border-blue-500/40 ring-2 ring-blue-500/20'
                  : 'bg-zinc-900/30 border-zinc-800/40 opacity-40'
              }`}
            >
              <span className="text-xs font-bold text-blue-400">⛏️ SAFE GRIND</span>
              <span className="text-[10px] text-zinc-400 leading-tight">High Fit / Low Opp</span>
            </div>

            {/* Top-Right: BEST BET (High Opp, High Fit) */}
            <div
              className={`rounded-lg p-3 border flex flex-col justify-between transition-all ${
                quadrant === 'BEST_BET'
                  ? 'bg-emerald-500/10 border-emerald-500/40 ring-2 ring-emerald-500/20'
                  : 'bg-zinc-900/30 border-zinc-800/40 opacity-40'
              }`}
            >
              <span className="text-xs font-bold text-emerald-400">🚀 BEST BET</span>
              <span className="text-[10px] text-zinc-400 leading-tight">High Fit / High Opp</span>
            </div>

            {/* Bottom-Left: AVOID (Low Opp, Low Fit) */}
            <div
              className={`rounded-lg p-3 border flex flex-col justify-between transition-all ${
                quadrant === 'AVOID'
                  ? 'bg-rose-500/10 border-rose-500/40 ring-2 ring-rose-500/20'
                  : 'bg-zinc-900/30 border-zinc-800/40 opacity-40'
              }`}
            >
              <span className="text-xs font-bold text-rose-400">🛑 AVOID</span>
              <span className="text-[10px] text-zinc-400 leading-tight">Low Fit / Low Opp</span>
            </div>

            {/* Bottom-Right: STRETCH (High Opp, Low Fit) */}
            <div
              className={`rounded-lg p-3 border flex flex-col justify-between transition-all ${
                quadrant === 'STRETCH'
                  ? 'bg-amber-500/10 border-amber-500/40 ring-2 ring-amber-500/20'
                  : 'bg-zinc-900/30 border-zinc-800/40 opacity-40'
              }`}
            >
              <span className="text-xs font-bold text-amber-400">🧗 STRETCH</span>
              <span className="text-[10px] text-zinc-400 leading-tight">Low Fit / High Opp</span>
            </div>

            {/* Animated Dot Plotter */}
            <div
              className="absolute pointer-events-none transition-all duration-500 ease-out"
              style={{
                left: `clamp(8%, ${nicheOpportunityScore}%, 92%)`,
                bottom: `clamp(8%, ${executionScore}%, 92%)`,
                transform: 'translate(-50%, 50%)',
              }}
            >
              <div className={`w-4 h-4 rounded-full border-2 border-white shadow-lg animate-pulse ${colorStyles.marker}`} />
            </div>
          </div>
        </div>

        {/* Strategic Analysis Description */}
        <p className="text-xs text-zinc-300 leading-relaxed mb-4">
          {description}
        </p>
      </div>

      {/* Lean Startup Empirical Next Action Card */}
      <div className={`p-4 rounded-xl border leading-relaxed ${colorStyles.actionBg}`}>
        <div className="flex items-center gap-2 mb-1.5">
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <h4 className="text-xs font-bold uppercase tracking-wider font-mono">
            Lean Startup Action Recommendation
          </h4>
        </div>
        <p className="text-xs font-medium">
          {recommendedAction}
        </p>
      </div>
    </div>
  );
}
