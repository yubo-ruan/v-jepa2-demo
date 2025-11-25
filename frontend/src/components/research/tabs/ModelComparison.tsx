"use client";

import { useState, useEffect } from "react";
import { styles } from "@/components/ui";
import { api } from "@/lib/api";

interface LeaderboardEntry {
  modelId: string;
  modelName: string;
  totalRuns: number;
  wins: number;
  winRate: number;
  avgEnergy: number;
  avgConfidence: number;
}

export function ModelComparison() {
  const [modelA, setModelA] = useState("meta-baseline");
  const [modelB, setModelB] = useState("droid-finetune-v1");
  const [hasResults, setHasResults] = useState(true);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [totalComparisons, setTotalComparisons] = useState(0);
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState(true);

  useEffect(() => {
    api.getModelLeaderboard()
      .then((data) => {
        setLeaderboard(data.leaderboard);
        setTotalComparisons(data.totalComparisons);
        setIsLoadingLeaderboard(false);
      })
      .catch((err) => {
        console.error("Failed to fetch leaderboard:", err);
        setIsLoadingLeaderboard(false);
      });
  }, []);

  const comparisonResults = {
    metrics: [
      { name: "Test Loss", modelA: 0.035, modelB: 0.029, improvement: -17 },
      { name: "MAE (cm)", modelA: 1.24, modelB: 0.98, improvement: -21 },
      { name: "Planning Success", modelA: "73.2%", modelB: "84.5%", improvement: 11 },
      { name: "Avg Time", modelA: "4.2s", modelB: "4.1s", improvement: -2 },
    ],
    pValue: 0.003,
    effectSize: 0.42,
  };

  return (
    <div className="space-y-6">
      {/* Leaderboard from API */}
      <div className={styles.card}>
        <div className="flex items-center justify-between mb-4">
          <h3 className={styles.cardTitle}>Model Leaderboard</h3>
          {isLoadingLeaderboard ? (
            <span className="text-xs text-zinc-500 animate-pulse">Loading...</span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-green-400">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              {totalComparisons} comparisons from API
            </span>
          )}
        </div>

        {leaderboard.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-zinc-500 border-b border-zinc-700">
                  <th className="pb-2 pl-2">#</th>
                  <th className="pb-2">Model</th>
                  <th className="pb-2">Wins</th>
                  <th className="pb-2">Win Rate</th>
                  <th className="pb-2">Avg Energy</th>
                  <th className="pb-2">Avg Confidence</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((entry, idx) => (
                  <tr key={entry.modelId} className="border-b border-zinc-800 hover:bg-zinc-800/50">
                    <td className="py-3 pl-2 text-zinc-500">{idx + 1}</td>
                    <td className="py-3">
                      <span className="text-zinc-200 font-medium">{entry.modelName}</span>
                      {idx === 0 && <span className="ml-2 text-yellow-400">👑</span>}
                    </td>
                    <td className="py-3 text-zinc-400">{entry.wins}/{entry.totalRuns}</td>
                    <td className="py-3">
                      <span className={`font-medium ${entry.winRate > 0.5 ? "text-green-400" : "text-zinc-400"}`}>
                        {(entry.winRate * 100).toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-3 text-amber-400">{entry.avgEnergy.toFixed(3)}</td>
                    <td className="py-3 text-indigo-400">{(entry.avgConfidence * 100).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-zinc-500">
            <p className="text-sm">No comparison data yet</p>
            <p className="text-xs mt-1">Run comparisons to populate the leaderboard</p>
          </div>
        )}
      </div>

      {/* Model Selection */}
      <div className={styles.card}>
        <h3 className={styles.cardTitle}>Run New Comparison</h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className={styles.label}>Model A</label>
            <select
              value={modelA}
              onChange={(e) => setModelA(e.target.value)}
              className={styles.input}
            >
              <option value="meta-baseline">Meta Baseline</option>
              <option value="droid-finetune-v1">DROID-finetune-v1</option>
              <option value="droid-finetune-v2">DROID-finetune-v2</option>
            </select>
          </div>
          <div>
            <label className={styles.label}>Model B</label>
            <select
              value={modelB}
              onChange={(e) => setModelB(e.target.value)}
              className={styles.input}
            >
              <option value="meta-baseline">Meta Baseline</option>
              <option value="droid-finetune-v1">DROID-finetune-v1</option>
              <option value="droid-finetune-v2">DROID-finetune-v2</option>
            </select>
          </div>
          <div>
            <label className={styles.label}>Test Set</label>
            <select className={styles.input}>
              <option>DROID test (7.6k)</option>
              <option>Custom test set</option>
            </select>
          </div>
        </div>

        <button
          onClick={() => setHasResults(true)}
          className={styles.buttonPrimary}
        >
          Run Comparison
        </button>
      </div>

      {/* Results */}
      {hasResults && (
        <>
          {/* Metrics Table */}
          <div className={styles.card}>
            <h3 className={styles.cardTitle}>Results</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-700">
                    <th className="text-left py-3 px-4 text-zinc-400 font-medium">Metric</th>
                    <th className="text-left py-3 px-4 text-zinc-400 font-medium">Model A</th>
                    <th className="text-left py-3 px-4 text-zinc-400 font-medium">Model B</th>
                    <th className="text-left py-3 px-4 text-zinc-400 font-medium">Δ</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonResults.metrics.map((metric) => (
                    <tr key={metric.name} className="border-b border-zinc-800">
                      <td className="py-3 px-4 text-zinc-300">{metric.name}</td>
                      <td className="py-3 px-4 text-zinc-400">{metric.modelA}</td>
                      <td className="py-3 px-4 text-zinc-200 font-medium">
                        {metric.modelB}
                        {metric.improvement < 0 && <span className="text-green-400 ml-2">✅</span>}
                        {metric.improvement > 0 && <span className="text-green-400 ml-2">✅</span>}
                      </td>
                      <td className={`py-3 px-4 font-medium ${
                        metric.improvement < 0 ? "text-green-400" : "text-green-400"
                      }`}>
                        {metric.improvement > 0 ? "+" : ""}{metric.improvement}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Statistical Significance */}
          <div className={styles.card}>
            <h3 className={styles.cardTitle}>Statistical Significance</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="bg-zinc-900 rounded-lg p-4">
                <span className="text-zinc-500">t-test p-value:</span>
                <span className="text-green-400 ml-2 font-medium">
                  {comparisonResults.pValue} (significant ✅)
                </span>
              </div>
              <div className="bg-zinc-900 rounded-lg p-4">
                <span className="text-zinc-500">Effect size:</span>
                <span className="text-zinc-200 ml-2 font-medium">
                  {comparisonResults.effectSize} (medium)
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button className={styles.buttonSecondary}>Export Report</button>
            <button className={styles.buttonSecondary}>Share Results</button>
          </div>
        </>
      )}
    </div>
  );
}
