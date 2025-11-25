"use client";

import { useState, useMemo } from "react";
import { styles } from "@/components/ui";
import { UploadIcon } from "@/components/icons";

export function DatasetManagement() {
  const [uploadFormat, setUploadFormat] = useState<"droid" | "custom">("droid");

  const datasets = useMemo(() => [
    {
      id: "droid-v1",
      name: "DROID v1.0",
      trajectories: 76235,
      size: "142 GB",
      status: "validated" as const,
    },
    {
      id: "custom-1",
      name: "My Custom Dataset",
      trajectories: 5000,
      size: "8.2 GB",
      status: "validated" as const,
    },
  ], []);

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <div className={styles.card}>
        <h3 className={styles.cardTitle}>Upload Dataset</h3>

        {/* Drop zone */}
        <div className="min-h-[160px] bg-zinc-900 rounded-lg border-2 border-dashed border-zinc-600 hover:border-indigo-500 hover:bg-indigo-500/5 transition-all cursor-pointer flex flex-col items-center justify-center gap-4 p-8 mb-6">
          <div className="w-14 h-14 rounded-full bg-zinc-800 flex items-center justify-center">
            <UploadIcon />
          </div>
          <div className="text-center">
            <p className="text-zinc-300 text-sm font-medium">Drag dataset folder here</p>
            <p className="text-zinc-500 text-xs mt-1">or click to browse</p>
          </div>
        </div>

        {/* Format selection - simplified: removed HuggingFace option */}
        <div className="space-y-2 mb-4">
          <p className="text-sm text-zinc-400">Select format:</p>
          <div className="space-y-2">
            {[
              { id: "droid", label: "DROID (HDF5)" },
              { id: "custom", label: "Custom (specify format)" },
            ].map((format) => (
              <label key={format.id} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="format"
                  checked={uploadFormat === format.id}
                  onChange={() => setUploadFormat(format.id as typeof uploadFormat)}
                  className={styles.radio}
                />
                <span className="text-sm text-zinc-300">{format.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <button className={styles.buttonPrimary}>Upload New Dataset</button>
          <button className={styles.buttonSecondary}>Import from URL</button>
        </div>
      </div>

      {/* Current Datasets */}
      <div className={styles.card}>
        <h3 className={styles.cardTitle}>Current Datasets</h3>
        <div className="space-y-3">
          {datasets.map((dataset) => (
            <div key={dataset.id} className="bg-zinc-900 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-green-400">✅</span>
                  <span className="text-zinc-200 font-medium">{dataset.name}</span>
                </div>
                <span className={`text-xs px-2 py-1 rounded ${
                  dataset.status === "validated"
                    ? "bg-green-600/20 text-green-400"
                    : "bg-amber-600/20 text-amber-400"
                }`}>
                  {dataset.status === "validated" ? "Validated ✅" : "Processing..."}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm text-zinc-400 mb-3">
                <div>• {dataset.trajectories.toLocaleString()} trajectories</div>
                <div>• Size: {dataset.size}</div>
              </div>
              <div className="flex gap-2">
                <button className="text-xs px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded transition-colors">
                  View Samples
                </button>
                <button className="text-xs px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded transition-colors">
                  Statistics
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
