'use client';

import React, { useState } from 'react';
import { EXECUTION_QUESTIONS, ExecutionAnswers } from '../lib/scoring/execution';

interface ExecutionQuestionnaireProps {
  answers: ExecutionAnswers;
  onAnswerSelect: (questionId: string, optionId: string) => void;
}

export function ExecutionQuestionnaire({
  answers,
  onAnswerSelect,
}: ExecutionQuestionnaireProps) {
  const [currentStep, setCurrentStep] = useState(0);

  const answeredCount = Object.keys(answers).length;
  const totalQuestions = EXECUTION_QUESTIONS.length;
  const currentQ = EXECUTION_QUESTIONS[currentStep];

  const handleSelectOption = (optionId: string) => {
    onAnswerSelect(currentQ.id, optionId);
    if (currentStep < totalQuestions - 1) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  return (
    <div className="bg-zinc-900/40 border border-zinc-800/60 backdrop-blur-xl rounded-2xl p-6 sm:p-7 shadow-lg flex flex-col justify-between">
      {/* Header & Step Counter */}
      <div>
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 mb-5 pb-4 border-b border-zinc-800/60">
          <div>
            <h3 className="text-zinc-200 text-sm font-bold flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500/10 text-blue-400 text-xs font-mono font-bold border border-blue-500/20">
                ?
              </span>
              Creator Execution Probe
            </h3>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              Question {currentStep + 1} of {totalQuestions}: {currentQ.title}
            </p>
          </div>
          <div className="self-start sm:self-auto bg-zinc-950/60 border border-zinc-800 rounded-full px-3 py-1 text-[10px] font-mono font-medium text-zinc-400">
            <span className="text-blue-400 font-bold">{answeredCount}</span> / {totalQuestions} Answered
          </div>
        </div>

        {/* Stepper Progress Bar */}
        <div className="flex items-center gap-1.5 mb-5">
          {EXECUTION_QUESTIONS.map((q, idx) => {
            const isAnswered = Boolean(answers[q.id]);
            const isCurrent = idx === currentStep;

            return (
              <button
                key={q.id}
                type="button"
                onClick={() => setCurrentStep(idx)}
                className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold font-mono transition-all border flex items-center justify-center gap-1 ${
                  isCurrent
                    ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-500/20'
                    : isAnswered
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20'
                    : 'bg-zinc-950/50 border-zinc-800 text-zinc-500 hover:text-zinc-300'
                }`}
                title={`Step ${idx + 1}: ${q.title}`}
              >
                <span>{idx + 1}</span>
                {isAnswered && <span className="text-emerald-400 font-bold">✓</span>}
              </button>
            );
          })}
        </div>

        {/* Current Question Block */}
        <div className="bg-zinc-950/40 border border-zinc-800/40 rounded-xl p-4 sm:p-5 mb-4">
          <div className="mb-3">
            <h4 className="text-xs font-bold text-zinc-200 uppercase font-mono tracking-wider">
              {currentQ.title}
            </h4>
            <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">
              {currentQ.subtitle}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-2">
            {currentQ.options.map((opt) => {
              const isSelected = answers[currentQ.id] === opt.id;

              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleSelectOption(opt.id)}
                  className={`text-left p-3 rounded-xl border text-xs leading-relaxed transition-all flex items-center justify-between gap-3 ${
                    isSelected
                      ? 'bg-blue-600/15 border-blue-500/50 text-blue-200 shadow-md shadow-blue-500/10'
                      : 'bg-zinc-900/40 border-zinc-800/70 text-zinc-300 hover:bg-zinc-900 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-3.5 h-3.5 rounded-full border shrink-0 flex items-center justify-center transition-colors ${
                        isSelected
                          ? 'border-blue-400 bg-blue-500'
                          : 'border-zinc-600 bg-zinc-950'
                      }`}
                    >
                      {isSelected && <div className="w-1 h-1 rounded-full bg-white" />}
                    </div>
                    <span className="font-medium text-xs">{opt.label}</span>
                  </div>
                  <span className="font-mono text-[10px] font-bold text-zinc-500 shrink-0">
                    +{opt.points} pts
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Stepper Footer Controls */}
      <div className="flex items-center justify-between pt-3 border-t border-zinc-800/60">
        <button
          type="button"
          onClick={() => setCurrentStep((prev) => Math.max(0, prev - 1))}
          disabled={currentStep === 0}
          className="px-3.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-zinc-400 hover:text-zinc-200 transition-all disabled:opacity-30 disabled:pointer-events-none"
        >
          &larr; Previous
        </button>

        <span className="text-[11px] font-mono text-zinc-500">
          Step {currentStep + 1} / {totalQuestions}
        </span>

        <button
          type="button"
          onClick={() => setCurrentStep((prev) => Math.min(totalQuestions - 1, prev + 1))}
          disabled={currentStep === totalQuestions - 1}
          className="px-3.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-zinc-400 hover:text-zinc-200 transition-all disabled:opacity-30 disabled:pointer-events-none"
        >
          Next &rarr;
        </button>
      </div>
    </div>
  );
}
