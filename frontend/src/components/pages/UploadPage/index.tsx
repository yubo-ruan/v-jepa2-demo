"use client";

import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import {
  CameraIcon,
  TargetIcon,
  HelpIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  RocketIcon,
  StopIcon,
  EyeIcon,
  ExportIcon,
  ResultsIcon,
  RetryIcon,
  AlertIcon,
} from "@/components/icons";
import { EnergyLandscape, IterationReplay } from "@/components/visualizations";
import { PlanningResultValidation } from "@/components/visualizations/PlanningResultValidation";
import { styles, Spinner, Modal, focusRing } from "@/components/ui";
import { usePlanning, useToast, useModels } from "@/contexts";
import { planningPresets, config } from "@/constants";
import { ACTION_DISPLAY_SCALING, ACTION_LABELS, ACTION_COLORS } from "@/constants/actionDisplay";

interface UploadPageProps {
  onGoToConfig: () => void;
}

export function UploadPage({ onGoToConfig }: UploadPageProps) {
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
    clearError,
    reset,
    canGenerate,
    estimatedTime,
    estimatedCost,
  } = usePlanning();

  const { preset, samples, iterations, currentImage, goalImage, hasResults, isProcessing, progress, result, error } = planningState;
  const { showToast } = useToast();

  // Model management from useModels hook
  const { models, loadedModel, isLoading: isLoadingModels } = useModels();
  const loadedModelInfo = models.find(m => m.id === loadedModel);

  const [showDetailsModal, setShowDetailsModal] = useState(false);

  // Export results as JSON
  const handleExport = () => {
    if (!result) return;

    const exportData = {
      timestamp: new Date().toISOString(),
      model: loadedModel || "unknown",
      parameters: {
        preset,
        samples,
        iterations,
      },
      result: {
        action: result.action,
        confidence: result.confidence,
        energy: result.energy,
        energyHistory: result.energyHistory,
      },
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vjepa2-result-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast("Results exported successfully", "success");
  };

  // Show error toast when planning fails
  useEffect(() => {
    if (error) {
      showToast(error, "error");
    }
  }, [error, showToast]);

  // Note: We don't revoke blob URLs to avoid broken image issues
  // This causes a small memory leak, but blob URLs are tiny (just pointers)
  // and will be cleaned up when the page is closed

  // Wrapper to pass loaded model to planning
  const handleStartPlanning = useCallback(() => {
    if (loadedModel) {
      startPlanning(loadedModel);
    }
  }, [loadedModel, startPlanning]);

  // Keyboard shortcut: Cmd/Ctrl + Enter to generate plan
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && canGenerate && loadedModel) {
        e.preventDefault();
        handleStartPlanning();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [canGenerate, loadedModel, handleStartPlanning]);

  // Retry planning after error
  const handleRetry = () => {
    clearError();
    handleStartPlanning();
  };

  // Image validation constants
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

  // Validate and handle image upload
  const handleImageUpload = (file: File, type: "current" | "goal") => {
    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      showToast("Invalid file type. Please upload JPG, PNG, or WebP.", "error");
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      showToast("File too large. Maximum size is 10MB.", "error");
      return;
    }

    // Create preview URL
    const previewUrl = URL.createObjectURL(file);

    if (type === "current") {
      setCurrentImage(previewUrl);
    } else {
      setGoalImage(previewUrl);
    }

    showToast(`${type === "current" ? "Current" : "Goal"} image uploaded`, "success");
  };

  // Handle file input change
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: "current" | "goal") => {
    const file = e.target.files?.[0];
    if (file) {
      handleImageUpload(file, type);
    }
  };

  // Handle drag and drop
  const handleDrop = (e: React.DragEvent, type: "current" | "goal") => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleImageUpload(file, type);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  // Handle keyboard activation for dropzones (Enter/Space)
  const handleKeyDown = (e: React.KeyboardEvent, inputId: string) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      document.getElementById(inputId)?.click();
    }
  };

  // Use real energy history from result, or build from progress updates
  const convergenceData = useMemo(() => {
    // Priority 1: Completed result
    if (result?.energyHistory && result.energyHistory.length > 0) {
      return result.energyHistory;
    }
    // Priority 2: Live progress updates
    if (progress?.energyHistory && progress.energyHistory.length > 0) {
      return progress.energyHistory;
    }
    // Fallback: mock data
    return [8, 6.5, 5.2, 4.1, 3.5, 3.1, 2.8, 2.6, 2.5, 2.45];
  }, [result?.energyHistory, progress?.energyHistory]);

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
          <input
            type="file"
            id="current-image-input"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => handleFileChange(e, "current")}
            className="hidden"
            aria-label="Upload current state image"
          />
          <div
            role="button"
            tabIndex={0}
            aria-label={currentImage ? "Current state image uploaded. Click or press Enter to change" : "Upload current state image. Click or press Enter to browse, or drag and drop"}
            onClick={() => document.getElementById("current-image-input")?.click()}
            onKeyDown={(e) => handleKeyDown(e, "current-image-input")}
            onDrop={(e) => handleDrop(e, "current")}
            onDragOver={handleDragOver}
            className={`min-h-[200px] bg-zinc-900 rounded-lg border-2 border-dashed border-zinc-600 hover:border-indigo-500 hover:bg-indigo-500/5 transition-all cursor-pointer flex flex-col items-center justify-center gap-4 group p-8 relative overflow-hidden ${focusRing}`}
          >
            {currentImage && currentImage !== "demo" ? (
              <>
                <img
                  src={currentImage}
                  alt="Current state"
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                  <p className="text-white text-sm font-medium">Click to change</p>
                </div>
              </>
            ) : currentImage === "demo" ? (
              <div className="flex flex-col items-center justify-center">
                <div className="w-14 h-14 rounded-full bg-indigo-500/20 flex items-center justify-center mb-2">
                  <CameraIcon className="text-indigo-400" />
                </div>
                <p className="text-indigo-400 text-sm font-medium">Demo Image Loaded</p>
              </div>
            ) : (
              <>
                <div className="w-14 h-14 rounded-full bg-zinc-800 group-hover:bg-indigo-500/20 transition-colors flex items-center justify-center">
                  <CameraIcon className="group-hover:text-indigo-400" />
                </div>
                <div className="text-center">
                  <p className="text-zinc-300 text-sm font-medium group-hover:text-indigo-300 transition-colors">Current State Image</p>
                  <p className="text-zinc-500 text-xs mt-2">Click to browse or drag image here</p>
                  <p className="text-zinc-600 text-xs mt-1">JPG, PNG, WebP (max 10MB)</p>
                </div>
              </>
            )}
          </div>
        </div>
        <div className="bg-zinc-800 rounded-xl border border-zinc-700 p-6">
          <h3 className="text-base font-semibold text-zinc-300 mb-4">Where you want to be</h3>
          <input
            type="file"
            id="goal-image-input"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => handleFileChange(e, "goal")}
            className="hidden"
            aria-label="Upload goal state image"
          />
          <div
            role="button"
            tabIndex={0}
            aria-label={goalImage ? "Goal state image uploaded. Click or press Enter to change" : "Upload goal state image. Click or press Enter to browse, or drag and drop"}
            onClick={() => document.getElementById("goal-image-input")?.click()}
            onKeyDown={(e) => handleKeyDown(e, "goal-image-input")}
            onDrop={(e) => handleDrop(e, "goal")}
            onDragOver={handleDragOver}
            className={`min-h-[200px] bg-zinc-900 rounded-lg border-2 border-dashed border-zinc-600 hover:border-emerald-500 hover:bg-emerald-500/5 transition-all cursor-pointer flex flex-col items-center justify-center gap-4 group p-8 relative overflow-hidden ${focusRing}`}
          >
            {goalImage && goalImage !== "demo" ? (
              <>
                <img
                  src={goalImage}
                  alt="Goal state"
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                  <p className="text-white text-sm font-medium">Click to change</p>
                </div>
              </>
            ) : goalImage === "demo" ? (
              <div className="flex flex-col items-center justify-center">
                <div className="w-14 h-14 rounded-full bg-emerald-500/20 flex items-center justify-center mb-2">
                  <TargetIcon className="text-emerald-400" />
                </div>
                <p className="text-emerald-400 text-sm font-medium">Demo Image Loaded</p>
              </div>
            ) : (
              <>
                <div className="w-14 h-14 rounded-full bg-zinc-800 group-hover:bg-emerald-500/20 transition-colors flex items-center justify-center">
                  <TargetIcon className="group-hover:text-emerald-400" />
                </div>
                <div className="text-center">
                  <p className="text-zinc-300 text-sm font-medium group-hover:text-emerald-300 transition-colors">Goal State Image</p>
                  <p className="text-zinc-500 text-xs mt-2">Click to browse or drag image here</p>
                  <p className="text-zinc-600 text-xs mt-1">JPG, PNG, WebP (max 10MB)</p>
                </div>
              </>
            )}
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

        {/* Model Display and Actions */}
        <div className="flex flex-wrap gap-3 items-center">
          {/* Read-only model display */}
          <div className="px-4 py-2.5 bg-zinc-700 rounded-lg border border-zinc-600 min-w-[200px]">
            {isLoadingModels ? (
              <div className="flex items-center gap-2">
                <Spinner size="sm" />
                <span className="text-zinc-400 text-sm">Loading...</span>
              </div>
            ) : loadedModel ? (
              <div className="flex items-center justify-between">
                <span className="text-zinc-200 text-sm">{loadedModelInfo?.name || loadedModel}</span>
                <span className="text-xs text-green-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-green-400 rounded-full" />
                  Loaded
                </span>
              </div>
            ) : (
              <button
                onClick={onGoToConfig}
                className="flex items-center justify-between w-full text-amber-400 hover:text-amber-300 transition-colors"
              >
                <span className="text-sm">No model loaded</span>
                <span className="text-xs">Go to Config &rarr;</span>
              </button>
            )}
          </div>
          <div className="group relative">
            <button
              disabled={!canGenerate || !loadedModel}
              onClick={handleStartPlanning}
              className={`px-5 py-2.5 rounded-lg transition-all text-sm font-medium flex items-center gap-2 ${
                canGenerate && loadedModel
                  ? "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:scale-[1.02] active:scale-[0.98]"
                  : "bg-zinc-700 text-zinc-500 cursor-not-allowed"
              }`}
            >
              {canGenerate && loadedModel && <RocketIcon />}
              Generate Plan
            </button>
            {canGenerate && loadedModel && (
              <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                or press <kbd className="px-1.5 py-0.5 bg-zinc-700 rounded text-zinc-400">&#8984;+Enter</kbd>
              </span>
            )}
          </div>
          <button
            onClick={reset}
            className="px-4 py-2.5 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg transition-colors text-sm"
          >
            Reset
          </button>
          {config.enableDemoMode && (
            <button
              onClick={() => {
                setCurrentImage("demo");
                setGoalImage("demo");
              }}
              className="px-4 py-2.5 bg-zinc-600 hover:bg-zinc-500 text-zinc-300 rounded-lg transition-colors text-xs"
            >
              (Demo: Load images)
            </button>
          )}
        </div>
      </div>

      {/* Progress Dashboard */}
      <div className="bg-zinc-800 rounded-xl border border-zinc-700 p-6 mb-8">
        <h3 className="text-base font-semibold text-zinc-300 mb-5">Progress Dashboard</h3>

        {isProcessing || hasResults ? (
          <>
            {/* Progress Bar */}
            <div className="mb-5">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-zinc-300 font-medium">{hasResults ? "Completed" : "Processing"}</span>
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
                <p className="text-xl font-semibold text-zinc-200">{hasResults ? "—" : `~${formatTime(progress?.etaSeconds ?? 0)}`}</p>
              </div>
            </div>

            {/* Energy Display */}
            <div className="bg-zinc-900 rounded-lg p-4 mb-5">
              <div className="flex justify-between items-center mb-3 gap-3">
                <p className="text-sm text-zinc-400 flex-shrink-0">Best Energy</p>
                <p className="text-lg font-semibold text-green-400 tabular-nums">{progress?.bestEnergy?.toFixed(2) ?? "—"}</p>
              </div>
              {/* Mini Convergence Chart with gradient colors */}
              <div className="h-20 flex items-end gap-1">
                {(() => {
                  const maxEnergy = Math.max(...convergenceData, 0.1);
                  const minEnergy = Math.min(...convergenceData, maxEnergy);
                  const range = maxEnergy - minEnergy;
                  // Add 20% padding to top for better visualization
                  const scale = range > 0 ? range * 1.2 : maxEnergy;

                  return convergenceData.map((val, i, arr) => {
                    const progress = i / (arr.length - 1);
                    const heightPercent = scale > 0 ? ((val - minEnergy) / scale) * 100 : 10;
                    return (
                      <div
                        key={i}
                        className={`flex-1 bg-gradient-to-t ${getBarColor(progress)} rounded-t opacity-90 transition-all duration-500`}
                        style={{ height: `${Math.max(heightPercent, 2)}%` }}
                      />
                    );
                  });
                })()}
              </div>
              <div className="flex justify-between text-xs text-zinc-600 mt-2">
                <span>Iter 1</span>
                <span>Iter {iterations}</span>
              </div>
            </div>

            {/* Control Button - only show when processing */}
            {isProcessing && (
              <div className="flex gap-3">
                <button
                  onClick={cancelPlanning}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-all text-sm font-medium hover:scale-[1.02] active:scale-[0.98]"
                >
                  <StopIcon />
                  Cancel
                </button>
              </div>
            )}
          </>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-8 text-center animate-in fade-in duration-300">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
              <AlertIcon className="w-8 h-8 text-red-400" />
            </div>
            <p className="text-red-400 font-medium mb-2">Planning Failed</p>
            <p className="text-zinc-500 text-sm max-w-xs mb-6">{error}</p>
            <button
              onClick={handleRetry}
              className={`flex items-center justify-center gap-2 px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-lg transition-all text-sm font-medium shadow-lg shadow-indigo-500/25 hover:scale-[1.02] active:scale-[0.98] ${focusRing}`}
            >
              <RetryIcon className="w-4 h-4" />
              Try Again
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-14 h-14 rounded-full bg-zinc-900 flex items-center justify-center mb-4">
              <ClockIcon />
            </div>
            <p className="text-zinc-300 text-sm font-medium mb-4">Ready to Plan</p>

            {/* Step-by-step guidance */}
            <div className="space-y-2 text-left max-w-xs">
              <div className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${currentImage ? "bg-green-500/20 text-green-400" : "bg-zinc-700 text-zinc-400"}`}>
                  {currentImage ? "✓" : "1"}
                </div>
                <span className={`text-sm ${currentImage ? "text-green-400" : "text-zinc-400"}`}>
                  Upload current state image
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${goalImage ? "bg-green-500/20 text-green-400" : "bg-zinc-700 text-zinc-400"}`}>
                  {goalImage ? "✓" : "2"}
                </div>
                <span className={`text-sm ${goalImage ? "text-green-400" : "text-zinc-400"}`}>
                  Upload goal state image
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-zinc-700 flex items-center justify-center text-xs font-medium text-zinc-400">
                  3
                </div>
                <span className="text-sm text-zinc-400">
                  Click Generate Plan
                </span>
              </div>
            </div>
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

      {/* Planning Result Validation */}
      {hasResults && result && currentImage && goalImage && (
        <div className="mb-8">
          <PlanningResultValidation
            currentImage={currentImage}
            goalImage={goalImage}
            action={result.action}
            confidence={result.confidence}
            energy={result.energy}
            energyThreshold={result.energyThreshold}
            passesThreshold={result.passesThreshold}
            normalizedDistance={result.normalizedDistance}
            isAcModel={result.isAcModel}
          />
        </div>
      )}

      {/* Results Display */}
      <div className="bg-zinc-800 rounded-xl border border-zinc-700 p-6">
        <h3 className="text-base font-semibold text-zinc-300 mb-5">Results Display</h3>

        {hasResults ? (
          (() => {
            // Calculate arrow rotation from action vector [x, y, z]
            const calculateArrowAngle = (action: number[]) => {
              if (!action || action.length < 2) return 45; // default
              const x = action[0];
              const y = action[1];
              // Calculate angle in degrees (0° = right, 90° = up)
              const angle = Math.atan2(-y, x) * (180 / Math.PI);
              return angle;
            };

            const arrowAngle = result?.action ? calculateArrowAngle(result.action) : 45;
            const arrowLength = 40; // Fixed length for now

            return (
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
              <svg className="w-28 h-28" viewBox="0 0 100 100">
                <defs>
                  <linearGradient id="arrowGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#3b82f6" />
                    <stop offset="100%" stopColor="#8b5cf6" />
                  </linearGradient>
                </defs>

                {/* Center point */}
                <circle cx="50" cy="50" r="2" fill="#666" />

                {/* Dynamic arrow */}
                <g transform={`rotate(${arrowAngle} 50 50)`}>
                  {/* Arrow line */}
                  <line
                    x1="50"
                    y1="50"
                    x2={50 + arrowLength}
                    y2="50"
                    stroke="url(#arrowGrad)"
                    strokeWidth="4"
                    strokeLinecap="round"
                  />
                  {/* Arrow head */}
                  <polygon
                    points={`${50 + arrowLength},50 ${50 + arrowLength - 8},45 ${50 + arrowLength - 8},55`}
                    fill="url(#arrowGrad)"
                  />
                </g>

                {/* X axis reference (red) */}
                <line x1="50" y1="50" x2="80" y2="50" stroke="#ef4444" strokeWidth="1" strokeDasharray="2,2" opacity="0.4" />
                <text x="82" y="54" fontSize="8" fill="#ef4444" opacity="0.6">X</text>

                {/* Y axis reference (green) */}
                <line x1="50" y1="50" x2="50" y2="20" stroke="#22c55e" strokeWidth="1" strokeDasharray="2,2" opacity="0.4" />
                <text x="52" y="18" fontSize="8" fill="#22c55e" opacity="0.6">Y</text>
              </svg>
              <span className="absolute bottom-3 left-3 text-xs text-zinc-500 font-medium">Optimal Action</span>
            </div>

            {/* Action Details */}
            <div className="flex-1 space-y-4">
              {/* Coordinates - 3D or 7D based on model type */}
              {result?.isAcModel ? (
                // 7D DROID action format
                <div className="space-y-4">
                  {/* Position Section */}
                  <div>
                    <p className="text-xs text-zinc-400 mb-2 font-medium">Position (cm)</p>
                    <div className="grid grid-cols-3 gap-3">
                      {ACTION_LABELS.POSITION.map((label, i) => {
                        const value = ((result?.action[i] ?? 0) * ACTION_DISPLAY_SCALING.POSITION_TO_CM).toFixed(1);
                        const color = ACTION_COLORS.POSITION[i];
                        return (
                          <div key={label} className="bg-zinc-900 rounded-lg p-3 transform transition-all hover:scale-[1.02]">
                            <p className={`text-xs text-${color}-400 mb-1 font-medium`}>{label}</p>
                            <p className="text-lg font-mono font-semibold text-zinc-200">
                              {value} <span className="text-xs text-zinc-500">cm</span>
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Orientation Section */}
                  <div>
                    <p className="text-xs text-zinc-400 mb-2 font-medium">Orientation (deg)</p>
                    <div className="grid grid-cols-3 gap-3">
                      {ACTION_LABELS.ROTATION.map((label, i) => {
                        const value = ((result?.action[i + 3] ?? 0) * ACTION_DISPLAY_SCALING.ROTATION_TO_DEG).toFixed(1);
                        const color = ACTION_COLORS.ROTATION[i];
                        return (
                          <div key={label} className="bg-zinc-900 rounded-lg p-3 transform transition-all hover:scale-[1.02]">
                            <p className={`text-xs text-${color}-400 mb-1 font-medium`}>{label}</p>
                            <p className="text-lg font-mono font-semibold text-zinc-200">
                              {value}<span className="text-xs text-zinc-500">°</span>
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Gripper Section */}
                  <div>
                    <p className="text-xs text-zinc-400 mb-2 font-medium">Gripper</p>
                    <div className="bg-zinc-900 rounded-lg p-4">
                      {(() => {
                        const gripperValue = result?.action[6] ?? 0;
                        const gripperPercent = Math.max(0, Math.min(100,
                          ((gripperValue - ACTION_DISPLAY_SCALING.GRIPPER_MIN) /
                           (ACTION_DISPLAY_SCALING.GRIPPER_MAX - ACTION_DISPLAY_SCALING.GRIPPER_MIN)) * 100
                        ));
                        return (
                          <>
                            <div className="flex justify-between mb-2">
                              <p className="text-xs text-pink-400 font-medium">{ACTION_LABELS.GRIPPER}</p>
                              <p className="text-sm font-mono font-semibold text-zinc-200">{gripperPercent.toFixed(0)}%</p>
                            </div>
                            <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-pink-500 to-pink-400 transition-all duration-300"
                                style={{ width: `${gripperPercent}%` }}
                              />
                            </div>
                            <p className="text-xs text-zinc-500 mt-2 text-center">
                              {gripperPercent > 50 ? 'Open' : 'Closed'}
                            </p>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              ) : (
                // Standard 3D action
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
              )}

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
                <button
                  onClick={() => setShowDetailsModal(true)}
                  className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-lg transition-all text-sm font-medium shadow-lg shadow-indigo-500/25 hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2"
                >
                  <EyeIcon />
                  View Details
                </button>
                <button
                  onClick={handleExport}
                  className="px-4 py-2.5 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg transition-all text-sm hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2"
                >
                  <ExportIcon />
                  Export
                </button>
              </div>
            </div>

            {/* Energy Landscape Visualization */}
            <div className="w-full lg:w-[340px] shrink-0">
              <EnergyLandscape
                optimalAction={(result?.action ?? [0, 0, 0]) as [number, number, number]}
                onActionSelect={(action, energy) => {
                  console.log("Selected action:", action, "Energy:", energy);
                }}
              />
            </div>
          </div>
            );
          })()
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 rounded-full bg-zinc-900 flex items-center justify-center mb-4">
              <ResultsIcon />
            </div>
            <p className="text-zinc-300 text-sm font-medium mb-2">Awaiting Planning Results</p>
            <p className="text-zinc-500 text-xs max-w-sm leading-relaxed">
              {!currentImage && !goalImage
                ? "Start by uploading a current state and goal state image above."
                : !currentImage
                  ? "Upload a current state image to continue."
                  : !goalImage
                    ? "Upload a goal state image to continue."
                    : "Both images uploaded! Click Generate Plan to predict the optimal action."}
            </p>
            {currentImage && goalImage && (
              <div className="mt-4 flex items-center gap-2 text-xs text-indigo-400">
                <CheckCircleIcon className="w-4 h-4" />
                <span>Ready to generate</span>
              </div>
            )}
            {config.enableDemoMode && (
              <button
                onClick={completePlanning}
                className={`mt-4 px-4 py-2 text-xs text-indigo-400 hover:text-indigo-300 transition-colors ${focusRing}`}
              >
                (Demo: Show sample results)
              </button>
            )}
          </div>
        )}
      </div>

      {/* View Details Modal */}
      <Modal
        isOpen={showDetailsModal}
        onClose={() => setShowDetailsModal(false)}
        title="Planning Results Details"
        size="lg"
      >
        {result && (
          <div className="space-y-6">
            {/* Summary Section */}
            <div>
              <h4 className="text-sm font-medium text-zinc-300 mb-3">Summary</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-zinc-900 rounded-lg p-4">
                  <p className="text-xs text-zinc-500 mb-1">Model Used</p>
                  <p className="text-sm font-medium text-zinc-200">{loadedModelInfo?.name || loadedModel || "Unknown"}</p>
                </div>
                <div className="bg-zinc-900 rounded-lg p-4">
                  <p className="text-xs text-zinc-500 mb-1">Preset</p>
                  <p className="text-sm font-medium text-zinc-200 capitalize">{preset}</p>
                </div>
                <div className="bg-zinc-900 rounded-lg p-4">
                  <p className="text-xs text-zinc-500 mb-1">Samples</p>
                  <p className="text-sm font-medium text-zinc-200">{samples}</p>
                </div>
                <div className="bg-zinc-900 rounded-lg p-4">
                  <p className="text-xs text-zinc-500 mb-1">Iterations</p>
                  <p className="text-sm font-medium text-zinc-200">{iterations}</p>
                </div>
              </div>
            </div>

            {/* Action Vector Section */}
            <div>
              <h4 className="text-sm font-medium text-zinc-300 mb-3">
                Optimal Action Vector {result.isAcModel && <span className="text-xs text-purple-400 ml-2">(7D DROID)</span>}
              </h4>
              <div className="bg-zinc-900 rounded-lg p-4">
                {result.isAcModel ? (
                  // 7D DROID format display
                  <div className="space-y-4">
                    {/* Position Section */}
                    <div>
                      <p className="text-xs text-zinc-400 mb-2 font-semibold">Position (cm)</p>
                      <div className="grid grid-cols-3 gap-4">
                        {ACTION_LABELS.POSITION.map((label, i) => {
                          const rawValue = result.action[i] ?? 0;
                          const displayValue = (rawValue * ACTION_DISPLAY_SCALING.POSITION_TO_CM).toFixed(2);
                          const color = ACTION_COLORS.POSITION[i];
                          return (
                            <div key={label}>
                              <p className={`text-xs text-${color}-400 mb-1`}>{label}</p>
                              <p className="text-lg font-mono font-semibold text-zinc-200">
                                {displayValue} <span className="text-xs text-zinc-500">cm</span>
                              </p>
                              <p className="text-xs text-zinc-600 mt-1">raw: {rawValue.toFixed(4)}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Orientation Section */}
                    <div>
                      <p className="text-xs text-zinc-400 mb-2 font-semibold">Orientation (deg)</p>
                      <div className="grid grid-cols-3 gap-4">
                        {ACTION_LABELS.ROTATION.map((label, i) => {
                          const rawValue = result.action[i + 3] ?? 0;
                          const displayValue = (rawValue * ACTION_DISPLAY_SCALING.ROTATION_TO_DEG).toFixed(2);
                          const color = ACTION_COLORS.ROTATION[i];
                          return (
                            <div key={label}>
                              <p className={`text-xs text-${color}-400 mb-1`}>{label}</p>
                              <p className="text-lg font-mono font-semibold text-zinc-200">
                                {displayValue}<span className="text-xs text-zinc-500">°</span>
                              </p>
                              <p className="text-xs text-zinc-600 mt-1">raw: {rawValue.toFixed(4)}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Gripper Section */}
                    <div>
                      <p className="text-xs text-zinc-400 mb-2 font-semibold">Gripper</p>
                      <div className="space-y-3">
                        {(() => {
                          const gripperValue = result.action[6] ?? 0;
                          const gripperPercent = Math.max(0, Math.min(100,
                            ((gripperValue - ACTION_DISPLAY_SCALING.GRIPPER_MIN) /
                             (ACTION_DISPLAY_SCALING.GRIPPER_MAX - ACTION_DISPLAY_SCALING.GRIPPER_MIN)) * 100
                          ));
                          return (
                            <>
                              <div className="flex justify-between items-center">
                                <p className="text-xs text-pink-400">{ACTION_LABELS.GRIPPER}</p>
                                <p className="text-lg font-mono font-semibold text-zinc-200">{gripperPercent.toFixed(0)}%</p>
                              </div>
                              <div className="w-full bg-zinc-800 rounded-full h-3 overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-pink-500 to-pink-400 transition-all duration-300"
                                  style={{ width: `${gripperPercent}%` }}
                                />
                              </div>
                              <div className="flex justify-between items-center text-xs">
                                <p className="text-zinc-500">{gripperPercent > 50 ? 'Open' : 'Closed'}</p>
                                <p className="text-zinc-600">raw: {gripperValue.toFixed(4)}</p>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                ) : (
                  // Standard 3D format
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div>
                      <p className="text-xs text-red-400 mb-1">X</p>
                      <p className="text-lg font-mono font-semibold text-zinc-200">{result.action[0]?.toFixed(4)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-green-400 mb-1">Y</p>
                      <p className="text-lg font-mono font-semibold text-zinc-200">{result.action[1]?.toFixed(4)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-blue-400 mb-1">Z</p>
                      <p className="text-lg font-mono font-semibold text-zinc-200">{result.action[2]?.toFixed(4)}</p>
                    </div>
                  </div>
                )}
                <div className="flex gap-4 text-sm">
                  <div>
                    <span className="text-zinc-500">Magnitude: </span>
                    <span className="text-zinc-200 font-mono">
                      {Math.sqrt(
                        result.action.reduce((sum, v) => sum + v * v, 0)
                      ).toFixed(4)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Metrics Section */}
            <div>
              <h4 className="text-sm font-medium text-zinc-300 mb-3">Metrics</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-zinc-900 rounded-lg p-4">
                  <p className="text-xs text-zinc-500 mb-1">Final Energy</p>
                  <p className="text-lg font-semibold text-amber-400">{result.energy?.toFixed(6)}</p>
                </div>
                <div className="bg-zinc-900 rounded-lg p-4">
                  <p className="text-xs text-zinc-500 mb-1">Confidence</p>
                  <p className="text-lg font-semibold text-green-400">{(result.confidence * 100).toFixed(2)}%</p>
                </div>
              </div>
            </div>

            {/* Energy History Section */}
            {result.energyHistory && result.energyHistory.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-zinc-300 mb-3">Energy Convergence</h4>
                <div className="bg-zinc-900 rounded-lg p-4">
                  <div className="h-32 flex items-end gap-1">
                    {result.energyHistory.map((energy, i) => {
                      const maxEnergy = Math.max(...result.energyHistory!);
                      const height = (energy / maxEnergy) * 100;
                      return (
                        <div
                          key={i}
                          className="flex-1 bg-gradient-to-t from-indigo-600 to-purple-500 rounded-t opacity-80 hover:opacity-100 transition-opacity"
                          style={{ height: `${height}%` }}
                          title={`Iteration ${i + 1}: ${energy.toFixed(4)}`}
                        />
                      );
                    })}
                  </div>
                  <div className="flex justify-between text-xs text-zinc-500 mt-2">
                    <span>Iteration 1</span>
                    <span>Iteration {result.energyHistory.length}</span>
                  </div>
                  <div className="mt-3 text-xs text-zinc-400">
                    <span>Initial: {result.energyHistory[0]?.toFixed(4)} → Final: {result.energyHistory[result.energyHistory.length - 1]?.toFixed(4)}</span>
                    <span className="text-green-400 ml-2">
                      ({((1 - result.energyHistory[result.energyHistory.length - 1] / result.energyHistory[0]) * 100).toFixed(1)}% reduction)
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-4 border-t border-zinc-700">
              <button
                onClick={handleExport}
                className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg text-sm transition-colors"
              >
                Export JSON
              </button>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
