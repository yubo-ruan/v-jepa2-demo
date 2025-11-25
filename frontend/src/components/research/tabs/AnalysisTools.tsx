"use client";

import { useState, useMemo } from "react";
import { styles } from "@/components/ui";

export function AnalysisTools() {
  const [ablationResults, setAblationResults] = useState<boolean>(false);

  // Sample ablation results
  const ablationData = useMemo(() => [
    { dataSize: "1k", loss: 0.048 },
    { dataSize: "5k", loss: 0.039 },
    { dataSize: "10k", loss: 0.033 },
    { dataSize: "25k", loss: 0.030 },
    { dataSize: "50k", loss: 0.029 },
    { dataSize: "61k", loss: 0.029 },
  ], []);

  // Sample failure cases
  const failureCases = [
    { id: 4521, task: "Pour", error: 8.3 },
    { id: 1203, task: "Push", error: 7.1 },
    { id: 892, task: "Pour", error: 6.8 },
  ];

  return (
    <div className="space-y-6">
      {/* Ablation Study */}
      <div className={styles.card}>
        <h3 className={styles.cardTitle}>Ablation Study Builder</h3>
        <p className="text-sm text-zinc-400 mb-4">
          Study the effect of different hyperparameters on model performance
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className={styles.label}>Variable</label>
            <select className={styles.input}>
              <option>Training data size</option>
              <option>Learning rate</option>
              <option>Batch size</option>
              <option>Number of epochs</option>
            </select>
          </div>
          <div>
            <label className={styles.label}>Values to test</label>
            <input
              type="text"
              defaultValue="1k, 5k, 10k, 25k, 50k, 61k"
              className={styles.input}
            />
          </div>
        </div>

        <button
          onClick={() => setAblationResults(true)}
          className={styles.buttonPrimary}
        >
          Run Ablation Study
        </button>

        {/* Ablation Results with Visualization */}
        {ablationResults && (
          <div className="mt-6 bg-zinc-900 rounded-lg p-4">
            <h4 className="text-sm font-medium text-zinc-300 mb-4">Results: Val Loss vs Data Size</h4>

            {/* Chart */}
            <svg viewBox="0 0 300 150" className="w-full h-40 mb-4">
              {/* Grid */}
              <line x1="40" y1="120" x2="280" y2="120" stroke="#3f3f46" strokeWidth="1" />
              <line x1="40" y1="20" x2="40" y2="120" stroke="#3f3f46" strokeWidth="1" />

              {/* Y-axis labels */}
              <text x="5" y="25" fill="#71717a" fontSize="8">0.05</text>
              <text x="5" y="70" fill="#71717a" fontSize="8">0.035</text>
              <text x="5" y="120" fill="#71717a" fontSize="8">0.02</text>

              {/* Data line */}
              <polyline
                fill="none"
                stroke="#6366f1"
                strokeWidth="2"
                points={ablationData.map((d, i) => {
                  const x = 40 + (i / (ablationData.length - 1)) * 240;
                  const y = 120 - ((d.loss - 0.02) / 0.03) * 100;
                  return `${x},${y}`;
                }).join(" ")}
              />

              {/* Data points */}
              {ablationData.map((d, i) => {
                const x = 40 + (i / (ablationData.length - 1)) * 240;
                const y = 120 - ((d.loss - 0.02) / 0.03) * 100;
                const isPlateau = i >= 3;
                return (
                  <g key={i}>
                    <circle
                      cx={x}
                      cy={y}
                      r={4}
                      fill={isPlateau ? "#22c55e" : "#6366f1"}
                    />
                    <text x={x} y="135" fill="#71717a" fontSize="7" textAnchor="middle">
                      {d.dataSize}
                    </text>
                  </g>
                );
              })}

              {/* Plateau indicator */}
              <line
                x1={40 + (3 / 5) * 240}
                y1="20"
                x2={40 + (3 / 5) * 240}
                y2="120"
                stroke="#22c55e"
                strokeWidth="1"
                strokeDasharray="4,4"
                opacity="0.5"
              />
              <text x={40 + (3 / 5) * 240 + 5} y="30" fill="#22c55e" fontSize="8">
                plateau
              </text>
            </svg>

            {/* Insight */}
            <div className="bg-green-600/10 border border-green-600/30 rounded-lg p-3">
              <p className="text-sm text-green-400">
                ✅ Insight: Diminishing returns after 25k trajectories. Consider using 25k for faster iteration during development.
              </p>
            </div>

            <div className="flex gap-2 mt-4">
              <button className={styles.buttonSecondary}>Export Results</button>
              <button className={styles.buttonSecondary}>Run Another Study</button>
            </div>
          </div>
        )}
      </div>

      {/* Error Analysis - Integrated with Confidence Calibration */}
      <div className={styles.card}>
        <h3 className={styles.cardTitle}>Error Analysis Dashboard</h3>
        <p className="text-sm text-zinc-400 mb-4">
          Analyze model errors and identify failure patterns
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div className="bg-zinc-900 rounded-lg p-3">
            <p className="text-xs text-zinc-500">Mean Error</p>
            <p className="text-lg font-semibold text-zinc-200">0.98cm</p>
          </div>
          <div className="bg-zinc-900 rounded-lg p-3">
            <p className="text-xs text-zinc-500">Median Error</p>
            <p className="text-lg font-semibold text-zinc-200">0.74cm</p>
          </div>
          <div className="bg-zinc-900 rounded-lg p-3">
            <p className="text-xs text-zinc-500">95th Percentile</p>
            <p className="text-lg font-semibold text-zinc-200">2.8cm</p>
          </div>
          <div className="bg-zinc-900 rounded-lg p-3">
            <p className="text-xs text-zinc-500">Max Error</p>
            <p className="text-lg font-semibold text-amber-400">8.3cm</p>
          </div>
        </div>

        {/* Error by Task Type */}
        <div className="bg-zinc-900 rounded-lg p-4 mb-4">
          <p className="text-sm text-zinc-400 mb-2">Error by Task Type:</p>
          <div className="space-y-2">
            {[
              { task: "Pick", error: 0.82, best: true },
              { task: "Place", error: 1.05 },
              { task: "Push", error: 1.24 },
              { task: "Pour", error: 1.78, worst: true },
            ].map((item) => (
              <div key={item.task} className="flex items-center gap-3">
                <span className="text-sm text-zinc-400 w-12">{item.task}</span>
                <div className="flex-1 h-2 bg-zinc-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      item.best ? "bg-green-500" : item.worst ? "bg-amber-500" : "bg-indigo-500"
                    }`}
                    style={{ width: `${(item.error / 2) * 100}%` }}
                  />
                </div>
                <span className={`text-sm w-16 text-right ${
                  item.best ? "text-green-400" : item.worst ? "text-amber-400" : "text-zinc-200"
                }`}>
                  {item.error}cm
                  {item.best && " ✅"}
                  {item.worst && " ⚠️"}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Confidence Calibration - Integrated */}
        <div className="bg-zinc-900 rounded-lg p-4 mb-4">
          <p className="text-sm text-zinc-400 mb-2">Confidence Calibration:</p>
          <div className="flex items-center gap-4 text-sm">
            <div>
              <span className="text-zinc-500">ECE:</span>
              <span className="text-green-400 ml-2 font-medium">0.042 ✅</span>
              <span className="text-zinc-500 ml-1">(well-calibrated)</span>
            </div>
          </div>
          <p className="text-xs text-zinc-500 mt-2">
            Safe to use confidence {">"}80% as threshold
          </p>
        </div>

        {/* Top Failure Cases */}
        <div className="bg-zinc-900 rounded-lg p-4 mb-4">
          <p className="text-sm text-zinc-400 mb-3">Top 3 Failure Cases:</p>
          <div className="space-y-2">
            {failureCases.map((failure, i) => (
              <div
                key={failure.id}
                className="flex items-center justify-between p-3 bg-zinc-800 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <span className="text-zinc-500 text-sm">{i + 1}.</span>
                  <div>
                    <p className="text-sm text-zinc-200">
                      Traj #{failure.id} - {failure.task} task
                    </p>
                    <p className="text-xs text-red-400">Error: {failure.error}cm</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="flex gap-1">
                    <div className="w-8 h-8 bg-zinc-700 rounded text-xs flex items-center justify-center text-zinc-500">
                      Cur
                    </div>
                    <div className="w-8 h-8 bg-zinc-700 rounded text-xs flex items-center justify-center text-zinc-500">
                      Goal
                    </div>
                    <div className="w-8 h-8 bg-zinc-700 rounded text-xs flex items-center justify-center text-zinc-500">
                      Pred
                    </div>
                  </div>
                  <button className="text-xs px-2 py-1 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded transition-colors">
                    View
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <button className={styles.buttonSecondary}>Deep Dive Analysis →</button>
      </div>
    </div>
  );
}
