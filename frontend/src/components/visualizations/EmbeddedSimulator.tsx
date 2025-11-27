"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "@/lib/api";

interface EmbeddedSimulatorProps {
  /** The action to pre-load and execute */
  pendingAction?: number[] | null;
  /** Called when user clicks "Continue" with the current simulator image */
  onContinue?: (imageBase64: string) => void;
  /** Whether Continue button should be disabled (e.g., during planning) */
  continueDisabled?: boolean;
  /** Label for continue button */
  continueLabel?: string;
}

// Play icon for simulate button
function PlayIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

// Arrow right icon for continue
function ArrowRightIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
    </svg>
  );
}

// Reset icon
function ResetIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}

export function EmbeddedSimulator({
  pendingAction,
  onContinue,
  continueDisabled = false,
  continueLabel = "Continue to Next Step",
}: EmbeddedSimulatorProps) {
  // Simulator state
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<{
    reward: number;
    done: boolean;
    robotState?: number[];
  } | null>(null);

  // Action state - load from pending action
  const [action, setAction] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);
  const [hasExecuted, setHasExecuted] = useState(false);

  // Keyboard hold execution state
  const isHoldingRef = useRef(false);
  const executionLoopRef = useRef<boolean>(false);
  const [stepCount, setStepCount] = useState(0);

  // Load pending action when provided
  useEffect(() => {
    if (pendingAction && pendingAction.length === 7) {
      setAction([...pendingAction]);
      setHasExecuted(false);
    }
  }, [pendingAction]);

  // Check simulator status on mount
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const status = await api.getSimulatorStatus();
        setIsInitialized(status.initialized);
        if (status.error) {
          setError(status.error);
        }
      } catch (err) {
        console.error("Failed to check simulator status:", err);
      }
    };
    checkStatus();
  }, []);

  // Initialize simulator
  const initializeSimulator = useCallback(async () => {
    setIsInitializing(true);
    setError(null);
    try {
      const result = await api.initializeSimulator("Lift");
      setCurrentImage(result.imageBase64);
      setIsInitialized(true);
      setHasExecuted(false);
      setLastResult(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to initialize simulator");
    } finally {
      setIsInitializing(false);
    }
  }, []);

  // Execute action
  const executeAction = useCallback(async () => {
    if (!isInitialized) {
      setError("Simulator not initialized");
      return;
    }

    setIsExecuting(true);
    setError(null);
    try {
      const result = await api.stepSimulator(action);
      setCurrentImage(result.imageBase64);
      setLastResult({
        reward: result.reward,
        done: result.done,
        robotState: result.robotState,
      });
      setHasExecuted(true);
      setStepCount((prev) => prev + 1);

      // Auto-reset if episode done
      if (result.done) {
        console.log("[EmbeddedSimulator] Episode done, environment was auto-reset");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to execute action");
    } finally {
      setIsExecuting(false);
    }
  }, [action, isInitialized]);

  // Reset simulator
  const resetSimulator = useCallback(async () => {
    if (!isInitialized) return;

    setIsExecuting(true);
    setError(null);
    try {
      const result = await api.resetSimulator();
      setCurrentImage(result.imageBase64);
      setLastResult(null);
      setHasExecuted(false);
      setStepCount(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset simulator");
    } finally {
      setIsExecuting(false);
    }
  }, [isInitialized]);

  // Continuous execution loop for keyboard hold
  const runContinuousExecution = useCallback(async () => {
    if (!isInitialized || !pendingAction || executionLoopRef.current) return;

    executionLoopRef.current = true;

    while (isHoldingRef.current && !executionLoopRef.current === false) {
      try {
        const result = await api.stepSimulator(action);
        setCurrentImage(result.imageBase64);
        setLastResult({
          reward: result.reward,
          done: result.done,
          robotState: result.robotState,
        });
        setHasExecuted(true);
        setStepCount((prev) => prev + 1);

        // Stop if episode done
        if (result.done) {
          console.log("[EmbeddedSimulator] Episode done during continuous execution");
          break;
        }

        // Small delay between steps for visual feedback
        await new Promise((resolve) => setTimeout(resolve, 50));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to execute action");
        break;
      }
    }

    executionLoopRef.current = false;
    setIsExecuting(false);
  }, [action, isInitialized, pendingAction]);

  // Keyboard event handlers for hold-to-execute (Space key)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only respond to Space key, and only when simulator is ready
      if (e.code === "Space" && !e.repeat && isInitialized && pendingAction && !isExecuting) {
        e.preventDefault();
        isHoldingRef.current = true;
        setIsExecuting(true);
        runContinuousExecution();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        isHoldingRef.current = false;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      isHoldingRef.current = false;
    };
  }, [isInitialized, pendingAction, isExecuting, runContinuousExecution]);

  // Handle continue button
  const handleContinue = useCallback(() => {
    if (currentImage && onContinue) {
      onContinue(currentImage);
    }
  }, [currentImage, onContinue]);

  // Format action values for display
  const formatValue = (val: number, scale: number, unit: string) => {
    return `${(val * scale).toFixed(2)}${unit}`;
  };

  return (
    <div className="bg-zinc-900 rounded-lg border border-zinc-700 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-2 bg-zinc-800 border-b border-zinc-700 flex items-center justify-between">
        <h4 className="text-sm font-medium text-zinc-300">Simulator</h4>
        <div className="flex items-center gap-2">
          {isInitialized ? (
            <span className="flex items-center gap-1.5 text-xs text-green-400">
              <span className="w-2 h-2 rounded-full bg-green-400" />
              Ready
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-xs text-zinc-500">
              <span className="w-2 h-2 rounded-full bg-zinc-500" />
              Not initialized
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Not initialized state */}
        {!isInitialized && !isInitializing && (
          <div className="flex flex-col items-center justify-center py-6">
            <p className="text-sm text-zinc-400 mb-3">Initialize simulator to execute actions</p>
            <button
              onClick={initializeSimulator}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Initialize Simulator
            </button>
          </div>
        )}

        {/* Initializing state */}
        {isInitializing && (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-sm text-zinc-400">Initializing simulator...</p>
          </div>
        )}

        {/* Initialized state */}
        {isInitialized && !isInitializing && (
          <div className="space-y-4">
            {/* Simulator image */}
            <div className="relative aspect-square max-w-xs mx-auto bg-zinc-800 rounded-lg overflow-hidden border border-zinc-700">
              {currentImage ? (
                <img
                  src={`data:image/jpeg;base64,${currentImage}`}
                  alt="Simulator view"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-500">
                  No image
                </div>
              )}
              {isExecuting && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>

            {/* Action display (compact) */}
            {pendingAction && (
              <div className="bg-zinc-800/50 rounded-lg p-3">
                <p className="text-xs text-zinc-500 mb-2">Action to execute:</p>
                <div className="grid grid-cols-3 gap-2 text-xs font-mono">
                  <div>
                    <span className="text-zinc-500">X:</span>
                    <span className="text-red-400 ml-1">{formatValue(action[0], 100, "cm")}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500">Y:</span>
                    <span className="text-green-400 ml-1">{formatValue(action[1], 100, "cm")}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500">Z:</span>
                    <span className="text-blue-400 ml-1">{formatValue(action[2], 100, "cm")}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500">Roll:</span>
                    <span className="text-amber-400 ml-1">{formatValue(action[3], 57.3, "°")}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500">Pitch:</span>
                    <span className="text-purple-400 ml-1">{formatValue(action[4], 57.3, "°")}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500">Yaw:</span>
                    <span className="text-cyan-400 ml-1">{formatValue(action[5], 57.3, "°")}</span>
                  </div>
                </div>
                <div className="mt-2">
                  <span className="text-zinc-500 text-xs">Gripper:</span>
                  <span className="text-pink-400 text-xs font-mono ml-1">
                    {Math.round(((action[6] + 1) / 2) * 100)}%
                  </span>
                </div>
              </div>
            )}

            {/* Last result feedback */}
            {lastResult && (
              <div className="bg-zinc-800/50 rounded-lg p-2 flex items-center gap-3 text-xs">
                <div>
                  <span className="text-zinc-500">Reward:</span>
                  <span className={`ml-1 font-medium ${lastResult.reward > 0 ? "text-green-400" : "text-zinc-300"}`}>
                    {lastResult.reward.toFixed(3)}
                  </span>
                </div>
                {stepCount > 0 && (
                  <div>
                    <span className="text-zinc-500">Steps:</span>
                    <span className="text-amber-400 ml-1 font-medium">{stepCount}</span>
                  </div>
                )}
                {lastResult.robotState && (
                  <div className="text-zinc-500">
                    EEF: ({lastResult.robotState.map(v => v.toFixed(2)).join(", ")})
                  </div>
                )}
              </div>
            )}

            {/* Error message */}
            {error && (
              <div className="p-2 bg-red-500/10 border border-red-500/30 rounded text-sm text-red-400">
                {error}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-2">
              {/* Execute button - show when not executed or when user wants to run more steps */}
              <button
                onClick={executeAction}
                disabled={isExecuting || !pendingAction}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-white text-sm font-medium rounded-lg transition-colors ${
                  isExecuting || !pendingAction
                    ? "bg-emerald-600/50 cursor-not-allowed"
                    : "bg-emerald-600 hover:bg-emerald-500"
                }`}
              >
                {isExecuting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Executing...
                  </>
                ) : (
                  <>
                    <PlayIcon />
                    {hasExecuted ? "Execute Again" : "Execute Action"}
                  </>
                )}
              </button>

              {/* Continue button - show after execution */}
              {hasExecuted && onContinue && (
                <button
                  onClick={handleContinue}
                  disabled={continueDisabled || !currentImage}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-white text-sm font-medium rounded-lg transition-colors ${
                    continueDisabled || !currentImage
                      ? "bg-blue-600/50 cursor-not-allowed"
                      : "bg-blue-600 hover:bg-blue-500"
                  }`}
                >
                  {continueDisabled ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Planning...
                    </>
                  ) : (
                    <>
                      <ArrowRightIcon />
                      {continueLabel}
                    </>
                  )}
                </button>
              )}

              {/* Reset button */}
              <button
                onClick={resetSimulator}
                disabled={isExecuting}
                className="px-3 py-2.5 text-zinc-400 hover:text-zinc-200 bg-zinc-700/50 hover:bg-zinc-700 rounded-lg transition-colors"
                title="Reset simulator"
              >
                <ResetIcon />
              </button>
            </div>

            {/* Keyboard shortcut hint */}
            {pendingAction && (
              <p className="text-xs text-zinc-500 text-center">
                Hold <kbd className="px-1.5 py-0.5 bg-zinc-700 rounded text-zinc-400 font-mono">Space</kbd> for continuous execution
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
