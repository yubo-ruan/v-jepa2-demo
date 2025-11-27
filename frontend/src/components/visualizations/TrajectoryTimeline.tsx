"use client";

import { useMemo, useState, useEffect } from "react";
import { CheckCircleIcon, ClockIcon } from "@/components/icons";
import { ACTION_LABELS, ACTION_DISPLAY_SCALING } from "@/constants/actionDisplay";
import type { TrajectoryStep, TrajectoryProgress, TrajectoryResult, SingleStepResult } from "@/lib/api";

// Step-by-step state types (matching PlanningContext)
type StepByStepStatus = "idle" | "waiting_for_image" | "planning" | "completed";

// Extended step result that includes the input image for display
interface SingleStepResultWithImage extends SingleStepResult {
  inputImageDataUrl?: string;  // Base64 data URL of input image for display
}

interface StepByStepState {
  status: StepByStepStatus;
  currentStepIndex: number;
  completedSteps: SingleStepResultWithImage[];
  currentStepProgress: number | null;
  error: string | null;
}

interface TrajectoryTimelineProps {
  progress?: TrajectoryProgress | null;
  result?: TrajectoryResult | null;
  isProcessing?: boolean;
  // Step-by-step mode props
  stepByStepState?: StepByStepState | null;
  totalStepsTarget?: number;  // Total number of steps to plan
  isSimulatorInitialized?: boolean;
  onImportFromSimulator?: () => void;
  onSimulateAction?: (action: number[]) => void;  // Send action to simulator
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

// Camera/Import icon for simulator import
function CameraIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

// Rocket icon for simulate button
function RocketIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
    </svg>
  );
}

