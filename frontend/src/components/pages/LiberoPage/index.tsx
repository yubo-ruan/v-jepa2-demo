"use client";

import { useState, useCallback, useEffect } from "react";
import { CheckCircleIcon, ClockIcon } from "@/components/icons";

// API base URL
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

// Task suite types
interface TaskSuite {
  name: string;
  description: string;
  task_count: number;
  focus: string;
}

interface Task {
  id: number;
  name: string;
  language: string;
}

interface TaskInfo {
  suite_id: string;
  suite_name: string;
  task_id: number;
  task_name: string;
  language: string;
  focus: string;
}

interface LiberoStatus {
  available: boolean;
  initialized: boolean;
  current_suite: string | null;
  current_task_id: number | null;
  task_info: TaskInfo | null;
}

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

// Play icon
function PlayIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

// Reset icon
function ResetIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}

// External link icon
function ExternalLinkIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
    </svg>
  );
}

export function LiberoPage() {
  // State
  const [status, setStatus] = useState<LiberoStatus | null>(null);
  const [suites, setSuites] = useState<Record<string, TaskSuite>>({});
  const [selectedSuite, setSelectedSuite] = useState<string>("libero_spatial");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<number>(0);
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [action, setAction] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);
  const [stepResult, setStepResult] = useState<{ reward: number; done: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stepCount, setStepCount] = useState(0);

  // Fetch status
  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/libero/status`);
      if (!response.ok) throw new Error("Failed to fetch status");
      const data = await response.json();
      setStatus(data);
    } catch (e) {
      console.error("Failed to fetch LIBERO status:", e);
    }
  }, []);

  // Fetch task suites
  const fetchSuites = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/libero/suites`);
      if (!response.ok) throw new Error("Failed to fetch suites");
      const data = await response.json();
      setSuites(data.suites);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch suites");
    }
  }, []);

  // Fetch tasks for selected suite
  const fetchTasks = useCallback(async (suiteId: string) => {
    try {
      const response = await fetch(`${API_BASE}/libero/suites/${suiteId}/tasks`);
      if (!response.ok) throw new Error("Failed to fetch tasks");
      const data = await response.json();
      setTasks(data.tasks);
      setSelectedTaskId(0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch tasks");
    }
  }, []);

  // Initialize task
  const initializeTask = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/libero/initialize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          suite_id: selectedSuite,
          task_id: selectedTaskId,
        }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || "Failed to initialize");
      }
      const data = await response.json();
      setCurrentImage(data.image_base64);
      setStepCount(0);
      setStepResult(null);
      await fetchStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to initialize task");
    } finally {
      setLoading(false);
    }
  }, [selectedSuite, selectedTaskId, fetchStatus]);

  // Execute action
  const executeAction = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/libero/step`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || "Failed to step");
      }
      const data = await response.json();
      setCurrentImage(data.image_base64);
      setStepResult({ reward: data.reward, done: data.done });
      setStepCount((prev) => prev + 1);

      if (data.done) {
        setError("Task completed!");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to execute action");
    } finally {
      setLoading(false);
    }
  }, [action]);

  // Reset task
  const resetTask = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/libero/reset`, {
        method: "POST",
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || "Failed to reset");
      }
      const data = await response.json();
      setCurrentImage(data.image_base64);
      setStepCount(0);
      setStepResult(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to reset task");
    } finally {
      setLoading(false);
    }
  }, []);

  // Update action value
  const updateAction = (index: number, value: number) => {
    setAction((prev) => {
      const newAction = [...prev];
      newAction[index] = value;
      return newAction;
    });
  };

  // Initial fetch
  useEffect(() => {
    fetchStatus();
    fetchSuites();
  }, [fetchStatus, fetchSuites]);

  // Fetch tasks when suite changes
  useEffect(() => {
    if (selectedSuite) {
      fetchTasks(selectedSuite);
    }
  }, [selectedSuite, fetchTasks]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-zinc-800 rounded-xl border border-zinc-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-white flex items-center gap-3">
              LIBERO Benchmark
              {status?.available ? (
                <span className="flex items-center gap-1.5 text-xs px-2 py-1 bg-green-500/20 text-green-400 rounded-full">
                  <span className="w-2 h-2 rounded-full bg-green-400" />
                  Available
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-xs px-2 py-1 bg-amber-500/20 text-amber-400 rounded-full">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  Simulation Mode
                </span>
              )}
            </h2>
            <p className="text-sm text-zinc-400 mt-1">
              Lifelong robot learning benchmark with 130 manipulation tasks across 4 task suites
            </p>
          </div>
          <a
            href="https://libero-project.github.io/main.html"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-400 hover:text-white bg-zinc-700/50 hover:bg-zinc-700 rounded-lg transition-colors"
          >
            <ExternalLinkIcon />
            Documentation
          </a>
        </div>

        {/* Info cards */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-zinc-900 rounded-lg p-4">
            <p className="text-xs text-zinc-500 mb-1">Task Suites</p>
            <p className="text-2xl font-semibold text-indigo-400">4</p>
          </div>
          <div className="bg-zinc-900 rounded-lg p-4">
            <p className="text-xs text-zinc-500 mb-1">Total Tasks</p>
            <p className="text-2xl font-semibold text-emerald-400">130</p>
          </div>
          <div className="bg-zinc-900 rounded-lg p-4">
            <p className="text-xs text-zinc-500 mb-1">Action Space</p>
            <p className="text-2xl font-semibold text-amber-400">7-DOF</p>
          </div>
          <div className="bg-zinc-900 rounded-lg p-4">
            <p className="text-xs text-zinc-500 mb-1">Focus</p>
            <p className="text-lg font-semibold text-purple-400">Knowledge Transfer</p>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Task Selection */}
        <div className="lg:col-span-1 space-y-4">
          {/* Suite Selection */}
          <div className="bg-zinc-800 rounded-xl border border-zinc-700 p-4">
            <h3 className="text-sm font-semibold text-zinc-300 mb-3">Task Suite</h3>
            <select
              value={selectedSuite}
              onChange={(e) => setSelectedSuite(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {Object.entries(suites).map(([id, suite]) => (
                <option key={id} value={id}>
                  {suite.name} ({suite.task_count} tasks)
                </option>
              ))}
            </select>
            {suites[selectedSuite] && (
              <div className="mt-3 p-3 bg-zinc-900 rounded-lg">
                <p className="text-xs text-zinc-400">{suites[selectedSuite].description}</p>
                <p className="text-xs text-indigo-400 mt-2">
                  Focus: {suites[selectedSuite].focus}
                </p>
              </div>
            )}
          </div>

          {/* Task Selection */}
          <div className="bg-zinc-800 rounded-xl border border-zinc-700 p-4">
            <h3 className="text-sm font-semibold text-zinc-300 mb-3">
              Select Task ({tasks.length} available)
            </h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {tasks.map((task) => (
                <button
                  key={task.id}
                  onClick={() => setSelectedTaskId(task.id)}
                  className={`w-full text-left p-3 rounded-lg transition-colors ${
                    selectedTaskId === task.id
                      ? "bg-indigo-600 text-white"
                      : "bg-zinc-900 text-zinc-300 hover:bg-zinc-700"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono bg-zinc-800 px-1.5 py-0.5 rounded">
                      {task.id}
                    </span>
                    <span className="text-sm truncate">{task.language}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Initialize Button */}
          <button
            onClick={initializeTask}
            disabled={loading}
            className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-white font-medium transition-colors ${
              loading
                ? "bg-indigo-600/50 cursor-not-allowed"
                : "bg-indigo-600 hover:bg-indigo-500"
            }`}
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Initializing...
              </>
            ) : (
              <>
                <PlayIcon />
                Initialize Task
              </>
            )}
          </button>
        </div>

        {/* Center: Observation View */}
        <div className="lg:col-span-1">
          <div className="bg-zinc-800 rounded-xl border border-zinc-700 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-zinc-300">Observation</h3>
              {status?.initialized && (
                <span className="flex items-center gap-1.5 text-xs text-green-400">
                  <CheckCircleIcon className="w-3 h-3" />
                  Task Active
                </span>
              )}
            </div>

            {/* Image display */}
            <div className="aspect-square bg-zinc-900 rounded-lg overflow-hidden border border-zinc-700 mb-4">
              {currentImage ? (
                <img
                  src={`data:image/jpeg;base64,${currentImage}`}
                  alt="LIBERO observation"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-500">
                  <div className="text-center">
                    <ClockIcon className="w-8 h-8 mx-auto mb-2 text-zinc-600" />
                    <p className="text-sm">Select and initialize a task</p>
                  </div>
                </div>
              )}
            </div>

            {/* Task info */}
            {status?.task_info && (
              <div className="p-3 bg-zinc-900 rounded-lg">
                <p className="text-xs text-zinc-500 mb-1">Current Task</p>
                <p className="text-sm text-white">{status.task_info.language}</p>
              </div>
            )}

            {/* Step result */}
            {stepResult && (
              <div className="mt-3 flex gap-3">
                <div className="flex-1 p-2 bg-zinc-900 rounded-lg">
                  <p className="text-xs text-zinc-500">Reward</p>
                  <p className={`text-lg font-semibold ${stepResult.reward > 0 ? "text-green-400" : "text-zinc-300"}`}>
                    {stepResult.reward.toFixed(3)}
                  </p>
                </div>
                <div className="flex-1 p-2 bg-zinc-900 rounded-lg">
                  <p className="text-xs text-zinc-500">Steps</p>
                  <p className="text-lg font-semibold text-amber-400">{stepCount}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Action Controls */}
        <div className="lg:col-span-1">
          <div className="bg-zinc-800 rounded-xl border border-zinc-700 p-4">
            <h3 className="text-sm font-semibold text-zinc-300 mb-3">Action Controls</h3>

            {/* Action sliders */}
            <div className="space-y-3 mb-4">
              {ACTION_LABELS.map((item, index) => (
                <div key={index}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-zinc-400">
                      {item.label} <span className="text-zinc-600">({item.hint})</span>
                    </span>
                    <span className="text-zinc-300 font-mono">{action[index].toFixed(3)}</span>
                  </div>
                  <input
                    type="range"
                    min={index < 3 ? -0.05 : index < 6 ? -0.1 : -1}
                    max={index < 3 ? 0.05 : index < 6 ? 0.1 : 1}
                    step={0.001}
                    value={action[index]}
                    onChange={(e) => updateAction(index, parseFloat(e.target.value))}
                    className="w-full h-2 bg-zinc-700 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-indigo-500 [&::-webkit-slider-thumb]:rounded-full"
                    disabled={!status?.initialized}
                  />
                </div>
              ))}
            </div>

            {/* Action buttons */}
            <div className="flex gap-2">
              <button
                onClick={executeAction}
                disabled={loading || !status?.initialized}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-white font-medium transition-colors ${
                  loading || !status?.initialized
                    ? "bg-emerald-600/50 cursor-not-allowed"
                    : "bg-emerald-600 hover:bg-emerald-500"
                }`}
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <PlayIcon />
                )}
                Execute
              </button>
              <button
                onClick={resetTask}
                disabled={loading || !status?.initialized}
                className={`px-4 py-2.5 rounded-lg transition-colors ${
                  loading || !status?.initialized
                    ? "bg-zinc-700/50 text-zinc-500 cursor-not-allowed"
                    : "bg-zinc-700 text-zinc-300 hover:bg-zinc-600 hover:text-white"
                }`}
              >
                <ResetIcon />
              </button>
            </div>

            {/* Zero action button */}
            <button
              onClick={() => setAction([0, 0, 0, 0, 0, 0, 0])}
              className="w-full mt-2 px-4 py-2 text-xs text-zinc-400 hover:text-white bg-zinc-900 hover:bg-zinc-700 rounded-lg transition-colors"
            >
              Reset Action to Zero
            </button>
          </div>

          {/* Error display */}
          {error && (
            <div className={`mt-4 p-3 rounded-lg ${
              error === "Task completed!"
                ? "bg-green-500/10 border border-green-500/30 text-green-400"
                : "bg-red-500/10 border border-red-500/30 text-red-400"
            }`}>
              <p className="text-sm">{error}</p>
            </div>
          )}
        </div>
      </div>

      {/* Task Suites Overview */}
      <div className="bg-zinc-800 rounded-xl border border-zinc-700 p-6">
        <h3 className="text-base font-semibold text-zinc-300 mb-4">Task Suite Overview</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Object.entries(suites).map(([id, suite]) => (
            <div
              key={id}
              className={`p-4 rounded-lg border transition-colors cursor-pointer ${
                selectedSuite === id
                  ? "bg-indigo-500/10 border-indigo-500/50"
                  : "bg-zinc-900 border-zinc-700 hover:border-zinc-600"
              }`}
              onClick={() => setSelectedSuite(id)}
            >
              <h4 className="text-sm font-semibold text-white mb-1">{suite.name}</h4>
              <p className="text-xs text-zinc-400 mb-2">{suite.description}</p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500">{suite.task_count} tasks</span>
                <span className="text-xs px-2 py-0.5 bg-zinc-800 rounded text-indigo-400">
                  {suite.focus.split(" ").slice(0, 2).join(" ")}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
