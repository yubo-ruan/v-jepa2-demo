"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { api } from "@/lib/api";
import { usePlanning, useSimulator } from "@/contexts";

// Available RoboSuite tasks
const ROBOSUITE_TASKS = [
  { id: "Lift", label: "Lift", description: "Pick up a cube" },
  { id: "Stack", label: "Stack", description: "Stack cubes" },
  { id: "NutAssembly", label: "Nut Assembly", description: "Assemble nuts on pegs" },
  { id: "PickPlace", label: "Pick & Place", description: "Pick and place objects" },
  { id: "Door", label: "Door", description: "Open a door" },
  { id: "Wipe", label: "Wipe", description: "Wipe a surface" },
];

// Action labels for 7-DOF
const ACTION_LABELS = [
  { label: "X", unit: "m", hint: "Position delta", range: "[-0.05, 0.05]" },
  { label: "Y", unit: "m", hint: "Position delta", range: "[-0.05, 0.05]" },
  { label: "Z", unit: "m", hint: "Position delta", range: "[-0.05, 0.05]" },
  { label: "Roll", unit: "rad", hint: "Rotation delta", range: "[-0.1, 0.1]" },
  { label: "Pitch", unit: "rad", hint: "Rotation delta", range: "[-0.1, 0.1]" },
  { label: "Yaw", unit: "rad", hint: "Rotation delta", range: "[-0.1, 0.1]" },
  { label: "Gripper", unit: "", hint: "-1=open, 1=close", range: "[-1, 1]" },
];

interface SimulatorStatus {
  initialized: boolean;
  available: boolean;
  error?: string;
}

interface StepResult {
  imageBase64: string;
  robotState?: number[];
  reward: number;
  done: boolean;
  rawAction: number[];
  transformedAction: number[];
  message?: string;
}

