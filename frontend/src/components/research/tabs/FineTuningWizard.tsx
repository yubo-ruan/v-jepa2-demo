"use client";

import { useState } from "react";
import { styles } from "@/components/ui";
import { RocketIcon } from "@/components/icons";

export function FineTuningWizard() {
  const [step, setStep] = useState(1);
  const [baseModel, setBaseModel] = useState("meta-baseline");
  const [freezeLayers, setFreezeLayers] = useState("encoder");
  const [dataset, setDataset] = useState("droid-v1");
  const [batchSize, setBatchSize] = useState(32);
  const [epochs, setEpochs] = useState(50);

  // Simplified to 3 steps (user feedback)
  const steps = ["Model & Data", "Training Config", "Advanced"];

  return (
    <div className="space-y-6">
      {/* Progress Steps - simplified to 3 */}
      <div className="flex items-center justify-center gap-2">
        {steps.map((stepName, i) => (
          <div key={i} className="flex items-center">
            <button
              onClick={() => setStep(i + 1)}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
                step === i + 1
                  ? "bg-indigo-600 text-white"
                  : step > i + 1
                  ? "bg-green-600 text-white"
                  : "bg-zinc-700 text-zinc-400"
              }`}
            >
              {step > i + 1 ? "✓" : i + 1}
            </button>
            <span className={`ml-2 text-sm ${step === i + 1 ? "text-zinc-200" : "text-zinc-500"}`}>
              {stepName}
            </span>
            {i < steps.length - 1 && (
              <div className={`w-12 h-0.5 mx-2 ${step > i + 1 ? "bg-green-600" : "bg-zinc-700"}`} />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Model & Data (merged from Base Model + Dataset) */}
      {step === 1 && (
        <div className={styles.card}>
          <h3 className={styles.cardTitle}>Model & Data Selection</h3>

          <div className="space-y-4 mb-6">
            <p className="text-sm text-zinc-400">Pretrained Model:</p>
            {[
              { id: "meta-baseline", label: "Meta V-JEPA 2-AC ViT-Giant (baseline)", recommended: true },
              { id: "previous", label: "My previous fine-tuned model" },
              { id: "scratch", label: "Start from scratch (not recommended)", warning: true },
            ].map((model) => (
              <label key={model.id} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="baseModel"
                  checked={baseModel === model.id}
                  onChange={() => setBaseModel(model.id)}
                  className={styles.radio}
                />
                <span className={`text-sm ${model.warning ? "text-amber-400" : "text-zinc-300"}`}>
                  {model.label}
                  {model.recommended && <span className="ml-2 text-amber-400">⭐</span>}
                </span>
              </label>
            ))}
          </div>

          <div className="space-y-4 mb-6">
            <p className="text-sm text-zinc-400">Freeze Layers:</p>
            {[
              { id: "none", label: "None (train all layers)" },
              { id: "encoder", label: "Encoder only (freeze predictor)", recommended: true },
              { id: "first-n", label: "First N layers" },
              { id: "custom", label: "Custom layer selection" },
            ].map((option) => (
              <label key={option.id} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="freezeLayers"
                  checked={freezeLayers === option.id}
                  onChange={() => setFreezeLayers(option.id)}
                  className={styles.radio}
                />
                <span className="text-sm text-zinc-300">
                  {option.label}
                  {option.recommended && <span className="ml-2 text-amber-400">⭐</span>}
                </span>
              </label>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className={styles.label}>Dataset</label>
              <select
                value={dataset}
                onChange={(e) => setDataset(e.target.value)}
                className={styles.input}
              >
                <option value="droid-v1">DROID v1.0 (76k trajectories)</option>
                <option value="custom">My Custom Dataset (5k trajectories)</option>
              </select>
            </div>
            <div>
              <label className={styles.label}>Data Split</label>
              <select className={styles.input}>
                <option>80/10/10 (train/val/test)</option>
                <option>70/15/15</option>
                <option>90/5/5</option>
              </select>
            </div>
          </div>

          <button
            onClick={() => setStep(2)}
            className={styles.buttonPrimary}
          >
            Next: Training Config →
          </button>
        </div>
      )}

      {/* Step 2: Training Config (merged Training + Optimization) */}
      {step === 2 && (
        <div className={styles.card}>
          <h3 className={styles.cardTitle}>Training Configuration</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-zinc-400">Batch Size (per GPU)</span>
                <span className="text-zinc-200 font-medium">{batchSize}</span>
              </div>
              <input
                type="range"
                min="8"
                max="128"
                step="8"
                value={batchSize}
                onChange={(e) => setBatchSize(Number(e.target.value))}
                className={styles.slider}
              />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-zinc-400">Num Epochs</span>
                <span className="text-zinc-200 font-medium">{epochs}</span>
              </div>
              <input
                type="range"
                min="10"
                max="100"
                step="5"
                value={epochs}
                onChange={(e) => setEpochs(Number(e.target.value))}
                className={styles.slider}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className={styles.label}>Optimizer</label>
              <select className={styles.input}>
                <option>AdamW</option>
                <option>Adam</option>
                <option>SGD</option>
              </select>
            </div>
            <div>
              <label className={styles.label}>Initial Learning Rate</label>
              <select className={styles.input}>
                <option>1e-4</option>
                <option>5e-5</option>
                <option>1e-5</option>
              </select>
            </div>
          </div>

          <div className="mb-6">
            <p className="text-sm text-zinc-400 mb-3">Learning Rate Schedule:</p>
            <div className="space-y-2">
              {["Fixed", "Cosine decay", "Step decay"].map((schedule, i) => (
                <label key={schedule} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="schedule"
                    defaultChecked={i === 1}
                    className={styles.radio}
                  />
                  <span className="text-sm text-zinc-300">{schedule}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="mb-6">
            <p className="text-sm text-zinc-400 mb-3">Data Augmentation:</p>
            <div className="grid grid-cols-2 gap-2">
              {["Random crops", "Color jittering", "Random rotations (±15°)", "Gaussian noise"].map((aug, i) => (
                <label key={aug} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    defaultChecked={i < 3}
                    className={styles.checkbox}
                  />
                  <span className="text-sm text-zinc-300">{aug}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="bg-zinc-900 rounded-lg p-4 mb-6">
            <h4 className="text-sm font-medium text-zinc-300 mb-3">Hardware</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-zinc-500">GPUs:</span>
                <span className="text-zinc-200 ml-2">4 × A100 80GB</span>
              </div>
              <div>
                <span className="text-zinc-500">Est. Time:</span>
                <span className="text-zinc-200 ml-2">~8-12 hours</span>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={() => setStep(1)} className={styles.buttonSecondary}>
              ← Back
            </button>
            <button onClick={() => setStep(3)} className={styles.buttonPrimary}>
              Next: Advanced →
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Advanced + Summary */}
      {step === 3 && (
        <div className="space-y-6">
          <div className={styles.card}>
            <h3 className={styles.cardTitle}>Advanced Configuration (Optional)</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <p className="text-sm text-zinc-400 mb-3">Checkpointing:</p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-zinc-300">Save every:</span>
                    <input type="number" defaultValue="500" className="w-20 px-2 py-1 bg-zinc-700 text-white rounded text-sm" />
                    <span className="text-sm text-zinc-400">steps</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-zinc-300">Keep best:</span>
                    <input type="number" defaultValue="5" className="w-16 px-2 py-1 bg-zinc-700 text-white rounded text-sm" />
                    <span className="text-sm text-zinc-400">checkpoints</span>
                  </div>
                </div>
              </div>
              <div>
                <p className="text-sm text-zinc-400 mb-3">Early Stopping:</p>
                <label className="flex items-center gap-2 cursor-pointer mb-2">
                  <input type="checkbox" defaultChecked className={styles.checkbox} />
                  <span className="text-sm text-zinc-300">Enabled</span>
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-zinc-300">Patience:</span>
                  <input type="number" defaultValue="10" className="w-16 px-2 py-1 bg-zinc-700 text-white rounded text-sm" />
                  <span className="text-sm text-zinc-400">epochs</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-zinc-900 rounded-lg p-3">
                <label className={styles.label}>Warmup Steps</label>
                <input type="text" defaultValue="500" className={styles.input} />
              </div>
              <div className="bg-zinc-900 rounded-lg p-3">
                <label className={styles.label}>Weight Decay</label>
                <input type="text" defaultValue="0.01" className={styles.input} />
              </div>
              <div className="bg-zinc-900 rounded-lg p-3">
                <label className={styles.label}>Gradient Clip</label>
                <input type="text" defaultValue="1.0" className={styles.input} />
              </div>
            </div>

            <div className="mb-6">
              <p className="text-sm text-zinc-400 mb-3">Logging:</p>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" defaultChecked className={styles.checkbox} />
                  <span className="text-sm text-zinc-300">TensorBoard</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" defaultChecked className={styles.checkbox} />
                  <span className="text-sm text-zinc-300">Weights & Biases</span>
                </label>
              </div>
            </div>

            <div>
              <label className={styles.label}>Experiment Name</label>
              <input
                type="text"
                defaultValue="DROID-finetune-v1"
                className="w-full md:w-64 px-4 py-2.5 bg-zinc-700 text-white rounded-lg border-none outline-none text-sm"
              />
            </div>
          </div>

          {/* Summary Card */}
          <div className={`${styles.card} border-indigo-600/50`}>
            <h3 className={styles.cardTitle}>Training Configuration Summary</h3>

            <div className="space-y-2 mb-6 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-green-400">✓</span>
                <span className="text-zinc-300">Base Model: Meta V-JEPA 2-AC ViT-Giant</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-green-400">✓</span>
                <span className="text-zinc-300">Dataset: DROID v1.0 (61k train, 7.6k val)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-green-400">✓</span>
                <span className="text-zinc-300">Epochs: {epochs} (~{Math.round(epochs * 1900)} steps)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-green-400">✓</span>
                <span className="text-zinc-300">Batch Size: {batchSize} × 4 GPUs = {batchSize * 4} effective</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-green-400">✓</span>
                <span className="text-zinc-300">Learning Rate: 1e-4 with cosine decay</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-green-400">✓</span>
                <span className="text-zinc-300">Estimated Time: 8-12 hours</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-green-400">✓</span>
                <span className="text-zinc-300">Estimated Cost: $35-50</span>
              </div>
            </div>

            <div className="bg-amber-600/10 border border-amber-600/30 rounded-lg p-3 mb-6">
              <p className="text-sm text-amber-400">
                ⚠️ Warning: This will use significant compute. Make sure GPU instance is running.
              </p>
            </div>

            <div className="flex gap-2">
              <button onClick={() => setStep(2)} className={styles.buttonSecondary}>
                ← Back
              </button>
              <button className={styles.buttonSecondary}>
                Export Config
              </button>
              <button className={`${styles.buttonPrimary} flex items-center gap-2`}>
                <RocketIcon className="w-4 h-4" />
                Start Training
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
