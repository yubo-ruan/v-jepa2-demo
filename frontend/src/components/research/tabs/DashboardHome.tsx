"use client";

import { useState, useEffect } from "react";
import { styles } from "@/components/ui";
import { api } from "@/lib/api";
import {
  ResearchTab,
  quickActions,
  activeTrainings,
  recentResults,
  modelsSummary,
  datasetsSummary,
} from "../types";

interface UsageSummary {
  totalPlans: number;
  totalExperiments: number;
  avgPlanningTimeSeconds: number;
  avgConfidence: number;
  avgEnergy: number;
  modelsUsed: Record<string, number>;
}

interface ModelPerformance {
  modelId: string;
  modelName: string;
  totalInferences: number;
  avgInferenceTimeMs: number;
  avgEnergy: number;
  avgConfidence: number;
  successRate: number;
}

interface DashboardHomeProps {
  onNavigate: (tab: ResearchTab) => void;
}

export function DashboardHome({ onNavigate }: DashboardHomeProps) {
  const [analytics, setAnalytics] = useState<UsageSummary | null>(null);
  const [modelPerformance, setModelPerformance] = useState<ModelPerformance[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.getUsageSummary(30),
      api.getModelPerformance(),
    ])
      .then(([summary, performance]) => {
        setAnalytics(summary);
        setModelPerformance(performance);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch analytics:", err);
        setIsLoading(false);
      });
  }, []);

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

      {/* Analytics Summary from API */}
      <div className={styles.card}>
        <div className="flex items-center justify-between mb-4">
          <h3 className={styles.cardTitle}>Usage Analytics (Last 30 Days)</h3>
          {isLoading && (
            <span className="text-xs text-zinc-500 animate-pulse">Loading from API...</span>
          )}
          {!isLoading && analytics && (
            <span className="flex items-center gap-1 text-xs text-green-400">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              Live from API
            </span>
          )}
        </div>

        {analytics ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-zinc-900 rounded-lg p-4">
              <p className="text-2xl font-semibold text-zinc-200">{analytics.totalPlans}</p>
              <p className="text-xs text-zinc-500">Total Plans</p>
            </div>
            <div className="bg-zinc-900 rounded-lg p-4">
              <p className="text-2xl font-semibold text-zinc-200">{analytics.totalExperiments}</p>
              <p className="text-xs text-zinc-500">Experiments</p>
            </div>
            <div className="bg-zinc-900 rounded-lg p-4">
              <p className="text-2xl font-semibold text-indigo-400">{(analytics.avgConfidence * 100).toFixed(1)}%</p>
              <p className="text-xs text-zinc-500">Avg Confidence</p>
            </div>
            <div className="bg-zinc-900 rounded-lg p-4">
              <p className="text-2xl font-semibold text-amber-400">{analytics.avgPlanningTimeSeconds.toFixed(1)}s</p>
              <p className="text-xs text-zinc-500">Avg Planning Time</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-zinc-900 rounded-lg p-4 animate-pulse">
                <div className="h-8 bg-zinc-800 rounded mb-2" />
                <div className="h-3 bg-zinc-800 rounded w-20" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Model Performance from API */}
      {modelPerformance.length > 0 && (
        <div className={styles.card}>
          <h3 className={styles.cardTitle}>Model Performance (from API)</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-zinc-500 border-b border-zinc-700">
                  <th className="pb-2">Model</th>
                  <th className="pb-2">Inferences</th>
                  <th className="pb-2">Avg Time</th>
                  <th className="pb-2">Avg Confidence</th>
                  <th className="pb-2">Success Rate</th>
                </tr>
              </thead>
              <tbody>
                {modelPerformance.map((model) => (
                  <tr key={model.modelId} className="border-b border-zinc-800">
                    <td className="py-2 text-zinc-200 font-medium">{model.modelName}</td>
                    <td className="py-2 text-zinc-400">{model.totalInferences}</td>
                    <td className="py-2 text-zinc-400">{model.avgInferenceTimeMs.toFixed(0)}ms</td>
                    <td className="py-2 text-indigo-400">{(model.avgConfidence * 100).toFixed(1)}%</td>
                    <td className="py-2 text-green-400">{(model.successRate * 100).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
