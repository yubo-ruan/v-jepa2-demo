"use client";

import { useState } from "react";
import { styles } from "@/components/ui";

export function TrainingMonitor() {
  const [selectedTraining, setSelectedTraining] = useState("droid-finetune-v1");

  // Sample training data
  const trainingData = {
    name: "DROID-finetune-v1",
    status: "training",
    epoch: 12,
    totalEpochs: 50,
    step: 22800,
    totalSteps: 95000,
    progress: 24,
    elapsed: "2h 34m",
    eta: "7h 26m",
    trainLoss: 0.024,
    valLoss: 0.031,
    learningRate: "8.3e-5",
    gpuUtilization: [98, 97, 99, 96],
  };

  // Sample loss history for chart
  const lossHistory = [0.08, 0.065, 0.052, 0.044, 0.038, 0.034, 0.031, 0.029, 0.027, 0.025, 0.024, 0.024];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold text-zinc-200">
            Training: {trainingData.name}
          </h2>
          <span className="text-xs px-2 py-1 bg-amber-600/20 text-amber-400 rounded">
            Training
          </span>
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors text-sm flex items-center gap-2">
            ⏸ Pause
          </button>
          <button className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm flex items-center gap-2">
            ⏹ Stop
          </button>
        </div>
      </div>

      {/* Progress */}
      <div className={styles.card}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-zinc-300">
            Epoch {trainingData.epoch} / {trainingData.totalEpochs} • Step {trainingData.step.toLocaleString()} / {trainingData.totalSteps.toLocaleString()}
          </span>
          <span className="text-indigo-400 font-medium">{trainingData.progress}%</span>
        </div>
        <div className="h-3 bg-zinc-700 rounded-full overflow-hidden mb-4">
          <div
            className="h-full bg-gradient-to-r from-indigo-600 to-purple-500 rounded-full transition-all"
            style={{ width: `${trainingData.progress}%` }}
          />
        </div>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div className="bg-zinc-900 rounded-lg p-3">
            <p className="text-zinc-500 text-xs">Elapsed</p>
            <p className="text-zinc-200 font-medium">{trainingData.elapsed}</p>
          </div>
          <div className="bg-zinc-900 rounded-lg p-3">
            <p className="text-zinc-500 text-xs">ETA</p>
            <p className="text-zinc-200 font-medium">{trainingData.eta}</p>
          </div>
          <div className="bg-zinc-900 rounded-lg p-3">
            <p className="text-zinc-500 text-xs">Learning Rate</p>
            <p className="text-zinc-200 font-medium">{trainingData.learningRate}</p>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Loss Chart */}
        <div className={styles.card}>
          <h3 className={styles.cardTitle}>Loss Curves</h3>
          <svg viewBox="0 0 200 120" className="w-full h-40">
            {/* Background grid */}
            <line x1="30" y1="100" x2="190" y2="100" stroke="#3f3f46" strokeWidth="1" />
            <line x1="30" y1="10" x2="30" y2="100" stroke="#3f3f46" strokeWidth="1" />

            {/* Loss line */}
            <polyline
              fill="none"
              stroke="#6366f1"
              strokeWidth="2"
              points={lossHistory.map((loss, i) => {
                const x = 30 + (i / (lossHistory.length - 1)) * 160;
                const y = 100 - (loss / 0.1) * 90;
                return `${x},${y}`;
              }).join(" ")}
            />

            {/* Data points */}
            {lossHistory.map((loss, i) => {
              const x = 30 + (i / (lossHistory.length - 1)) * 160;
              const y = 100 - (loss / 0.1) * 90;
              return (
                <circle
                  key={i}
                  cx={x}
                  cy={y}
                  r={i === lossHistory.length - 1 ? 4 : 2}
                  fill="#6366f1"
                  stroke={i === lossHistory.length - 1 ? "#fff" : "none"}
                  strokeWidth="2"
                />
              );
            })}

            {/* Labels */}
            <text x="5" y="15" fill="#71717a" fontSize="8">0.1</text>
            <text x="5" y="100" fill="#71717a" fontSize="8">0.0</text>
            <text x="100" y="115" fill="#71717a" fontSize="8">Epoch</text>
          </svg>
          <div className="flex justify-between text-sm mt-2">
            <div>
              <span className="text-zinc-500">Train Loss:</span>
              <span className="text-zinc-200 ml-2">{trainingData.trainLoss}</span>
            </div>
            <div>
              <span className="text-zinc-500">Val Loss:</span>
              <span className="text-green-400 ml-2">{trainingData.valLoss} (best)</span>
            </div>
          </div>
        </div>

        {/* GPU Utilization */}
        <div className={styles.card}>
          <h3 className={styles.cardTitle}>GPU Utilization</h3>
          <div className="space-y-3">
            {trainingData.gpuUtilization.map((util, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-sm text-zinc-400 w-16">GPU {i}</span>
                <div className="flex-1 h-3 bg-zinc-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${util > 90 ? "bg-green-500" : util > 70 ? "bg-yellow-500" : "bg-red-500"}`}
                    style={{ width: `${util}%` }}
                  />
                </div>
                <span className="text-sm text-zinc-200 w-12 text-right">{util}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Logs */}
      <div className={styles.card}>
        <h3 className={styles.cardTitle}>Recent Logs</h3>
        <div className="bg-zinc-900 rounded-lg p-3 font-mono text-xs text-zinc-400 space-y-1 max-h-40 overflow-y-auto">
          <div>[12:34:15] Epoch 12/50, Step 22800, Loss: 0.024</div>
          <div>[12:33:45] Validation completed, Val Loss: 0.031</div>
          <div className="text-green-400">[12:33:44] Checkpoint saved: epoch_12_best.pt</div>
          <div>[12:33:00] Epoch 12/50, Step 22700, Loss: 0.025</div>
          <div>[12:32:15] Epoch 12/50, Step 22600, Loss: 0.024</div>
        </div>
        <div className="flex gap-2 mt-4">
          <button className={styles.buttonSecondary}>View Full Logs</button>
          <button className={styles.buttonSecondary}>Download Checkpoint</button>
        </div>
      </div>
    </div>
  );
}
