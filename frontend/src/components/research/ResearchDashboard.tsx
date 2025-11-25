"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";
import { ResearchTab, researchTabs } from "./types";

// Lazy load tab components for better performance
const DashboardHome = dynamic(() => import("./tabs/DashboardHome").then(mod => ({ default: mod.DashboardHome })), {
  loading: () => <TabLoadingState />,
});

const DatasetManagement = dynamic(() => import("./tabs/DatasetManagement").then(mod => ({ default: mod.DatasetManagement })), {
  loading: () => <TabLoadingState />,
});

const FineTuningWizard = dynamic(() => import("./tabs/FineTuningWizard").then(mod => ({ default: mod.FineTuningWizard })), {
  loading: () => <TabLoadingState />,
});

const TrainingMonitor = dynamic(() => import("./tabs/TrainingMonitor").then(mod => ({ default: mod.TrainingMonitor })), {
  loading: () => <TabLoadingState />,
});

const ModelRegistry = dynamic(() => import("./tabs/ModelRegistry").then(mod => ({ default: mod.ModelRegistry })), {
  loading: () => <TabLoadingState />,
});

const ModelComparison = dynamic(() => import("./tabs/ModelComparison").then(mod => ({ default: mod.ModelComparison })), {
  loading: () => <TabLoadingState />,
});

const BenchmarkSuite = dynamic(() => import("./tabs/BenchmarkSuite").then(mod => ({ default: mod.BenchmarkSuite })), {
  loading: () => <TabLoadingState />,
});

const AnalysisTools = dynamic(() => import("./tabs/AnalysisTools").then(mod => ({ default: mod.AnalysisTools })), {
  loading: () => <TabLoadingState />,
});

// Loading state component
function TabLoadingState() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="flex items-center gap-3">
        <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-zinc-400 text-sm">Loading...</span>
      </div>
    </div>
  );
}

interface ResearchDashboardProps {
  activeTab: ResearchTab;
  onTabChange: (tab: ResearchTab) => void;
}

// Re-export types for consumers
export type { ResearchTab };

export function ResearchDashboard({ activeTab, onTabChange }: ResearchDashboardProps) {
  return (
    <div className="space-y-6">
      {/* Sub-navigation tabs */}
      <div className="flex gap-1 bg-zinc-800 p-1 rounded-lg overflow-x-auto">
        {researchTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`px-3 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap flex items-center gap-2 ${
              activeTab === tab.id
                ? "bg-zinc-700 text-white"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content with Suspense boundaries */}
      <Suspense fallback={<TabLoadingState />}>
        {activeTab === "dashboard" && (
          <DashboardHome onNavigate={onTabChange} />
        )}

        {activeTab === "datasets" && (
          <DatasetManagement />
        )}

        {activeTab === "finetune" && (
          <FineTuningWizard />
        )}

        {activeTab === "training" && (
          <TrainingMonitor />
        )}

        {activeTab === "models" && (
          <ModelRegistry />
        )}

        {activeTab === "compare" && (
          <ModelComparison />
        )}

        {activeTab === "benchmarks" && (
          <BenchmarkSuite />
        )}

        {activeTab === "analysis" && (
          <AnalysisTools />
        )}
      </Suspense>
    </div>
  );
}
