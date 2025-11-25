"use client";

import { useMemo } from "react";
import { styles } from "@/components/ui";

export function BenchmarkSuite() {
  const benchmarks = useMemo(() => [
    {
      id: "droid-standard",
      name: "DROID Standard Test",
      description: "7,635 trajectories from DROID v1.0",
      status: "ready",
      estTime: "45 minutes",
      estCost: "$12.50",
    },
    {
      id: "pick-place",
      name: "Pick & Place Suite",
      description: "50 curated pick-and-place scenarios",
      status: "configure",
      estTime: "15 minutes",
      estCost: "$2.50",
    },
    {
      id: "robustness",
      name: "Robustness Test",
      description: "Test with perturbations, noise",
      status: "configure",
      estTime: "30 minutes",
      estCost: "$5.00",
    },
  ], []);

  const leaderboard = [
    { rank: "🥇", model: "DROID-finetune-v1", loss: 0.029, mae: 0.98, success: "84.5%", trend: "─" },
    { rank: "🥈", model: "DROID-finetune-v2", loss: 0.031, mae: 1.05, success: "81.2%", trend: "↑2" },
    { rank: "🥉", model: "Meta Baseline", loss: 0.035, mae: 1.24, success: "73.2%", trend: "↓1" },
  ];

  return (
    <div className="space-y-6">
      {/* Available Benchmarks */}
      <div className={styles.card}>
        <h3 className={styles.cardTitle}>Available Benchmarks</h3>
        <div className="space-y-3">
          {benchmarks.map((benchmark) => (
            <div key={benchmark.id} className="bg-zinc-900 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={benchmark.status === "ready" ? "text-green-400" : "text-zinc-500"}>
                    {benchmark.status === "ready" ? "✅" : "☐"}
                  </span>
                  <span className="text-zinc-200 font-medium">{benchmark.name}</span>
                </div>
                <span className={`text-xs px-2 py-1 rounded ${
                  benchmark.status === "ready"
                    ? "bg-green-600/20 text-green-400"
                    : "bg-zinc-700 text-zinc-400"
                }`}>
                  {benchmark.status === "ready" ? "Ready" : "Configure required"}
                </span>
              </div>
              <p className="text-sm text-zinc-400 mb-2">{benchmark.description}</p>
              {/* Status/Progress Info */}
              <div className="flex gap-4 text-xs text-zinc-500 mb-3">
                <span>Est. time: {benchmark.estTime}</span>
                <span>Est. cost: {benchmark.estCost}</span>
              </div>
              <div className="flex gap-2">
                {benchmark.status === "configure" && (
                  <>
                    <button className="text-xs px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded transition-colors">
                      Configure
                    </button>
                    <button className="text-xs px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded transition-colors">
                      Learn More
                    </button>
                  </>
                )}
                <button className={`text-xs px-3 py-1.5 rounded transition-colors ${
                  benchmark.status === "ready"
                    ? "bg-indigo-600 hover:bg-indigo-500 text-white"
                    : "bg-zinc-700 text-zinc-500 cursor-not-allowed"
                }`}>
                  Run
                </button>
              </div>
            </div>
          ))}
        </div>
        {/* Replaced "Create New Benchmark" with documentation link */}
        <div className="mt-4 p-3 bg-zinc-900 rounded-lg">
          <p className="text-sm text-zinc-400 mb-2">Need custom benchmarks?</p>
          <div className="flex gap-2">
            <button className="text-xs px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded transition-colors">
              View Documentation
            </button>
            <button className="text-xs px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded transition-colors">
              Request Feature
            </button>
          </div>
        </div>
      </div>

      {/* Leaderboard */}
      <div className={styles.card}>
        <div className="flex items-center justify-between mb-4">
          <h3 className={styles.cardTitle}>Leaderboard: DROID Standard Test</h3>
          <div className="flex gap-2">
            <button className="text-xs px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded transition-colors flex items-center gap-1">
              📊 Export CSV
            </button>
            <button className="text-xs px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded transition-colors flex items-center gap-1">
              📤 Share Link
            </button>
            <button className="text-xs px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded transition-colors flex items-center gap-1">
              🖼️ Save PNG
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-700">
                <th className="text-left py-3 px-4 text-zinc-400 font-medium">Rank</th>
                <th className="text-left py-3 px-4 text-zinc-400 font-medium">Model</th>
                <th className="text-left py-3 px-4 text-zinc-400 font-medium">Loss</th>
                <th className="text-left py-3 px-4 text-zinc-400 font-medium">MAE</th>
                <th className="text-left py-3 px-4 text-zinc-400 font-medium">Success</th>
                <th className="text-left py-3 px-4 text-zinc-400 font-medium">Δ</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((entry, i) => (
                <tr key={i} className="border-b border-zinc-800">
                  <td className="py-3 px-4 text-xl">{entry.rank}</td>
                  <td className="py-3 px-4 text-zinc-200 font-medium">{entry.model}</td>
                  <td className="py-3 px-4 text-zinc-300">{entry.loss}</td>
                  <td className="py-3 px-4 text-zinc-300">{entry.mae}</td>
                  <td className="py-3 px-4 text-zinc-300">{entry.success}</td>
                  <td className={`py-3 px-4 ${
                    entry.trend.includes("↑") ? "text-green-400" :
                    entry.trend.includes("↓") ? "text-red-400" : "text-zinc-500"
                  }`}>
                    {entry.trend}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button className={`${styles.buttonSecondary} mt-4`}>View Details</button>
      </div>
    </div>
  );
}
