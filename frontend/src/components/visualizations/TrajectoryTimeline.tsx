"use client";

import { useMemo, useState } from "react";
import { CheckCircleIcon, ClockIcon } from "@/components/icons";
import { ACTION_LABELS, ACTION_DISPLAY_SCALING } from "@/constants/actionDisplay";
import type { TrajectoryStep, TrajectoryProgress, TrajectoryResult } from "@/lib/api";

interface TrajectoryTimelineProps {
  progress?: TrajectoryProgress | null;
  result?: TrajectoryResult | null;
  isProcessing?: boolean;
}

// Copy icon component
function CopyIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  );
}

// Chevron icon for expand/collapse
function ChevronIcon({ expanded, className = "w-4 h-4" }: { expanded: boolean; className?: string }) {
  return (
    <svg
      className={`${className} transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

export function TrajectoryTimeline({ progress, result, isProcessing }: TrajectoryTimelineProps) {
  const steps = result?.steps ?? progress?.completedSteps ?? [];
  const currentStep = progress?.currentStep ?? 0;
  const totalSteps = result?.steps?.length ?? progress?.totalSteps ?? 0;
  const isComplete = !!result;

  // Track expanded steps
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());
  // Track copy feedback
  const [copiedStep, setCopiedStep] = useState<number | null>(null);

  const toggleStep = (index: number) => {
    setExpandedSteps(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedSteps(new Set(steps.map((_, i) => i)));
  };

  const collapseAll = () => {
    setExpandedSteps(new Set());
  };

  // Copy action to clipboard
  const copyAction = async (step: TrajectoryStep, index: number) => {
    const actionStr = step.action.length === 7
      ? {
          position: {
            x: (step.action[0] * ACTION_DISPLAY_SCALING.POSITION_TO_CM).toFixed(2),
            y: (step.action[1] * ACTION_DISPLAY_SCALING.POSITION_TO_CM).toFixed(2),
            z: (step.action[2] * ACTION_DISPLAY_SCALING.POSITION_TO_CM).toFixed(2),
          },
          rotation: {
            roll: (step.action[3] * ACTION_DISPLAY_SCALING.ROTATION_TO_DEG).toFixed(2),
            pitch: (step.action[4] * ACTION_DISPLAY_SCALING.ROTATION_TO_DEG).toFixed(2),
            yaw: (step.action[5] * ACTION_DISPLAY_SCALING.ROTATION_TO_DEG).toFixed(2),
          },
          gripper: Math.round(((step.action[6] - ACTION_DISPLAY_SCALING.GRIPPER_MIN) /
            (ACTION_DISPLAY_SCALING.GRIPPER_MAX - ACTION_DISPLAY_SCALING.GRIPPER_MIN)) * 100),
          raw: step.action,
        }
      : { action: step.action };

    await navigator.clipboard.writeText(JSON.stringify(actionStr, null, 2));
    setCopiedStep(index);
    setTimeout(() => setCopiedStep(null), 2000);
  };

  // Format compact action summary
  const formatCompactAction = (action: number[]) => {
    if (action.length === 7) {
      const x = (action[0] * ACTION_DISPLAY_SCALING.POSITION_TO_CM).toFixed(1);
      const y = (action[1] * ACTION_DISPLAY_SCALING.POSITION_TO_CM).toFixed(1);
      const z = (action[2] * ACTION_DISPLAY_SCALING.POSITION_TO_CM).toFixed(1);
      const grip = Math.round(((action[6] - ACTION_DISPLAY_SCALING.GRIPPER_MIN) /
        (ACTION_DISPLAY_SCALING.GRIPPER_MAX - ACTION_DISPLAY_SCALING.GRIPPER_MIN)) * 100);
      return `Δ(${x}, ${y}, ${z}) cm • Grip ${grip}%`;
    }
    return `[${action.map(v => v.toFixed(2)).join(", ")}]`;
  };

  // Calculate stats
  const stats = useMemo(() => {
    if (result) {
      return {
        totalEnergy: result.totalEnergy,
        avgEnergy: result.avgEnergy,
        avgConfidence: result.avgConfidence,
      };
    }
    if (steps.length > 0) {
      const totalEnergy = steps.reduce((sum, s) => sum + s.energy, 0);
      const avgEnergy = totalEnergy / steps.length;
      const avgConfidence = steps.reduce((sum, s) => sum + s.confidence, 0) / steps.length;
      return { totalEnergy, avgEnergy, avgConfidence };
    }
    return null;
  }, [result, steps]);

  if (totalSteps === 0 && !isProcessing) {
    return (
      <div className="bg-zinc-800 rounded-xl border border-zinc-700 p-6">
        <h3 className="text-base font-semibold text-zinc-300 mb-4">Trajectory Timeline</h3>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="w-14 h-14 rounded-full bg-zinc-900 flex items-center justify-center mb-4">
            <ClockIcon />
          </div>
          <p className="text-zinc-400 text-sm">No trajectory data yet</p>
          <p className="text-zinc-500 text-xs mt-2">Generate a trajectory to see the action sequence</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-zinc-800 rounded-xl border border-zinc-700 p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-5">
        <div className="flex items-center gap-4">
          <h3 className="text-base font-semibold text-zinc-300">Trajectory Timeline</h3>
          {steps.length > 0 && isComplete && (
            <div className="flex gap-1">
              <button
                onClick={expandAll}
                className="px-2 py-1 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 rounded transition-colors"
              >
                Expand All
              </button>
              <button
                onClick={collapseAll}
                className="px-2 py-1 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 rounded transition-colors"
              >
                Collapse
              </button>
            </div>
          )}
        </div>
        {stats && (
          <div className="flex gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-zinc-500">Avg Energy:</span>
              <span className="text-amber-400 font-medium">{stats.avgEnergy.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-zinc-500">Avg Confidence:</span>
              <span className="text-green-400 font-medium">{(stats.avgConfidence * 100).toFixed(0)}%</span>
            </div>
          </div>
        )}
      </div>

      {/* Progress indicator for current step */}
      {isProcessing && progress && !isComplete && (
        <div className="mb-5 p-4 bg-zinc-900 rounded-lg border border-emerald-500/30">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-zinc-300 flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              Planning Step {currentStep + 1} of {totalSteps}
            </span>
            <span className="text-sm text-emerald-400">
              Iteration {progress.iteration}/{progress.totalIterations}
            </span>
          </div>
          <div className="h-2 bg-zinc-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-600 to-teal-500 rounded-full transition-all duration-300"
              style={{
                width: `${((currentStep + progress.iteration / progress.totalIterations) / totalSteps) * 100}%`
              }}
            />
          </div>
          <div className="flex justify-between text-xs text-zinc-500 mt-2">
            <span>Energy: <span className="text-amber-400">{progress.bestEnergy.toFixed(2)}</span></span>
            <span>ETA: <span className="text-zinc-300">~{Math.ceil(progress.etaSeconds)}s</span></span>
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="relative">
        {/* Vertical line connecting steps */}
        <div className="absolute left-5 top-6 bottom-6 w-0.5 bg-gradient-to-b from-emerald-500/50 via-zinc-700 to-zinc-700" />

        {/* Steps */}
        <div className="space-y-3">
          {Array.from({ length: totalSteps }).map((_, index) => {
            const step = steps.find(s => s.step === index);
            const isCurrentlyProcessing = isProcessing && currentStep === index && !isComplete;
            const isPending = !step && !isCurrentlyProcessing;
            const isCompleted = !!step;
            const isExpanded = expandedSteps.has(index);

            return (
              <div
                key={index}
                className={`relative transition-all duration-200 ${
                  isCurrentlyProcessing
                    ? "bg-emerald-500/10 border border-emerald-500/30 rounded-lg"
                    : isCompleted
                      ? "bg-zinc-900 rounded-lg hover:bg-zinc-900/80"
                      : "bg-zinc-900/30 rounded-lg opacity-50"
                }`}
              >
                {/* Compact Header - Always visible */}
                <div
                  className={`flex items-center gap-3 p-3 ${isCompleted ? "cursor-pointer" : ""}`}
                  onClick={() => isCompleted && toggleStep(index)}
                >
                  {/* Step indicator */}
                  <div
                    className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 ${
                      isCurrentlyProcessing
                        ? "bg-emerald-500 text-white"
                        : isCompleted
                          ? "bg-green-500/20 text-green-400"
                          : "bg-zinc-700 text-zinc-500"
                    }`}
                  >
                    {isCurrentlyProcessing ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : isCompleted ? (
                      <CheckCircleIcon className="w-5 h-5" />
                    ) : (
                      index + 1
                    )}
                  </div>

                  {/* Step summary */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium ${
                        isCurrentlyProcessing
                          ? "text-emerald-300"
                          : isCompleted
                            ? "text-zinc-200"
                            : "text-zinc-500"
                      }`}>
                        Step {index + 1}
                      </span>
                      {isCurrentlyProcessing && (
                        <span className="text-xs text-emerald-400 animate-pulse">Planning...</span>
                      )}
                      {step && (
                        <span className="text-xs text-zinc-500 font-mono truncate">
                          {formatCompactAction(step.action)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right side: Progress, Energy, Distance, Confidence, Expand button */}
                  {step && (
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 text-xs">
                        {/* Progress indicator */}
                        <span className={`font-mono ${
                          step.progressRatio > 0.5 ? "text-emerald-400" :
                          step.progressRatio > 0.2 ? "text-yellow-400" : "text-zinc-400"
                        }`}>
                          {(step.progressRatio * 100).toFixed(0)}%
                        </span>
                        <span className="text-amber-400 font-mono">E:{step.energy.toFixed(2)}</span>
                        {/* Embedding distance to goal */}
                        <span className="text-cyan-400 font-mono">D:{step.distanceToGoal.toFixed(3)}</span>
                        <span className="text-green-400 font-mono">{(step.confidence * 100).toFixed(0)}%</span>
                      </div>
                      <ChevronIcon expanded={isExpanded} className="w-4 h-4 text-zinc-500" />
                    </div>
                  )}

                  {isPending && (
                    <span className="text-xs text-zinc-600">Pending</span>
                  )}
                </div>

                {/* Expanded Details */}
                {isCompleted && isExpanded && step && (
                  <div className="px-3 pb-3 pt-0 border-t border-zinc-800 mt-0 animate-in slide-in-from-top-2 duration-200">
                    <div className="ml-13 pl-10 space-y-3 pt-3">
                      {/* 7D Action Breakdown */}
                      {step.action.length === 7 && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          {/* Position */}
                          <div className="bg-zinc-800/50 rounded-lg p-3">
                            <p className="text-xs text-zinc-500 mb-2 font-medium">Position (cm)</p>
                            <div className="space-y-1.5">
                              {ACTION_LABELS.POSITION.map((label, i) => (
                                <div key={label} className="flex justify-between items-center">
                                  <span className={`text-xs font-medium ${
                                    i === 0 ? "text-red-400" : i === 1 ? "text-green-400" : "text-blue-400"
                                  }`}>{label}</span>
                                  <span className="text-sm font-mono text-zinc-200">
                                    {(step.action[i] * ACTION_DISPLAY_SCALING.POSITION_TO_CM).toFixed(2)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Rotation */}
                          <div className="bg-zinc-800/50 rounded-lg p-3">
                            <p className="text-xs text-zinc-500 mb-2 font-medium">Rotation (°)</p>
                            <div className="space-y-1.5">
                              {ACTION_LABELS.ROTATION.map((label, i) => (
                                <div key={label} className="flex justify-between items-center">
                                  <span className={`text-xs font-medium ${
                                    i === 0 ? "text-amber-400" : i === 1 ? "text-purple-400" : "text-cyan-400"
                                  }`}>{label}</span>
                                  <span className="text-sm font-mono text-zinc-200">
                                    {(step.action[i + 3] * ACTION_DISPLAY_SCALING.ROTATION_TO_DEG).toFixed(2)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Gripper & Actions */}
                          <div className="bg-zinc-800/50 rounded-lg p-3">
                            <p className="text-xs text-zinc-500 mb-2 font-medium">Gripper</p>
                            <div className="space-y-2">
                              <div className="flex justify-between items-center">
                                <span className="text-xs font-medium text-pink-400">Opening</span>
                                <span className="text-sm font-mono text-zinc-200">
                                  {Math.round(((step.action[6] - ACTION_DISPLAY_SCALING.GRIPPER_MIN) /
                                    (ACTION_DISPLAY_SCALING.GRIPPER_MAX - ACTION_DISPLAY_SCALING.GRIPPER_MIN)) * 100)}%
                                </span>
                              </div>
                              <div className="w-full h-2 bg-zinc-700 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-pink-600 to-pink-400 rounded-full transition-all"
                                  style={{
                                    width: `${Math.max(0, Math.min(100, ((step.action[6] - ACTION_DISPLAY_SCALING.GRIPPER_MIN) /
                                      (ACTION_DISPLAY_SCALING.GRIPPER_MAX - ACTION_DISPLAY_SCALING.GRIPPER_MIN)) * 100))}%`
                                  }}
                                />
                              </div>

                              {/* Copy Button */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  copyAction(step, index);
                                }}
                                className="mt-2 w-full flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 bg-zinc-700/50 hover:bg-zinc-700 rounded transition-colors"
                              >
                                <CopyIcon className="w-3.5 h-3.5" />
                                {copiedStep === index ? "Copied!" : "Copy Action"}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Progress to Goal bar */}
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-zinc-500 w-20">Progress</span>
                        <div className="flex-1 h-2 bg-zinc-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              step.progressRatio > 0.5
                                ? "bg-gradient-to-r from-emerald-600 to-emerald-400"
                                : step.progressRatio > 0.2
                                  ? "bg-gradient-to-r from-yellow-600 to-yellow-400"
                                  : "bg-gradient-to-r from-zinc-600 to-zinc-500"
                            }`}
                            style={{ width: `${step.progressRatio * 100}%` }}
                          />
                        </div>
                        <span className={`text-xs font-mono w-12 text-right ${
                          step.progressRatio > 0.5 ? "text-emerald-400" :
                          step.progressRatio > 0.2 ? "text-yellow-400" : "text-zinc-400"
                        }`}>
                          {(step.progressRatio * 100).toFixed(1)}%
                        </span>
                      </div>

                      {/* Confidence bar */}
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-zinc-500 w-20">Confidence</span>
                        <div className="flex-1 h-2 bg-zinc-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-green-600 to-green-400 rounded-full transition-all"
                            style={{ width: `${step.confidence * 100}%` }}
                          />
                        </div>
                        <span className="text-xs text-green-400 font-mono w-12 text-right">
                          {(step.confidence * 100).toFixed(1)}%
                        </span>
                      </div>

                      {/* Distance to Goal */}
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-zinc-500 w-20">Distance</span>
                        <span className="text-xs text-cyan-400 font-mono">
                          {step.distanceToGoal.toFixed(4)} (embedding)
                        </span>
                      </div>

                      {/* Energy convergence mini chart */}
                      {step.energyHistory && step.energyHistory.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs text-zinc-500 mb-1">Energy Convergence</p>
                          <div className="h-8 flex items-end gap-px">
                            {step.energyHistory.map((e, i) => {
                              const max = Math.max(...step.energyHistory);
                              const min = Math.min(...step.energyHistory);
                              const range = max - min || 1;
                              const height = ((e - min) / range) * 100;
                              return (
                                <div
                                  key={i}
                                  className="flex-1 bg-gradient-to-t from-amber-600 to-amber-400 rounded-t opacity-70 hover:opacity-100 transition-opacity"
                                  style={{ height: `${Math.max(height, 5)}%` }}
                                  title={`Iter ${i + 1}: ${e.toFixed(3)}`}
                                />
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary when complete */}
      {isComplete && result && (
        <div className="mt-5 p-4 bg-gradient-to-r from-green-500/10 to-emerald-500/10 rounded-lg border border-green-500/20">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <CheckCircleIcon className="w-5 h-5 text-green-400" />
              <span className="text-sm font-medium text-green-400">Trajectory Complete</span>
            </div>
            <div className="flex gap-4 text-sm">
              <div>
                <span className="text-zinc-500">Steps:</span>
                <span className="ml-1 text-zinc-200 font-medium">{result.steps.length}</span>
              </div>
              <div>
                <span className="text-zinc-500">Model:</span>
                <span className="ml-1 text-purple-400 font-medium">{result.isAcModel ? "AC" : "Std"}</span>
              </div>
            </div>
          </div>

          {/* Progress metrics row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            {/* Total Progress */}
            <div className="bg-zinc-800/50 rounded-lg p-2">
              <div className="text-xs text-zinc-500 mb-1">Total Progress</div>
              <div className={`text-lg font-bold ${
                result.totalProgress > 0.5 ? "text-emerald-400" :
                result.totalProgress > 0.2 ? "text-yellow-400" : "text-zinc-400"
              }`}>
                {(result.totalProgress * 100).toFixed(1)}%
              </div>
            </div>

            {/* Energy Trend */}
            <div className="bg-zinc-800/50 rounded-lg p-2">
              <div className="text-xs text-zinc-500 mb-1">Energy Trend</div>
              <div className={`text-sm font-semibold flex items-center gap-1 ${
                result.energyTrend === "decreasing" ? "text-emerald-400" :
                result.energyTrend === "stable" ? "text-yellow-400" :
                result.energyTrend === "increasing" ? "text-red-400" : "text-zinc-400"
              }`}>
                {result.energyTrend === "decreasing" && "↓ "}
                {result.energyTrend === "increasing" && "↑ "}
                {result.energyTrend === "stable" && "→ "}
                {result.energyTrend.charAt(0).toUpperCase() + result.energyTrend.slice(1)}
              </div>
            </div>

            {/* Distance Reduction */}
            <div className="bg-zinc-800/50 rounded-lg p-2">
              <div className="text-xs text-zinc-500 mb-1">Distance</div>
              <div className="text-xs font-mono text-cyan-400">
                {result.initialDistance.toFixed(3)} → {result.finalDistance.toFixed(3)}
              </div>
            </div>

            {/* Average Energy */}
            <div className="bg-zinc-800/50 rounded-lg p-2">
              <div className="text-xs text-zinc-500 mb-1">Avg Energy</div>
              <div className="text-lg font-bold text-amber-400">
                {result.avgEnergy.toFixed(2)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
