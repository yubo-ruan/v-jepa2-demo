"use client";

import { useMemo } from "react";
import {
  CameraIcon,
  TargetIcon,
  HelpIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  RocketIcon,
  PauseIcon,
  StopIcon,
  EyeIcon,
  ExportIcon,
  CompareIcon,
  ResultsIcon,
} from "@/components/icons";
import { EnergyLandscape, IterationReplay } from "@/components/visualizations";
import { styles } from "@/components/ui";
import { usePlanning } from "@/contexts";
import { planningPresets } from "@/constants";

export function UploadPage() {
  const {
    planningState,
    setPreset,
    setSamples,
    setIterations,
    setCurrentImage,
    setGoalImage,
    startPlanning,
    cancelPlanning,
    completePlanning,
    reset,
    canGenerate,
    estimatedTime,
    estimatedCost,
  } = usePlanning();

  const { preset, samples, iterations, currentImage, goalImage, hasResults, isProcessing, progress, result, error } = planningState;

  // Use real energy history from result, or build from progress updates
  const convergenceData = useMemo(() => {
    if (result?.energyHistory && result.energyHistory.length > 0) {
      return result.energyHistory;
    }
    // Default mock data for display
    return [8, 6.5, 5.2, 4.1, 3.5, 3.1, 2.8, 2.6, 2.5, 2.45];
  }, [result?.energyHistory]);

  const getBarColor = (progressRatio: number) => {
    if (progressRatio < 0.5) return "from-red-500 to-orange-400";
    if (progressRatio < 0.8) return "from-yellow-500 to-lime-400";
    return "from-green-500 to-emerald-400";
  };

  // Format seconds to mm:ss
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Calculate progress percentage
  const progressPercent = progress ? Math.round((progress.iteration / progress.totalIterations) * 100) : 0;

  return (
    <>
      {/* Current / Goal Display */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-zinc-800 rounded-xl border border-zinc-700 p-6">
          <h3 className="text-base font-semibold text-zinc-300 mb-4">Where you are now</h3>
          <div className="min-h-[200px] bg-zinc-900 rounded-lg border-2 border-dashed border-zinc-600 hover:border-indigo-500 hover:bg-indigo-500/5 transition-all cursor-pointer flex flex-col items-center justify-center gap-4 group p-8">
            <div className="w-14 h-14 rounded-full bg-zinc-800 group-hover:bg-indigo-500/20 transition-colors flex items-center justify-center">
              <CameraIcon className="group-hover:text-indigo-400" />
            </div>
            <div className="text-center">
              <p className="text-zinc-300 text-sm font-medium group-hover:text-indigo-300 transition-colors">Current State Image</p>
              <p className="text-zinc-500 text-xs mt-2">Click to browse or drag image here</p>
              <p className="text-zinc-600 text-xs mt-1">JPG, PNG, WebP (max 10MB)</p>
            </div>
          </div>
        </div>
        <div className="bg-zinc-800 rounded-xl border border-zinc-700 p-6">
          <h3 className="text-base font-semibold text-zinc-300 mb-4">Where you want to be</h3>
          <div className="min-h-[200px] bg-zinc-900 rounded-lg border-2 border-dashed border-zinc-600 hover:border-emerald-500 hover:bg-emerald-500/5 transition-all cursor-pointer flex flex-col items-center justify-center gap-4 group p-8">
            <div className="w-14 h-14 rounded-full bg-zinc-800 group-hover:bg-emerald-500/20 transition-colors flex items-center justify-center">
              <TargetIcon className="group-hover:text-emerald-400" />
            </div>
            <div className="text-center">
              <p className="text-zinc-300 text-sm font-medium group-hover:text-emerald-300 transition-colors">Goal State Image</p>
              <p className="text-zinc-500 text-xs mt-2">Click to browse or drag image here</p>
              <p className="text-zinc-600 text-xs mt-1">JPG, PNG, WebP (max 10MB)</p>
            </div>
          </div>
        </div>
      </div>

      {/* Planning Controls */}
      <div className="bg-zinc-800 rounded-xl border border-zinc-700 p-6 mb-8">
        <h3 className="text-base font-semibold text-zinc-300 mb-5">Planning Controls</h3>

        {/* Preset Buttons with tooltips */}
        <div className="flex gap-2 mb-5">
          {planningPresets.map((p) => (
            <div key={p.id} className="group relative">
              <button
                onClick={() => setPreset(p.id)}
                className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${p.recommended ? "flex items-center gap-1.5" : ""} ${
                  preset === p.id
                    ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md"
                    : "bg-zinc-700 text-zinc-300 hover:bg-zinc-600 hover:-translate-y-0.5"
                }`}
              >
                {p.label}
                {p.recommended && <span className="text-amber-400 text-xs">*</span>}
              </button>
              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-zinc-700 text-xs text-zinc-200 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                {p.tooltip}
              </span>
            </div>
          ))}
        </div>

        {/* Sliders */}
        <div className="space-y-5 mb-5">
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-zinc-300 flex items-center gap-2">
                Samples
                <span className="group relative">
                  <HelpIcon />
                  <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-zinc-700 text-xs text-zinc-200 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                    More samples = better plans but slower. 400 is recommended.
                  </span>
                </span>
              </span>
              <span className="text-zinc-400 font-medium">{samples}</span>
            </div>
            <input
              type="range"
              min="50"
              max="800"
              value={samples}
              onChange={(e) => setSamples(Number(e.target.value))}
              className={styles.slider}
            />
            <div className="flex justify-between text-xs text-zinc-600 mt-1">
              <span>Faster</span>
              <span>Better quality</span>
            </div>
          </div>
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-zinc-300 flex items-center gap-2">
                Iterations
                <span className="group relative">
                  <HelpIcon />
                  <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-zinc-700 text-xs text-zinc-200 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                    More iterations = more refined. 10 is usually enough.
                  </span>
                </span>
              </span>
              <span className="text-zinc-400 font-medium">{iterations}</span>
            </div>
            <input
              type="range"
              min="3"
              max="15"
              value={iterations}
              onChange={(e) => setIterations(Number(e.target.value))}
              className={styles.slider}
            />
            <div className="flex justify-between text-xs text-zinc-600 mt-1">
              <span>Quick</span>
              <span>More refined</span>
            </div>
          </div>
        </div>

        {/* Time/Cost Estimator */}
        <div className="flex gap-4 mb-5 p-3 bg-zinc-900 rounded-lg">
          <div className="flex items-center gap-2 text-sm">
            <ClockIcon />
            <span className="text-zinc-400">Est. time:</span>
            <span className="text-zinc-200 font-medium">~{estimatedTime}-{estimatedTime + 1} min</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-zinc-400">GPU cost:</span>
            <span className="text-zinc-200 font-medium">~${estimatedCost}</span>
          </div>
        </div>

        {/* Validation Status */}
        <div className="flex gap-4 mb-5 text-sm">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${currentImage ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
            {currentImage ? <CheckCircleIcon /> : <XCircleIcon />}
            <span>Current image {currentImage ? "uploaded" : "required"}</span>
          </div>
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${goalImage ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
            {goalImage ? <CheckCircleIcon /> : <XCircleIcon />}
            <span>Goal image {goalImage ? "uploaded" : "required"}</span>
          </div>
        </div>

        {/* Model and Actions */}
        <div className="flex flex-wrap gap-3">
          <select className="px-4 py-2.5 bg-zinc-700 text-white rounded-lg border-none outline-none text-sm">
            <option>Model: ViT-Large</option>
            <option>Model: ViT-Huge</option>
            <option>Model: ViT-Giant</option>
          </select>
          <button
            disabled={!canGenerate}
            onClick={startPlanning}
            className={`px-5 py-2.5 rounded-lg transition-all text-sm font-medium flex items-center gap-2 ${
              canGenerate
                ? "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:scale-[1.02] active:scale-[0.98]"
                : "bg-zinc-700 text-zinc-500 cursor-not-allowed"
            }`}
          >
            {canGenerate && <RocketIcon />}
            Generate Plan
          </button>
          <button
            onClick={reset}
            className="px-4 py-2.5 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg transition-colors text-sm"
          >
            Reset
          </button>
          <button
            onClick={() => {
              setCurrentImage("demo");
              setGoalImage("demo");
            }}
            className="px-4 py-2.5 bg-zinc-600 hover:bg-zinc-500 text-zinc-300 rounded-lg transition-colors text-xs"
          >
            (Demo: Load images)
          </button>
        </div>
      </div>

      {/* Progress Dashboard */}
      <div className="bg-zinc-800 rounded-xl border border-zinc-700 p-6 mb-8">
        <h3 className="text-base font-semibold text-zinc-300 mb-5">Progress Dashboard</h3>

        {isProcessing ? (
          <>
            {/* Progress Bar */}
            <div className="mb-5">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-zinc-300 font-medium">Processing</span>
                <span className="text-indigo-400 font-medium">{progressPercent}%</span>
              </div>
              <div className="h-3 bg-zinc-700 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-indigo-600 to-purple-500 rounded-full transition-all" style={{ width: `${progressPercent}%` }} />
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-4 mb-5">
              <div className="bg-zinc-900 rounded-lg p-4">
                <p className="text-xs text-zinc-500 mb-1">Iteration</p>
                <p className="text-xl font-semibold text-zinc-200">{progress?.iteration ?? 0} / {progress?.totalIterations ?? iterations}</p>
              </div>
              <div className="bg-zinc-900 rounded-lg p-4">
                <p className="text-xs text-zinc-500 mb-1">Elapsed</p>
                <p className="text-xl font-semibold text-zinc-200">{formatTime(progress?.elapsedSeconds ?? 0)}</p>
              </div>
              <div className="bg-zinc-900 rounded-lg p-4">
                <p className="text-xs text-zinc-500 mb-1">ETA</p>
                <p className="text-xl font-semibold text-zinc-200">~{formatTime(progress?.etaSeconds ?? 0)}</p>
              </div>
            </div>

            {/* Energy Display */}
            <div className="bg-zinc-900 rounded-lg p-4 mb-5">
              <div className="flex justify-between items-center mb-3">
                <p className="text-sm text-zinc-400">Best Energy</p>
                <p className="text-lg font-semibold text-green-400">{progress?.bestEnergy?.toFixed(2) ?? "—"}</p>
              </div>
              {/* Mini Convergence Chart with gradient colors */}
              <div className="h-20 flex items-end gap-1">
                {convergenceData.map((val, i, arr) => {
                  const progress = i / (arr.length - 1);
                  return (
                    <div
                      key={i}
                      className={`flex-1 bg-gradient-to-t ${getBarColor(progress)} rounded-t opacity-90 transition-all duration-500`}
                      style={{ height: `${(val / 8) * 100}%` }}
                    />
                  );
                })}
              </div>
              <div className="flex justify-between text-xs text-zinc-600 mt-2">
                <span>Iter 1</span>
                <span>Iter {iterations}</span>
              </div>
            </div>

            {/* Control Buttons */}
            <div className="flex gap-3">
              <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-all text-sm font-medium hover:scale-[1.02] active:scale-[0.98]">
                <PauseIcon />
                Pause
              </button>
              <button
                onClick={cancelPlanning}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-all text-sm font-medium hover:scale-[1.02] active:scale-[0.98]"
              >
                <StopIcon />
                Cancel
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 rounded-full bg-zinc-900 flex items-center justify-center mb-4">
              <ClockIcon />
            </div>
            <p className="text-zinc-400 text-sm">No active process</p>
            <p className="text-zinc-600 text-xs mt-1">Upload images and click Generate Plan to start</p>
          </div>
        )}
      </div>

      {/* Iteration Replay - shows after results are available */}
      {hasResults && (
        <div className="mb-8">
          <IterationReplay
            totalIterations={iterations}
            totalSamples={samples}
            eliteFraction={0.1}
          />
        </div>
      )}

      {/* Results Display */}
      <div className="bg-zinc-800 rounded-xl border border-zinc-700 p-6">
        <h3 className="text-base font-semibold text-zinc-300 mb-5">Results Display</h3>

        {hasResults ? (
          <div className="flex flex-col lg:flex-row gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* 3D Arrow Visual */}
            <div className="w-full lg:w-56 h-56 bg-zinc-900 rounded-xl border border-zinc-600 flex items-center justify-center relative overflow-hidden shrink-0">
              {/* Grid background */}
              <div className="absolute inset-0 opacity-20">
                <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                      <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#4b5563" strokeWidth="0.5"/>
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#grid)" />
                </svg>
              </div>
              {/* 3D Arrow */}
              <svg className="w-28 h-28 text-blue-500" viewBox="0 0 100 100">
                <defs>
                  <linearGradient id="arrowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#6366f1" />
                    <stop offset="100%" stopColor="#a855f7" />
                  </linearGradient>
                </defs>
                {/* Arrow body */}
                <line x1="30" y1="70" x2="70" y2="30" stroke="url(#arrowGrad)" strokeWidth="4" strokeLinecap="round" />
                {/* Arrow head */}
                <polygon points="70,30 55,35 65,45" fill="url(#arrowGrad)" />
                {/* X axis indicator */}
                <line x1="30" y1="70" x2="55" y2="70" stroke="#ef4444" strokeWidth="2" strokeDasharray="4,2" opacity="0.6" />
                {/* Y axis indicator */}
                <line x1="70" y1="30" x2="70" y2="55" stroke="#22c55e" strokeWidth="2" strokeDasharray="4,2" opacity="0.6" />
              </svg>
              <span className="absolute bottom-3 left-3 text-xs text-zinc-500 font-medium">Optimal Action</span>
            </div>

            {/* Action Details */}
            <div className="flex-1 space-y-4">
              {/* Coordinates */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-zinc-900 rounded-lg p-4 transform transition-all hover:scale-[1.02]" style={{ animationDelay: "100ms" }}>
                  <p className="text-xs text-red-400 mb-1 font-medium">X Axis</p>
                  <p className="text-xl font-mono font-semibold text-zinc-200">{result?.action[0]?.toFixed(1) ?? "0.0"} <span className="text-xs text-zinc-500">cm</span></p>
                </div>
                <div className="bg-zinc-900 rounded-lg p-4 transform transition-all hover:scale-[1.02]" style={{ animationDelay: "200ms" }}>
                  <p className="text-xs text-green-400 mb-1 font-medium">Y Axis</p>
                  <p className="text-xl font-mono font-semibold text-zinc-200">{result?.action[1]?.toFixed(1) ?? "0.0"} <span className="text-xs text-zinc-500">cm</span></p>
                </div>
                <div className="bg-zinc-900 rounded-lg p-4 transform transition-all hover:scale-[1.02]" style={{ animationDelay: "300ms" }}>
                  <p className="text-xs text-blue-400 mb-1 font-medium">Z Axis</p>
                  <p className="text-xl font-mono font-semibold text-zinc-200">{result?.action[2]?.toFixed(1) ?? "0.0"} <span className="text-xs text-zinc-500">cm</span></p>
                </div>
              </div>

              {/* Confidence Bar */}
              <div className="bg-zinc-900 rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-zinc-400">Confidence</span>
                  <span className="text-base font-semibold text-green-400 flex items-center gap-1">
                    {Math.round((result?.confidence ?? 0) * 100)}%
                    <CheckCircleIcon />
                  </span>
                </div>
                <div className="h-2.5 bg-zinc-700 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-green-600 to-green-400 rounded-full transition-all duration-1000" style={{ width: `${(result?.confidence ?? 0) * 100}%` }} />
                </div>
              </div>

              {/* Stats Row */}
              <div className="flex gap-4">
                <div className="bg-zinc-900 rounded-lg px-4 py-3">
                  <span className="text-xs text-zinc-500">Energy: </span>
                  <span className="text-base font-semibold text-zinc-200">{result?.energy?.toFixed(2) ?? "—"}</span>
                </div>
                <div className="bg-zinc-900 rounded-lg px-4 py-3">
                  <span className="text-xs text-zinc-500">Iterations: </span>
                  <span className="text-base font-semibold text-zinc-200">{result?.energyHistory?.length ?? iterations}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2">
                <button className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-lg transition-all text-sm font-medium shadow-lg shadow-indigo-500/25 hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2">
                  <EyeIcon />
                  View Details
                </button>
                <button className="px-4 py-2.5 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg transition-all text-sm hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2">
                  <ExportIcon />
                  Export
                </button>
                <button className="px-4 py-2.5 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg transition-all text-sm hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2">
                  <CompareIcon />
                  Compare
                </button>
              </div>
            </div>

            {/* Energy Landscape Visualization */}
            <div className="w-full lg:w-[340px] shrink-0">
              <EnergyLandscape
                optimalAction={result?.action ?? [0, 0, 0]}
                onActionSelect={(action, energy) => {
                  console.log("Selected action:", action, "Energy:", energy);
                }}
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-20 h-20 rounded-full bg-zinc-900 flex items-center justify-center mb-4">
              <ResultsIcon />
            </div>
            <p className="text-zinc-400 text-sm font-medium">No results yet</p>
            <p className="text-zinc-600 text-xs mt-2 max-w-xs">Upload images and click Generate Plan to see the optimal action prediction</p>
            <button
              onClick={completePlanning}
              className="mt-4 px-4 py-2 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              (Demo: Show sample results)
            </button>
          </div>
        )}
      </div>
    </>
  );
}