export function TrajectoryTimeline({
  progress,
  result,
  isProcessing,
  stepByStepState,
  totalStepsTarget = 5,
  isSimulatorInitialized = false,
  onImportFromSimulator,
  onSimulateAction,
}: TrajectoryTimelineProps) {
  // Determine if we're in step-by-step mode
  const isStepByStepMode = stepByStepState && stepByStepState.status !== "idle";

  // Extended step type with optional input image
  type StepWithImage = TrajectoryStep & { inputImageDataUrl?: string };

  // For step-by-step mode, use the step-by-step state
  // For regular mode, use progress/result
  const steps: StepWithImage[] = isStepByStepMode
    ? stepByStepState.completedSteps.map((step, index) => ({
        step: index,
        action: step.action,
        energy: step.energy,
        confidence: step.confidence,
        energyHistory: step.energyHistory,
        distanceToGoal: step.distanceToGoal ?? 0,  // Normalized distance from backend
        progressRatio: 0,    // Not available in step-by-step mode (no rollout)
        inputImageDataUrl: step.inputImageDataUrl,  // Include input image for display
      }))
    : (result?.steps ?? progress?.completedSteps ?? []);

  const currentStep = isStepByStepMode
    ? stepByStepState.currentStepIndex
    : (progress?.currentStep ?? 0);

  const totalSteps = isStepByStepMode
    ? totalStepsTarget
    : (result?.steps?.length ?? progress?.totalSteps ?? 0);

  const isComplete = isStepByStepMode
    ? stepByStepState.status === "completed"
    : !!result;

  // Track expanded steps
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());
  // Track copy feedback
  const [copiedStep, setCopiedStep] = useState<number | null>(null);

  // Auto-expand steps in step-by-step mode
  useEffect(() => {
    if (isStepByStepMode && stepByStepState) {
      // Auto-expand all completed steps and the current step being worked on
      const stepsToExpand = new Set<number>();

      // Add all completed step indices
      for (let i = 0; i < stepByStepState.completedSteps.length; i++) {
        stepsToExpand.add(i);
      }

      setExpandedSteps(stepsToExpand);
    }
  }, [isStepByStepMode, stepByStepState?.completedSteps.length, stepByStepState?.status]);

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

  // Format full 7-DOF action for step bar display
  const formatFullAction = (action: number[]) => {
    if (action.length === 7) {
      const x = (action[0] * ACTION_DISPLAY_SCALING.POSITION_TO_CM).toFixed(1);
      const y = (action[1] * ACTION_DISPLAY_SCALING.POSITION_TO_CM).toFixed(1);
      const z = (action[2] * ACTION_DISPLAY_SCALING.POSITION_TO_CM).toFixed(1);
      const roll = (action[3] * ACTION_DISPLAY_SCALING.ROTATION_TO_DEG).toFixed(1);
      const pitch = (action[4] * ACTION_DISPLAY_SCALING.ROTATION_TO_DEG).toFixed(1);
      const yaw = (action[5] * ACTION_DISPLAY_SCALING.ROTATION_TO_DEG).toFixed(1);
      const grip = Math.round(((action[6] - ACTION_DISPLAY_SCALING.GRIPPER_MIN) /
        (ACTION_DISPLAY_SCALING.GRIPPER_MAX - ACTION_DISPLAY_SCALING.GRIPPER_MIN)) * 100);
      return {
        pos: `(${x}, ${y}, ${z})`,
        rot: `(${roll}, ${pitch}, ${yaw})`,
        grip: `${grip}%`,
      };
    }
    return null;
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

  if (totalSteps === 0 && !isProcessing && !isStepByStepMode) {
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

      {/* Step-by-step: Waiting for image state */}
      {isStepByStepMode && stepByStepState.status === "waiting_for_image" && (
        <div className="mb-5 p-4 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 rounded-lg border border-blue-500/30">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                <CameraIcon className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-blue-300">
                  Waiting for Step {currentStep + 1} Image
                </p>
                <p className="text-xs text-zinc-400">
                  Import the current observation from the simulator
                </p>
              </div>
            </div>
            <div className="text-sm text-zinc-500">
              {steps.length} / {totalSteps} completed
            </div>
          </div>

          {/* Import button - only shown when simulator is initialized */}
          {isSimulatorInitialized && onImportFromSimulator ? (
            <button
              onClick={onImportFromSimulator}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors"
            >
              <CameraIcon className="w-5 h-5" />
              Import from Simulator
            </button>
          ) : (
            <div className="w-full px-4 py-3 bg-zinc-700/50 text-zinc-400 text-center text-sm rounded-lg border border-zinc-600">
              {isSimulatorInitialized
                ? "Loading..."
                : "Initialize the simulator on the Simulator page to import images"}
            </div>
          )}

          {/* Error message */}
          {stepByStepState.error && (
            <div className="mt-3 p-2 bg-red-500/10 border border-red-500/30 rounded text-sm text-red-400">
              {stepByStepState.error}
            </div>
          )}
        </div>
      )}

      {/* Step-by-step: Planning in progress */}
      {isStepByStepMode && stepByStepState.status === "planning" && (
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
              Processing...
            </span>
          </div>
          <div className="h-2 bg-zinc-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-600 to-teal-500 rounded-full transition-all duration-300 animate-pulse"
              style={{ width: "100%" }}
            />
          </div>
          <p className="text-xs text-zinc-500 mt-2">Running CEM optimization...</p>
        </div>
      )}

      {/* Regular trajectory mode: Progress indicator for current step */}
      {!isStepByStepMode && isProcessing && progress && !isComplete && (
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
            const step = steps.find(s => s.step === index) as StepWithImage | undefined;
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

                  {/* Step summary - Full 7-DOF display */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-sm font-medium shrink-0 ${
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
                      {step && (() => {
                        const formatted = formatFullAction(step.action);
                        if (!formatted) return null;
                        return (
                          <span className="text-xs font-mono flex items-center gap-1.5 flex-wrap">
                            <span className="text-zinc-500">Δ</span>
                            <span className="text-red-400">{formatted.pos}</span>
                            <span className="text-zinc-600">cm</span>
                            <span className="text-zinc-600">•</span>
                            <span className="text-amber-400">{formatted.rot}</span>
                            <span className="text-zinc-600">°</span>
                            <span className="text-zinc-600">•</span>
                            <span className="text-pink-400">Grip {formatted.grip}</span>
                          </span>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Right side: Energy + Expand button */}
                  {step && (
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-amber-400 font-mono">E:{step.energy.toFixed(2)}</span>
                      </div>
                      <ChevronIcon expanded={isExpanded} className="w-4 h-4 text-zinc-500" />
                    </div>
                  )}

                  {isPending && (
                    <span className="text-xs text-zinc-600">Pending</span>
                  )}
                </div>

                {/* Expanded Details - Compact Layout */}
                {isCompleted && isExpanded && step && (
                  <div className="px-3 pb-3 pt-0 border-t border-zinc-800 mt-0 animate-in slide-in-from-top-2 duration-200">
                    <div className="ml-13 pl-10 pt-3">
                      {/* Input Image + Action Data Row */}
                      <div className="flex gap-4">
                        {/* Input Image - Step-by-step mode only (larger size) */}
                        {isStepByStepMode && step.inputImageDataUrl && (
                          <div className="shrink-0">
                            <p className="text-[10px] text-zinc-500 mb-1">Input</p>
                            <div className="w-32 h-32 rounded-lg overflow-hidden border border-zinc-700 bg-zinc-800">
                              <img
                                src={step.inputImageDataUrl}
                                alt={`Step ${index + 1} input`}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          </div>
                        )}

                        {/* Compact 7D Action Display with units */}
                        {step.action.length === 7 && (
                          <div className="flex-1 min-w-0">
                            {/* Action Table */}
                            <div className="bg-zinc-800/50 rounded-lg p-2">
                              <table className="w-full text-xs">
                                <tbody>
                                  {/* Position Row */}
                                  <tr>
                                    <td className="text-zinc-500 pr-2 py-0.5 w-20">Position</td>
                                    <td className="text-red-400 font-mono pr-3">
                                      X: {(step.action[0] * ACTION_DISPLAY_SCALING.POSITION_TO_CM).toFixed(2)} <span className="text-zinc-600">cm</span>
                                    </td>
                                    <td className="text-green-400 font-mono pr-3">
                                      Y: {(step.action[1] * ACTION_DISPLAY_SCALING.POSITION_TO_CM).toFixed(2)} <span className="text-zinc-600">cm</span>
                                    </td>
                                    <td className="text-blue-400 font-mono">
                                      Z: {(step.action[2] * ACTION_DISPLAY_SCALING.POSITION_TO_CM).toFixed(2)} <span className="text-zinc-600">cm</span>
                                    </td>
                                  </tr>
                                  {/* Rotation Row */}
                                  <tr>
                                    <td className="text-zinc-500 pr-2 py-0.5">Rotation</td>
                                    <td className="text-amber-400 font-mono pr-3">
                                      Roll: {(step.action[3] * ACTION_DISPLAY_SCALING.ROTATION_TO_DEG).toFixed(1)}<span className="text-zinc-600">°</span>
                                    </td>
                                    <td className="text-purple-400 font-mono pr-3">
                                      Pitch: {(step.action[4] * ACTION_DISPLAY_SCALING.ROTATION_TO_DEG).toFixed(1)}<span className="text-zinc-600">°</span>
                                    </td>
                                    <td className="text-cyan-400 font-mono">
                                      Yaw: {(step.action[5] * ACTION_DISPLAY_SCALING.ROTATION_TO_DEG).toFixed(1)}<span className="text-zinc-600">°</span>
                                    </td>
                                  </tr>
                                  {/* Gripper Row */}
                                  <tr>
                                    <td className="text-zinc-500 pr-2 py-0.5">Gripper</td>
                                    <td colSpan={3} className="py-0.5">
                                      <div className="flex items-center gap-2">
                                        {/* Open/Close labels */}
                                        <span className="text-[10px] text-zinc-600">Open</span>
                                        <div className="flex-1 h-2 bg-zinc-700 rounded-full overflow-hidden max-w-32">
                                          <div
                                            className="h-full bg-gradient-to-r from-pink-600 to-pink-400 rounded-full transition-all"
                                            style={{
                                              width: `${Math.max(0, Math.min(100, ((step.action[6] - ACTION_DISPLAY_SCALING.GRIPPER_MIN) /
                                                (ACTION_DISPLAY_SCALING.GRIPPER_MAX - ACTION_DISPLAY_SCALING.GRIPPER_MIN)) * 100))}%`
                                            }}
                                          />
                                        </div>
                                        <span className="text-[10px] text-zinc-600">Close</span>
                                        <span className="text-pink-400 font-mono ml-1">
                                          {Math.round(((step.action[6] - ACTION_DISPLAY_SCALING.GRIPPER_MIN) /
                                            (ACTION_DISPLAY_SCALING.GRIPPER_MAX - ACTION_DISPLAY_SCALING.GRIPPER_MIN)) * 100)}%
                                        </span>
                                      </div>
                                    </td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>

                            {/* Action Buttons */}
                            <div className="mt-2 flex gap-2">
                              {!isStepByStepMode && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    copyAction(step, index);
                                  }}
                                  className="flex items-center gap-1.5 px-2 py-1 text-xs text-zinc-400 hover:text-zinc-200 bg-zinc-700/50 hover:bg-zinc-700 rounded transition-colors"
                                >
                                  <CopyIcon className="w-3 h-3" />
                                  {copiedStep === index ? "Copied!" : "Copy"}
                                </button>
                              )}
                              {isStepByStepMode && onSimulateAction && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onSimulateAction(step.action);
                                  }}
                                  className="flex items-center gap-1.5 px-3 py-1 text-xs text-white bg-emerald-600 hover:bg-emerald-500 rounded transition-colors"
                                >
                                  <RocketIcon className="w-3 h-3" />
                                  Simulate
                                </button>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Energy Landscape Hover Area */}
                        {step.energyHistory && step.energyHistory.length > 0 && (
                          <div className="shrink-0 group relative">
                            <div className="w-20 h-16 bg-zinc-800/50 rounded-lg p-1.5 cursor-help border border-zinc-700 hover:border-amber-500/50 transition-colors">
                              <p className="text-[10px] text-zinc-500 mb-0.5">Energy</p>
                              <div className="h-8 flex items-end gap-px">
                                {step.energyHistory.slice(-10).map((e, i, arr) => {
                                  const max = Math.max(...arr);
                                  const min = Math.min(...arr);
                                  const range = max - min || 1;
                                  const height = ((e - min) / range) * 100;
                                  return (
                                    <div
                                      key={i}
                                      className="flex-1 bg-gradient-to-t from-amber-600 to-amber-400 rounded-t opacity-70"
                                      style={{ height: `${Math.max(height, 10)}%` }}
                                    />
                                  );
                                })}
                              </div>
                            </div>
                            {/* Hover Tooltip with Full Energy Data */}
                            <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block z-20">
                              <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-3 shadow-xl min-w-48">
                                <p className="text-xs font-medium text-zinc-300 mb-2">CEM Energy Convergence</p>
                                <div className="h-20 flex items-end gap-0.5 mb-2">
                                  {step.energyHistory.map((e, i) => {
                                    const max = Math.max(...step.energyHistory);
                                    const min = Math.min(...step.energyHistory);
                                    const range = max - min || 1;
                                    const height = ((e - min) / range) * 100;
                                    return (
                                      <div
                                        key={i}
                                        className="flex-1 bg-gradient-to-t from-amber-600 to-amber-400 rounded-t hover:from-amber-500 hover:to-amber-300 transition-colors"
                                        style={{ height: `${Math.max(height, 5)}%` }}
                                        title={`Iter ${i + 1}: ${e.toFixed(4)}`}
                                      />
                                    );
                                  })}
                                </div>
                                <div className="flex justify-between text-[10px] text-zinc-500">
                                  <span>Start: {step.energyHistory[0]?.toFixed(3)}</span>
                                  <span>Final: {step.energyHistory[step.energyHistory.length - 1]?.toFixed(3)}</span>
                                </div>
                                <div className="text-[10px] text-zinc-400 mt-1">
                                  Δ: {((step.energyHistory[0] || 0) - (step.energyHistory[step.energyHistory.length - 1] || 0)).toFixed(3)} ({step.energyHistory.length} iters)
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary when complete - Step-by-step mode */}
      {isStepByStepMode && stepByStepState.status === "completed" && (
        <div className="mt-5 p-4 bg-gradient-to-r from-green-500/10 to-emerald-500/10 rounded-lg border border-green-500/20">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <CheckCircleIcon className="w-5 h-5 text-green-400" />
              <span className="text-sm font-medium text-green-400">Step-by-Step Trajectory Complete</span>
            </div>
            <div className="flex gap-4 text-sm">
              <div>
                <span className="text-zinc-500">Steps:</span>
                <span className="ml-1 text-zinc-200 font-medium">{steps.length}</span>
              </div>
              <div>
                <span className="text-zinc-500">Mode:</span>
                <span className="ml-1 text-blue-400 font-medium">Real Feedback</span>
              </div>
            </div>
          </div>

          {/* Simple metrics for step-by-step mode */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            {/* Average Energy */}
            <div className="bg-zinc-800/50 rounded-lg p-2">
              <div className="text-xs text-zinc-500 mb-1">Avg Energy</div>
              <div className="text-lg font-bold text-amber-400">
                {stats?.avgEnergy.toFixed(2) || "N/A"}
              </div>
            </div>

            {/* Average Confidence */}
            <div className="bg-zinc-800/50 rounded-lg p-2">
              <div className="text-xs text-zinc-500 mb-1">Avg Confidence</div>
              <div className="text-lg font-bold text-green-400">
                {stats ? `${(stats.avgConfidence * 100).toFixed(0)}%` : "N/A"}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Summary when complete - Regular trajectory mode */}
      {!isStepByStepMode && isComplete && result && (
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
