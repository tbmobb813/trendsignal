'use client';

import React from 'react';
import { RelatedQueryItem } from '../lib/trends';

interface SubNicheBreakdownProps {
  relatedTop?: RelatedQueryItem[];
  relatedRising?: RelatedQueryItem[];
  onSubNicheSelect: (query: string) => void;
}

export function SubNicheBreakdown({
  relatedTop = [],
  relatedRising = [],
  onSubNicheSelect,
}: SubNicheBreakdownProps) {
  const hasRising = relatedRising.length > 0;
  const hasTop = relatedTop.length > 0;

  if (!hasRising && !hasTop) {
    return null;
  }

  return (
    <div className="bg-zinc-900/35 border border-zinc-800/60 backdrop-blur-xl rounded-2xl p-6 sm:p-8 shadow-lg">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 mb-6 pb-4 border-b border-zinc-800/60">
        <div>
          <h3 className="text-zinc-400 text-xs font-bold font-mono tracking-wider uppercase flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            Sub-Niche Decomposition & Related Angles
          </h3>
          <span className="text-[10px] text-zinc-500 font-mono mt-1 block">
            Click any sub-angle to trigger a 1-click deep-dive search
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 1. Rising & Breakout Queries */}
        {hasRising && (
          <div className="bg-zinc-950/40 border border-zinc-800/40 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-amber-400 text-sm">🔥</span>
              <h4 className="text-xs font-bold text-zinc-200 uppercase font-mono tracking-wider">
                Rising & Breakout Angles
              </h4>
            </div>
            <div className="flex flex-wrap gap-2">
              {relatedRising.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onSubNicheSelect(item.query)}
                  className="group px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 hover:border-amber-400 text-xs font-medium text-amber-200 hover:text-white transition-all flex items-center gap-2 shadow-sm"
                >
                  <span>{item.query}</span>
                  <span className="px-1.5 py-0.5 rounded-md bg-amber-500/20 text-[10px] font-mono font-bold text-amber-300 group-hover:bg-amber-500 group-hover:text-black transition-colors">
                    {item.value}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 2. Top Established Related Queries */}
        {hasTop && (
          <div className="bg-zinc-950/40 border border-zinc-800/40 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-blue-400 text-sm">🏆</span>
              <h4 className="text-xs font-bold text-zinc-200 uppercase font-mono tracking-wider">
                Established Top Queries
              </h4>
            </div>
            <div className="flex flex-wrap gap-2">
              {relatedTop.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onSubNicheSelect(item.query)}
                  className="group px-3 py-2 rounded-xl bg-zinc-900/60 border border-zinc-800 hover:border-blue-500/50 text-xs font-medium text-zinc-300 hover:text-white transition-all flex items-center gap-2 shadow-sm"
                >
                  <span>{item.query}</span>
                  <span className="px-1.5 py-0.5 rounded-md bg-zinc-800 text-[10px] font-mono font-bold text-zinc-400 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                    {item.value}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
