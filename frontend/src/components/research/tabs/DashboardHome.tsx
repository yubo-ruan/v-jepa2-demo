"use client";

import { styles } from "@/components/ui";
import {
  ResearchTab,
  quickActions,
  activeTrainings,
  recentResults,
  modelsSummary,
  datasetsSummary,
} from "../types";

interface DashboardHomeProps {
  onNavigate: (tab: ResearchTab) => void;
}

export function DashboardHome({ onNavigate }: DashboardHomeProps) {
  return (
    <div className="space-y-6">
      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {quickActions.map((action) => (
          <button
            key={action.id}
            onClick={() => onNavigate(action.tab)}
            className="bg-zinc-800 hover:bg-zinc-750 border border-zinc-700 hover:border-zinc-600 rounded-xl p-4 text-center transition-all hover:scale-[1.02] active:scale-[0.98] group"
          >
            <div className="text-3xl mb-2">{action.icon}</div>
            <span className="text-sm text-zinc-300 group-hover:text-white transition-colors">
              {action.label}
            </span>
          </button>
        ))}
      </div>

      {/* Active Training */}
      <div className={styles.card}>
        <h3 className={styles.cardTitle}>Active Training</h3>
        {activeTrainings.length > 0 ? (
          <div className="space-y-3">
            {activeTrainings.map((training) => (
              <div
                key={training.id}
                className="bg-zinc-900 rounded-lg p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-zinc-200 font-medium">{training.name}</span>
                  <span className="text-xs px-2 py-1 bg-amber-600/20 text-amber-400 rounded">
                    Training
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="h-2 bg-zinc-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-600 to-purple-500 rounded-full transition-all"
                        style={{ width: `${training.progress}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-sm text-zinc-400">{training.progress}%</span>
                  <span className="text-sm text-zinc-500">ETA: {training.eta}</span>
                </div>
                <button
                  onClick={() => onNavigate("training")}
                  className="mt-3 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  View Details →
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-zinc-500">
            <p className="text-sm">No active training jobs</p>
            <button
              onClick={() => onNavigate("finetune")}
              className="mt-2 text-xs text-indigo-400 hover:text-indigo-300"
            >
              Start a new training →
            </button>
          </div>
        )}
      </div>

      {/* Recent Results & Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Recent Results */}
        <div className={styles.card}>
          <h3 className={styles.cardTitle}>Recent Results</h3>
          <div className="space-y-2">
            {recentResults.map((result) => (
              <div
                key={result.id}
                className="flex items-center gap-2 text-sm"
              >
                {result.success === true && (
                  <span className="text-green-400">✅</span>
                )}
                {result.success === false && (
                  <span className="text-red-400">❌</span>
                )}
                {result.success === null && (
                  <span className="text-zinc-500">○</span>
                )}
                <span className="text-zinc-300">{result.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Model Registry Summary */}
        <div className={styles.card}>
          <h3 className={styles.cardTitle}>Model Registry</h3>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-semibold text-zinc-200">
                {modelsSummary.total}
              </p>
              <p className="text-xs text-zinc-500">models available</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-semibold text-green-400">
                {modelsSummary.production}
              </p>
              <p className="text-xs text-zinc-500">in production ⭐</p>
            </div>
          </div>
          <button
            onClick={() => onNavigate("models")}
            className="mt-4 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            View All Models →
          </button>
        </div>
      </div>

      {/* Datasets Summary */}
      <div className={styles.card}>
        <h3 className={styles.cardTitle}>Datasets</h3>
        <div className="space-y-2">
          {datasetsSummary.map((dataset, i) => (
            <div
              key={i}
              className="flex items-center justify-between py-2 border-b border-zinc-700 last:border-0"
            >
              <div className="flex items-center gap-2">
                <span className="text-green-400">✅</span>
                <span className="text-zinc-200">{dataset.name}</span>
              </div>
              <span className="text-sm text-zinc-400">
                {dataset.trajectories} trajectories
              </span>
            </div>
          ))}
        </div>
        <button
          onClick={() => onNavigate("datasets")}
          className="mt-4 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          Manage Datasets →
        </button>
      </div>
    </div>
  );
}
