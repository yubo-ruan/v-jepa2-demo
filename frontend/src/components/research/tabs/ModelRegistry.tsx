"use client";

import { useState, useMemo } from "react";
import { styles } from "@/components/ui";

export function ModelRegistry() {
  const [selectedModels, setSelectedModels] = useState<string[]>([]);

  const models = useMemo(() => [
    {
      id: "meta-baseline",
      name: "Meta Baseline (Official)",
      pinned: true,
      model: "V-JEPA 2-AC ViT-Giant",
      source: "facebookresearch/vjepa2",
      size: "4.8 GB",
      trainedOn: "Internal Meta dataset",
      status: "available",
      benchmarks: { droid: { baseline: null, value: 0.035 }, custom: { baseline: null, value: 0.042 } },
    },
    {
      id: "droid-finetune-v1",
      name: "DROID-finetune-v1",
      best: true,
      model: "Fine-tuned ViT-Giant",
      base: "Meta Baseline",
      size: "4.8 GB",
      trainedOn: "DROID v1.0",
      training: "50 epochs, 8.2 hrs",
      valLoss: 0.031,
      status: "production",
      benchmarks: {
        droid: { baseline: 0.035, value: 0.029 },
        custom: { baseline: 0.042, value: 0.024 }
      },
      speed: { value: "4.1s", baseline: "4.2s", improvement: -2 },
      tags: ["droid", "finetune", "production"],
    },
    {
      id: "droid-finetune-v2",
      name: "DROID-finetune-v2",
      model: "Fine-tuned ViT-Giant",
      base: "Meta Baseline",
      size: "4.8 GB",
      trainedOn: "DROID v1.0 (5k subset)",
      status: "experimental",
    },
  ], []);

  const toggleSelectModel = (id: string) => {
    setSelectedModels(prev =>
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    );
  };

  // Calculate improvement percentage
  const calcImprovement = (baseline: number, value: number) => {
    return Math.round(((value - baseline) / baseline) * 100);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-zinc-200">Model Registry</h2>
        <button className={styles.buttonPrimary}>+ New Model</button>
      </div>

      {/* Search/Filter */}
      <div className="flex gap-4">
        <input
          type="text"
          placeholder="Search models..."
          className="flex-1 px-4 py-2.5 bg-zinc-800 text-white rounded-lg border border-zinc-700 outline-none text-sm placeholder-zinc-500 focus:border-indigo-500"
        />
        <select className={styles.input + " w-auto"}>
          <option>All Status</option>
          <option>Production</option>
          <option>Experimental</option>
        </select>
      </div>

      {/* Floating Compare Button - shows when 2+ selected */}
      {selectedModels.length >= 2 && (
        <div className="fixed bottom-6 right-6 z-50">
          <button className={`${styles.buttonPrimary} shadow-lg shadow-indigo-500/30`}>
            Compare Selected Models ({selectedModels.length}) →
          </button>
        </div>
      )}

      {/* Model Cards */}
      <div className="space-y-4">
        {models.map((model) => (
          <div
            key={model.id}
            className={`${styles.card} ${model.best ? "border-green-600/50" : ""} ${
              selectedModels.includes(model.id) ? "ring-2 ring-indigo-500" : ""
            }`}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-start gap-3">
                {/* Quick Compare Checkbox */}
                <label className="flex items-center cursor-pointer mt-1">
                  <input
                    type="checkbox"
                    checked={selectedModels.includes(model.id)}
                    onChange={() => toggleSelectModel(model.id)}
                    className={styles.checkbox}
                  />
                </label>
                <div>
                  <div className="flex items-center gap-2">
                    {model.pinned && <span>📌</span>}
                    {model.best && <span>⭐</span>}
                    <h3 className="text-lg font-medium text-zinc-200">{model.name}</h3>
                  </div>
                  <p className="text-sm text-zinc-400 mt-1">Model: {model.model}</p>
                </div>
              </div>
              <span className={`text-xs px-2 py-1 rounded ${
                model.status === "production"
                  ? "bg-green-600/20 text-green-400"
                  : model.status === "experimental"
                  ? "bg-amber-600/20 text-amber-400"
                  : "bg-zinc-700 text-zinc-400"
              }`}>
                {model.status}
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
              {model.source && (
                <div>
                  <span className="text-zinc-500">Source:</span>
                  <span className="text-zinc-300 ml-2">{model.source}</span>
                </div>
              )}
              {model.base && (
                <div>
                  <span className="text-zinc-500">Base:</span>
                  <span className="text-zinc-300 ml-2">{model.base}</span>
                </div>
              )}
              <div>
                <span className="text-zinc-500">Size:</span>
                <span className="text-zinc-300 ml-2">{model.size}</span>
              </div>
              {model.trainedOn && (
                <div>
                  <span className="text-zinc-500">Trained on:</span>
                  <span className="text-zinc-300 ml-2">{model.trainedOn}</span>
                </div>
              )}
            </div>

            {/* Model Size/Speed Comparison */}
            {model.speed && (
              <div className="bg-zinc-900 rounded-lg p-3 mb-4 grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-zinc-500">Size:</span>
                  <span className="text-zinc-300 ml-2">{model.size}</span>
                  <span className="text-zinc-500 text-xs ml-1">(same as baseline)</span>
                </div>
                <div>
                  <span className="text-zinc-500">Speed:</span>
                  <span className="text-zinc-300 ml-2">{model.speed.value}</span>
                  <span className={`text-xs ml-1 ${model.speed.improvement < 0 ? "text-green-400" : "text-zinc-400"}`}>
                    ({model.speed.improvement}% {model.speed.improvement < 0 ? "✅" : ""})
                  </span>
                </div>
                <div>
                  <span className="text-zinc-500">VRAM:</span>
                  <span className="text-zinc-300 ml-2">24 GB</span>
                  <span className="text-zinc-500 text-xs ml-1">(same as baseline)</span>
                </div>
              </div>
            )}

            {/* Visual Benchmark Comparison */}
            {model.benchmarks && (model.benchmarks.droid?.baseline || model.benchmarks.custom?.baseline) && (
              <div className="bg-zinc-900 rounded-lg p-4 mb-4">
                <p className="text-xs text-zinc-500 mb-3">Benchmarks:</p>
                <div className="space-y-4">
                  {/* DROID test */}
                  {model.benchmarks.droid && model.benchmarks.droid.baseline && (
                    <div>
                      <p className="text-xs text-zinc-400 mb-2">DROID test:</p>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-zinc-500 w-16">Baseline</span>
                          <div className="flex-1 h-2 bg-zinc-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-zinc-500 rounded-full"
                              style={{ width: `${(model.benchmarks.droid.baseline / 0.05) * 100}%` }}
                            />
                          </div>
                          <span className="text-xs text-zinc-400 w-12">{model.benchmarks.droid.baseline}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-zinc-500 w-16">This</span>
                          <div className="flex-1 h-2 bg-zinc-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-green-500 rounded-full"
                              style={{ width: `${(model.benchmarks.droid.value / 0.05) * 100}%` }}
                            />
                          </div>
                          <span className="text-xs text-green-400 w-12">{model.benchmarks.droid.value} ✅</span>
                        </div>
                        <div className="text-xs text-green-400 ml-16">
                          Improvement: {calcImprovement(model.benchmarks.droid.baseline, model.benchmarks.droid.value)}%
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Custom test */}
                  {model.benchmarks.custom && model.benchmarks.custom.baseline && (
                    <div>
                      <p className="text-xs text-zinc-400 mb-2">Custom test:</p>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-zinc-500 w-16">Baseline</span>
                          <div className="flex-1 h-2 bg-zinc-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-zinc-500 rounded-full"
                              style={{ width: `${(model.benchmarks.custom.baseline / 0.05) * 100}%` }}
                            />
                          </div>
                          <span className="text-xs text-zinc-400 w-12">{model.benchmarks.custom.baseline}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-zinc-500 w-16">This</span>
                          <div className="flex-1 h-2 bg-zinc-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-green-500 rounded-full"
                              style={{ width: `${(model.benchmarks.custom.value / 0.05) * 100}%` }}
                            />
                          </div>
                          <span className="text-xs text-green-400 w-12">{model.benchmarks.custom.value} ✅</span>
                        </div>
                        <div className="text-xs text-green-400 ml-16">
                          Improvement: {calcImprovement(model.benchmarks.custom.baseline, model.benchmarks.custom.value)}%
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {model.tags && (
              <div className="flex gap-2 mb-4">
                {model.tags.map((tag) => (
                  <span key={tag} className="text-xs px-2 py-1 bg-zinc-700 text-zinc-400 rounded">
                    {tag}
                  </span>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              {model.best && (
                <button className={styles.buttonSecondary}>Compare</button>
              )}
              <button className={styles.buttonPrimary}>Use in Planning</button>
              {!model.pinned && (
                <button className={styles.buttonSecondary}>Export</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
