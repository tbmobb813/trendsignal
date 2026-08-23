'use client';

import React from 'react';
import { EXECUTION_QUESTIONS, ExecutionAnswers } from '../lib/scoring/execution';

interface ExecutionQuestionnaireProps {
  answers: ExecutionAnswers;
  onAnswerSelect: (questionId: string, optionId: string) => void;
}

export function ExecutionQuestionnaire({
  answers,
  onAnswerSelect,
}: ExecutionQuestionnaireProps) {
  const answeredCount = Object.keys(answers).length;
  const totalQuestions = EXECUTION_QUESTIONS.length;

  return (
    <div className="bg-zinc-900/40 border border-zinc-800/60 backdrop-blur-xl rounded-2xl p-6 sm:p-8 shadow-lg">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 mb-6 pb-4 border-b border-zinc-800/60">
        <div>
          <h3 className="text-zinc-200 text-base font-bold flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500/10 text-blue-400 text-xs font-mono font-bold border border-blue-500/20">
              ?
            </span>
            Creator Execution-Readiness Probe
          </h3>
          <p className="text-xs text-zinc-400 mt-1">
            Score your personal edge, gear, topic depth, and interest against this market.
          </p>
        </div>
        <div className="self-start sm:self-auto bg-zinc-950/60 border border-zinc-800 rounded-full px-3 py-1 text-[11px] font-mono font-medium text-zinc-400">
          <span className="text-blue-400 font-bold">{answeredCount}</span> / {totalQuestions} Answered
        </div>
      </div>

      <div className="space-y-6">
        {EXECUTION_QUESTIONS.map((q) => {
          const selectedOptionId = answers[q.id];

          return (
            <div key={q.id} className="bg-zinc-950/40 border border-zinc-800/40 rounded-xl p-4 sm:p-5">
              <div className="mb-3">
                <h4 className="text-xs font-bold text-zinc-200 uppercase font-mono tracking-wider">
                  {q.title}
                </h4>
                <p className="text-xs text-zinc-400 mt-0.5">{q.subtitle}</p>
              </div>

              <div className="grid grid-cols-1 gap-2.5">
                {q.options.map((opt) => {
                  const isSelected = selectedOptionId === opt.id;

                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => onAnswerSelect(q.id, opt.id)}
                      className={`text-left p-3.5 rounded-xl border text-xs leading-relaxed transition-all flex items-start gap-3 ${
                        isSelected
                          ? 'bg-blue-600/10 border-blue-500/50 text-blue-200 shadow-md shadow-blue-500/5'
                          : 'bg-zinc-900/40 border-zinc-800/70 text-zinc-300 hover:bg-zinc-900 hover:border-zinc-700'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full border shrink-0 mt-0.5 flex items-center justify-center transition-colors ${
                          isSelected
                            ? 'border-blue-400 bg-blue-500'
                            : 'border-zinc-600 bg-zinc-950'
                        }`}
                      >
                        {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                      <div className="flex-1">
                        <span>{opt.label}</span>
                        <span className="ml-2 font-mono text-[10px] font-bold text-zinc-500">
                          (+{opt.points} pts)
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
