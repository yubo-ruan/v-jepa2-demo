"use client";

import { useState } from "react";
import { styles } from "@/components/ui";

export function ModelComparison() {
  const [modelA, setModelA] = useState("meta-baseline");
  const [modelB, setModelB] = useState("droid-finetune-v1");
  const [hasResults, setHasResults] = useState(true);

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
      {/* Model Selection */}
      <div className={styles.card}>
        <h3 className={styles.cardTitle}>Model Comparison</h3>

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