export function SimulatorPage() {
  const [status, setStatus] = useState<SimulatorStatus | null>(null);
  const [selectedTask, setSelectedTask] = useState("Lift");
  const [action, setAction] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [stepResult, setStepResult] = useState<StepResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stepCount, setStepCount] = useState(0);

  // Get planning result for import action feature
  const { planningState } = usePlanning();
  const hasInferenceResult = planningState.result && planningState.result.action.length === 7;

  // Sync simulator image with shared context for cross-page access
  const { setSimulatorImage, setInitialized } = useSimulator();

  // Sync currentImage to shared context whenever it changes
  useEffect(() => {
    setSimulatorImage(currentImage);
  }, [currentImage, setSimulatorImage]);

  // Sync initialized status to shared context
  useEffect(() => {
    setInitialized(status?.initialized ?? false);
  }, [status?.initialized, setInitialized]);

  // Import action from inference result
  // The planning result stores raw action values (meters, radians, gripper [-1,1])
  // which matches the simulator's expected input format
  const importFromInference = useCallback(() => {
    if (planningState.result && planningState.result.action.length === 7) {
      setAction([...planningState.result.action]);
    }
  }, [planningState.result]);

  // Check simulator status
  const checkStatus = useCallback(async () => {
    try {
      const result = await api.getSimulatorStatus();
      setStatus(result);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to check status");
    }
  }, []);

  // Initialize simulator
  const initializeSimulator = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.initializeSimulator(selectedTask);
      setCurrentImage(result.imageBase64);
      setStepCount(0);
      setStepResult(null);
      await checkStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to initialize");
    } finally {
      setLoading(false);
    }
  }, [checkStatus, selectedTask]);

  // Execute action
  const executeAction = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.stepSimulator(action);
      setCurrentImage(result.imageBase64);
      setStepResult({
        imageBase64: result.imageBase64,
        robotState: result.robotState,
        reward: result.reward,
        done: result.done,
        rawAction: result.rawAction,
        transformedAction: result.transformedAction,
        message: result.message,
      });
      // Reset step count if episode ended (auto-reset happened)
      if (result.done) {
        setStepCount(0);
      } else {
        setStepCount((prev) => prev + 1);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to execute action");
    } finally {
      setLoading(false);
    }
  }, [action]);

  // Reset simulator
  const resetSimulator = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.resetSimulator();
      setCurrentImage(result.imageBase64);
      setStepCount(0);
      setStepResult(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to reset");
    } finally {
      setLoading(false);
    }
  }, []);

  // Update action value
  const updateAction = (index: number, value: string) => {
    const numValue = parseFloat(value) || 0;
    setAction((prev) => {
      const newAction = [...prev];
      newAction[index] = numValue;
      return newAction;
    });
  };

  // Generate random action within appropriate ranges
  const generateRandomAction = () => {
    const randomInRange = (min: number, max: number) =>
      Math.random() * (max - min) + min;

    setAction([
      randomInRange(-0.05, 0.05),  // X position delta
      randomInRange(-0.05, 0.05),  // Y position delta
      randomInRange(-0.05, 0.05),  // Z position delta
      randomInRange(-0.1, 0.1),    // Roll rotation delta
      randomInRange(-0.1, 0.1),    // Pitch rotation delta
      randomInRange(-0.1, 0.1),    // Yaw rotation delta
      randomInRange(-1, 1),        // Gripper
    ]);
  };

  // Save simulator state to local file
  const saveState = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await api.saveSimulatorState();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save state");
    } finally {
      setLoading(false);
    }
  }, []);

  // Load simulator state from file
  const loadState = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    try {
      const result = await api.loadSimulatorState(file);
      setCurrentImage(result.imageBase64);
      setSelectedTask(result.task);
      setStepResult(null);
      await checkStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load state");
    } finally {
      setLoading(false);
      // Reset file input
      e.target.value = "";
    }
  }, [checkStatus]);

  // Track if space key is being held for continuous simulation
  const [isSpaceHeld, setIsSpaceHeld] = useState(false);
  const isSpaceHeldRef = useRef(false);
  const isExecutingRef = useRef(false);

  // Keyboard event handler for space key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input field
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
        return;
      }
      if (e.code === "Space" && !e.repeat) {
        e.preventDefault();
        isSpaceHeldRef.current = true;
        setIsSpaceHeld(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        isSpaceHeldRef.current = false;
        setIsSpaceHeld(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  // Store action in ref for continuous loop access
  const actionRef = useRef(action);
  useEffect(() => {
    actionRef.current = action;
  }, [action]);

  // Continuous simulation while space is held
  useEffect(() => {
    if (!isSpaceHeld || !status?.initialized) {
      return;
    }

    let cancelled = false;

    const runLoop = async () => {
      while (isSpaceHeldRef.current && !cancelled) {
        if (isExecutingRef.current) {
          await new Promise(resolve => setTimeout(resolve, 50));
          continue;
        }

        isExecutingRef.current = true;
        try {
          const result = await api.stepSimulator(actionRef.current);
          if (!cancelled && isSpaceHeldRef.current) {
            setCurrentImage(result.imageBase64);
            setStepResult({
              imageBase64: result.imageBase64,
              robotState: result.robotState,
              reward: result.reward,
              done: result.done,
              rawAction: result.rawAction,
              transformedAction: result.transformedAction,
              message: result.message,
            });
            // Reset step count if episode ended (auto-reset happened)
            if (result.done) {
              setStepCount(0);
            } else {
              setStepCount((prev) => prev + 1);
            }
          }
        } catch (e) {
          setError(e instanceof Error ? e.message : "Failed to execute action");
          isSpaceHeldRef.current = false;
          setIsSpaceHeld(false);
          break;
        } finally {
          isExecutingRef.current = false;
        }
      }
    };

    runLoop();

    return () => {
      cancelled = true;
    };
  }, [isSpaceHeld, status?.initialized]);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">RoboSuite Simulator</h1>
          <p className="text-zinc-400 mt-1">
            Test 7-DOF actions in the RoboSuite Lift environment
          </p>
        </div>
        <button
          onClick={checkStatus}
          className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg transition-colors"
        >
          Check Status
        </button>
      </div>

      {/* Error display */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400">
          {error}
        </div>
      )}

      {/* Status Card */}
      {status && (
        <div className="bg-zinc-800 rounded-lg p-4 border border-zinc-700">
          <h2 className="text-sm font-medium text-zinc-400 mb-2">Status</h2>
          <div className="flex items-center gap-4">
            <span
              className={`px-3 py-1 rounded-full text-sm ${
                status.available
                  ? "bg-green-500/20 text-green-400"
                  : "bg-red-500/20 text-red-400"
              }`}
            >
              {status.available ? "Available" : "Not Available"}
            </span>
            <span
              className={`px-3 py-1 rounded-full text-sm ${
                status.initialized
                  ? "bg-blue-500/20 text-blue-400"
                  : "bg-zinc-600 text-zinc-300"
              }`}
            >
              {status.initialized ? "Initialized" : "Not Initialized"}
            </span>
            {status.error && (
              <span className="text-sm text-red-400">{status.error}</span>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left column: Controls */}
        <div className="space-y-6">
          {/* Initialize/Reset Controls */}
          <div className="bg-zinc-800 rounded-lg p-6 border border-zinc-700">
            <h2 className="text-lg font-semibold text-white mb-4">
              Simulator Controls
            </h2>

            {/* Task Selector */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-zinc-400 mb-2">
                Task
              </label>
              <select
                value={selectedTask}
                onChange={(e) => setSelectedTask(e.target.value)}
                disabled={loading}
                className="w-full bg-zinc-900 border border-zinc-600 rounded-lg px-3 py-2 text-white focus:border-indigo-500 focus:outline-none disabled:opacity-50"
              >
                {ROBOSUITE_TASKS.map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.label} - {task.description}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-4">
              <button
                onClick={initializeSimulator}
                disabled={loading}
                className="flex-1 px-4 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
              >
                {loading ? "Loading..." : "Initialize"}
              </button>
              <button
                onClick={resetSimulator}
                disabled={loading || !status?.initialized}
                className="flex-1 px-4 py-3 bg-zinc-700 hover:bg-zinc-600 disabled:bg-zinc-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
              >
                Reset
              </button>
            </div>

            {/* Save/Load State */}
            <div className="mt-4 pt-4 border-t border-zinc-700">
              <h3 className="text-sm font-medium text-zinc-400 mb-3">State Management</h3>
              <div className="flex gap-3">
                <button
                  onClick={saveState}
                  disabled={loading || !status?.initialized}
                  className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-600 disabled:cursor-not-allowed text-white text-sm rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Save State
                </button>
                <div className="flex-1">
                  <input
                    type="file"
                    id="load-state-input"
                    accept=".pkl"
                    onChange={loadState}
                    className="hidden"
                  />
                  <button
                    onClick={() => document.getElementById("load-state-input")?.click()}
                    disabled={loading}
                    className="w-full px-3 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-zinc-600 disabled:cursor-not-allowed text-white text-sm rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    Load State
                  </button>
                </div>
              </div>
              <p className="text-xs text-zinc-500 mt-2">
                Save simulator state before running inference. Load to restore later.
              </p>
            </div>
          </div>

          {/* Action Input */}
          <div className="bg-zinc-800 rounded-lg p-6 border border-zinc-700">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">
                7-DOF Action Input
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={importFromInference}
                  disabled={!hasInferenceResult}
                  title={hasInferenceResult ? "Import action from Inference result" : "Run inference first to import action"}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    hasInferenceResult
                      ? "bg-indigo-600 hover:bg-indigo-500 text-white"
                      : "bg-zinc-700 text-zinc-500 cursor-not-allowed"
                  }`}
                >
                  ⬇ Import
                </button>
                <button
                  onClick={generateRandomAction}
                  className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 hover:text-white text-sm rounded-lg transition-colors"
                >
                  🎲 Random
                </button>
              </div>
            </div>
            <div className="space-y-4">
              {ACTION_LABELS.map((item, index) => (
                <div key={index} className="grid grid-cols-3 gap-4 items-center">
                  <div>
                    <label className="text-sm font-medium text-zinc-300">
                      {item.label}
                    </label>
                    <p className="text-xs text-zinc-500">{item.hint}</p>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      value={action[index]}
                      onChange={(e) => updateAction(index, e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-600 rounded-lg px-3 py-2 text-white text-center focus:border-indigo-500 focus:outline-none pr-10"
                    />
                    {item.unit && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500">
                        {item.unit}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-zinc-500">{item.range}</span>
                </div>
              ))}
            </div>

            {/* Simulate Button */}
            <button
              onClick={executeAction}
              disabled={loading || !status?.initialized}
              className={`w-full mt-6 px-4 py-4 bg-gradient-to-r ${
                isSpaceHeld
                  ? "from-green-600 to-emerald-600 shadow-green-500/25"
                  : "from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-indigo-500/25"
              } disabled:from-zinc-600 disabled:to-zinc-600 disabled:cursor-not-allowed text-white rounded-lg font-semibold text-lg transition-all shadow-lg`}
            >
              {isSpaceHeld ? "Simulating (Space held)..." : loading ? "Simulating..." : "Simulate"}
            </button>
            <p className="text-xs text-zinc-500 text-center mt-2">
              Hold <kbd className="px-1.5 py-0.5 bg-zinc-700 rounded text-zinc-300">Space</kbd> to simulate continuously
            </p>
          </div>
        </div>

        {/* Right column: Image and Results */}
        <div className="space-y-6">
          {/* Simulator View */}
          <div className="bg-zinc-800 rounded-lg p-6 border border-zinc-700">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">
                Simulator View
              </h2>
              {status?.initialized && (
                <span className="text-sm text-zinc-400">
                  Step: {stepCount}
                </span>
              )}
            </div>
            <div className="aspect-square bg-zinc-900 rounded-lg overflow-hidden flex items-center justify-center">
              {currentImage ? (
                <img
                  src={`data:image/jpeg;base64,${currentImage}`}
                  alt="Simulator observation"
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="text-zinc-500 text-center p-8">
                  <p className="text-lg mb-2">No Image</p>
                  <p className="text-sm">Initialize the simulator to see the observation</p>
                </div>
              )}
            </div>
          </div>

          {/* Step Result */}
          {stepResult && (
            <div className="bg-zinc-800 rounded-lg p-6 border border-zinc-700">
              <h2 className="text-lg font-semibold text-white mb-4">
                Step Result
              </h2>
              {/* Episode reset notification */}
              {stepResult.done && (
                <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-yellow-400 text-sm">
                  Episode ended (horizon: 500 steps). Environment auto-reset.
                </div>
              )}
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Reward</span>
                  <span className="text-white font-mono">
                    {stepResult.reward.toFixed(4)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Done</span>
                  <span
                    className={
                      stepResult.done ? "text-yellow-400" : "text-zinc-300"
                    }
                  >
                    {stepResult.done ? "Yes (Reset)" : "No"}
                  </span>
                </div>
                {stepResult.robotState && (
                  <div>
                    <span className="text-zinc-400">Robot State (EE pos)</span>
                    <div className="mt-1 font-mono text-sm text-white bg-zinc-900 p-2 rounded">
                      [{stepResult.robotState.map((v) => v.toFixed(3)).join(", ")}]
                    </div>
                  </div>
                )}
                <div>
                  <span className="text-zinc-400">Raw Action</span>
                  <div className="mt-1 font-mono text-xs text-zinc-300 bg-zinc-900 p-2 rounded overflow-x-auto">
                    [{stepResult.rawAction.map((v) => v.toFixed(3)).join(", ")}]
                  </div>
                </div>
                <div>
                  <span className="text-zinc-400">Transformed Action</span>
                  <div className="mt-1 font-mono text-xs text-zinc-300 bg-zinc-900 p-2 rounded overflow-x-auto">
                    [{stepResult.transformedAction.map((v) => v.toFixed(3)).join(", ")}]
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
