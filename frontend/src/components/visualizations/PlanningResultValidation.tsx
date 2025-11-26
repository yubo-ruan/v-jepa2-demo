"use client";

import { useMemo } from "react";
import { ACTION_DISPLAY_SCALING } from "@/constants/actionDisplay";

interface PlanningResultValidationProps {
  currentImage?: string;
  goalImage?: string;
  action: number[];
  confidence: number;
  energy: number;
  energyThreshold?: number;
  passesThreshold?: boolean;
  normalizedDistance?: number;
  isAcModel?: boolean;
}

export function PlanningResultValidation({
  currentImage,
  goalImage,
  action,
  confidence,
  energy,
  energyThreshold = 3.0,
  passesThreshold = false,
  normalizedDistance = 0,
  isAcModel = false,
}: PlanningResultValidationProps) {
  // Format action for display
  const actionStr = useMemo(() => {
    if (action.length === 3) {
      // 3D action: apply scaling for position
      return `[${action.map(v => (v * ACTION_DISPLAY_SCALING.POSITION_TO_CM).toFixed(1)).join(', ')}] cm`;
    } else if (action.length === 7) {
      // 7D DROID action: [x, y, z, roll, pitch, yaw, gripper]
      const pos = action.slice(0, 3).map(v => (v * ACTION_DISPLAY_SCALING.POSITION_TO_CM).toFixed(1));
      const rot = action.slice(3, 6).map(v => (v * ACTION_DISPLAY_SCALING.ROTATION_TO_DEG).toFixed(1));
      const gripper = action[6].toFixed(2);
      return (
        `Pos: [${pos.join(', ')}] cm\n` +
        `Rot: [${rot.join(', ')}]°\n` +
        `Gripper: ${gripper}`
      );
    }
    return action.map(v => v.toFixed(2)).join(', ');
  }, [action]);

  // Progress bar width (0-100%)
  const progressWidth = Math.min(100, normalizedDistance * 100);

  // Color based on validation
  const barColor = passesThreshold
    ? "from-green-500 to-emerald-400"
    : "from-red-500 to-orange-400";

  const statusIcon = passesThreshold ? "✅" : "❌";
  const statusText = passesThreshold ? "PASS" : "UNCERTAIN";

  return (
    <div className="bg-zinc-800 rounded-xl border border-zinc-700 p-6 space-y-6">
      <h3 className="text-lg font-semibold text-zinc-200">Planning Result</h3>

      {/* Current → Goal with Action Arrow */}
      <div className="flex items-center gap-6">
        {/* Current Image */}
        <div className="flex-1">
          <p className="text-xs text-zinc-400 mb-2">Current State</p>
          <div className="aspect-square bg-zinc-900 rounded-lg border border-zinc-600 overflow-hidden">
            {currentImage ? (
              <img
                src={currentImage}
                alt="Current state"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-zinc-500">
                No image
              </div>
            )}
          </div>
        </div>

        {/* Action Arrow */}
        <div className="flex flex-col items-center gap-2 px-4">
          <div className="text-4xl text-indigo-400">→</div>
          <div className={`text-xs text-zinc-400 text-center ${action.length === 7 ? 'max-w-[180px]' : 'max-w-[120px]'}`}>
            <p className="font-semibold text-zinc-300 mb-1">Action</p>
            <p className="font-mono text-[10px] whitespace-pre-line">{actionStr}</p>
          </div>
        </div>

        {/* Goal Image */}
        <div className="flex-1">
          <p className="text-xs text-zinc-400 mb-2">Goal State</p>
          <div className="aspect-square bg-zinc-900 rounded-lg border border-zinc-600 overflow-hidden">
            {goalImage ? (
              <img
                src={goalImage}
                alt="Goal state"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-zinc-500">
                No image
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Embedding Distance Validation */}
      <div className="bg-zinc-900 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-zinc-300">
            Embedding Distance
          </h4>
          <div className="flex items-center gap-2">
            <span className="text-2xl">{statusIcon}</span>
            <span
              className={`text-sm font-bold ${
                passesThreshold ? "text-green-400" : "text-red-400"
              }`}
            >
              {statusText}
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="relative h-8 bg-zinc-800 rounded-lg overflow-hidden border border-zinc-700">
          <div
            className={`h-full bg-gradient-to-r ${barColor} transition-all duration-500`}
            style={{ width: `${progressWidth}%` }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-sm font-mono font-semibold text-white drop-shadow-lg">
              {energy.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-zinc-500">Threshold</p>
            <p className="font-mono text-zinc-200">{energyThreshold.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">Confidence</p>
            <p className="font-mono text-zinc-200">
              {(confidence * 100).toFixed(0)}%
            </p>
          </div>
        </div>

        {/* Explanation */}
        <p className="text-xs text-zinc-500 pt-2 border-t border-zinc-800">
          {passesThreshold
            ? "✓ Predicted action likely to reach goal state (low embedding distance)"
            : "⚠ Predicted action may not reach goal state (high embedding distance)"}
        </p>
      </div>
    </div>
  );
}
