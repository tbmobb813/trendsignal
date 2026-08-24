"use client";

import { SearchResponse } from "@/lib/types";
import { ExecutionQuestionnaire } from "../ExecutionQuestionnaire";
import { MatrixQuadrant } from "../MatrixQuadrant";
import { AutomationCard, BarrierEntryCard, ThumbnailDensityCard } from "../SignalCards";
import { SubNicheBreakdown } from "../SubNicheBreakdown";

interface StrategyTabProps {
  data: SearchResponse;
  executionAnswers: Record<string, string>;
  setExecutionAnswers: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  executionResult: any;
  handleSearch: (selectedQuery: string) => void;
}

export function StrategyTab({
  data,
  executionAnswers,
  setExecutionAnswers,
  executionResult,
  handleSearch,
}: StrategyTabProps) {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ExecutionQuestionnaire
          answers={executionAnswers}
          onAnswerSelect={(qId, optId) => {
            setExecutionAnswers((prev) => ({ ...prev, [qId]: optId }));
          }}
        />
        <MatrixQuadrant
          nicheOpportunityScore={data.scoreResult.score}
          executionResult={executionResult}
        />
      </div>

      {/* Creator Feasibility & Barrier Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AutomationCard query={data.scoreResult.query} videos={data.videos} />
        <BarrierEntryCard query={data.scoreResult.query} videos={data.videos} />
        <ThumbnailDensityCard query={data.scoreResult.query} />
      </div>

      {/* Sub-Niche Decomposition & Related Angles */}
      {data.trends && (
        <SubNicheBreakdown
          relatedTop={data.trends.relatedTop}
          relatedRising={data.trends.relatedRising}
          onSubNicheSelect={(selectedQuery) => handleSearch(selectedQuery)}
        />
      )}
    </div>
  );
}
