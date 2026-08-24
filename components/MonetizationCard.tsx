'use client';

import React from 'react';
import { getMonetizationBenchmark } from '../lib/scoring/monetization';

interface MonetizationCardProps {
  query: string;
}

export function MonetizationCard({ query }: MonetizationCardProps) {
  const { benchmark, matchedBy, matchedKeyword } = getMonetizationBenchmark(query);

  const tierBadgeStyles = {
    HIGH: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
    MEDIUM: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
    LOW: 'bg-zinc-800 border-zinc-700 text-zinc-400',
  }[benchmark.cpmTier];

  return (
    <div className="bg-zinc-950/50 p-5 rounded-xl border border-zinc-800/40 flex flex-col justify-between h-full">
      <div>
        <div className="flex justify-between items-start gap-2 mb-2">
          <span className="text-zinc-500 text-[10px] font-bold font-mono tracking-wider uppercase block">
            Monetization & RPM Potential <span className="text-amber-500/80 font-normal">(&bull; Keyword Estimate)</span>
          </span>
          <span className={`px-2 py-0.5 rounded-md border text-[10px] font-mono font-bold ${tierBadgeStyles}`}>
            {benchmark.cpmTier} CPM
          </span>
        </div>

        <div className="text-xl font-extrabold text-white font-mono tracking-tight mb-1">
          {benchmark.rpmRange}
          <span className="text-xs text-zinc-500 font-sans font-normal ml-1">/ 1k views</span>
        </div>

        <span className="text-xs font-semibold text-zinc-300 block mb-2">
          {benchmark.category}
        </span>
      </div>

      <div className="pt-3 border-t border-zinc-800/40 text-[11px] text-zinc-400 leading-relaxed">
        <span className="font-bold text-zinc-300 block mb-0.5">Primary Revenue Drivers:</span>
        <span>{benchmark.affiliatePotential}</span>
        {matchedBy === 'keyword' && matchedKeyword && (
          <span className="text-[10px] font-mono text-zinc-500 block mt-1.5">
            Matched via keyword: &ldquo;{matchedKeyword}&rdquo;
          </span>
        )}
      </div>
    </div>
  );
}
