"use client";

import { useState, useEffect, useCallback } from "react";

type LoadingStatus =
  | "idle"
  | "initializing"
  | "downloading"
  | "loading_weights"
  | "moving_to_gpu"
  | "ready"
  | "error";

interface ModelState {
  status: LoadingStatus;
  progress: number;
  message: string;
  model_name: string | null;
  device: string | null;
  error: string | null;
}

interface ModelInfo {
  id: string;
  name: string;
  params: string;
  resolution: number;
}

const API_URL = "http://69.30.85.167:8000";

const statusColors: Record<LoadingStatus, string> = {
  idle: "bg-gray-500",
  initializing: "bg-yellow-500",
  downloading: "bg-blue-500",
  loading_weights: "bg-purple-500",
  moving_to_gpu: "bg-orange-500",
  ready: "bg-green-500",
  error: "bg-red-500",
};

const statusLabels: Record<LoadingStatus, string> = {
  idle: "Idle",
  initializing: "Initializing",
  downloading: "Downloading",
  loading_weights: "Loading Weights",
  moving_to_gpu: "Moving to GPU",
  ready: "Ready",
  error: "Error",
};

export default function Home() {
  const [modelState, setModelState] = useState<ModelState>({
    status: "idle",
    progress: 0,
    message: "Model not loaded",
    model_name: null,
    device: null,
    error: null,
  });
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>(
    "facebook/vjepa2-vitg-fpc64-256"
  );
  const [isLoading, setIsLoading] = useState(false);

  // Fetch available models
  useEffect(() => {
    fetch(`${API_URL}/api/models`)
      .then((res) => res.json())
      .then((data) => setModels(data.models))
      .catch((err) => console.error("Failed to fetch models:", err));
  }, []);

  // Fetch initial status
  useEffect(() => {
    fetch(`${API_URL}/api/status`)
      .then((res) => res.json())
      .then((data) => setModelState(data))
      .catch((err) => console.error("Failed to fetch status:", err));
  }, []);

  const startLoading = useCallback(async () => {
    setIsLoading(true);

    try {
      // Start loading
      await fetch(`${API_URL}/api/load?model_name=${encodeURIComponent(selectedModel)}`, {
        method: "POST",
      });

      // Stream status updates
      const eventSource = new EventSource(`${API_URL}/api/stream`);

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data) as ModelState;
        setModelState(data);

        if (data.status === "ready" || data.status === "error") {
          eventSource.close();
          setIsLoading(false);
        }
      };

      eventSource.onerror = () => {
        eventSource.close();
        setIsLoading(false);
      };
    } catch {
      setIsLoading(false);
      setModelState((prev) => ({
        ...prev,
        status: "error",
        message: "Failed to connect to server",
        error: "Connection error",
      }));
    }
  }, [selectedModel]);

  const unloadModel = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/unload`, { method: "POST" });
      const data = await res.json();
      setModelState(data.state);
    } catch {
      console.error("Failed to unload model");
    }
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      <div className="container mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            V-JEPA2 Model Loader
          </h1>
          <p className="text-gray-400 text-lg">
            Meta&apos;s Video Joint Embedding Predictive Architecture 2
          </p>
        </div>

        {/* Main Card */}
        <div className="max-w-2xl mx-auto">
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700 p-8 shadow-2xl">
            {/* Status Badge */}
            <div className="flex items-center justify-center mb-8">
              <div
                className={`px-4 py-2 rounded-full ${statusColors[modelState.status]} bg-opacity-20 border border-current`}
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`w-3 h-3 rounded-full ${statusColors[modelState.status]} ${
                      modelState.status !== "idle" &&
                      modelState.status !== "ready" &&
                      modelState.status !== "error"
                        ? "animate-pulse"
                        : ""
                    }`}
                  />
                  <span className="font-semibold">
                    {statusLabels[modelState.status]}
                  </span>
                </div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mb-6">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-400">Progress</span>
                <span className="text-gray-300">{modelState.progress}%</span>
              </div>
              <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full ${statusColors[modelState.status]} transition-all duration-500 ease-out`}
                  style={{ width: `${modelState.progress}%` }}
                />
              </div>
            </div>

            {/* Status Message */}
            <div className="bg-gray-900/50 rounded-lg p-4 mb-6">
              <p className="text-center text-gray-300">{modelState.message}</p>
              {modelState.error && (
                <p className="text-center text-red-400 mt-2 text-sm">
                  {modelState.error}
                </p>
              )}
            </div>

            {/* Model Info */}
            {modelState.status === "ready" && (
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-gray-900/50 rounded-lg p-4">
                  <p className="text-gray-500 text-sm">Model</p>
                  <p className="text-gray-200 font-mono text-sm truncate">
                    {modelState.model_name}
                  </p>
                </div>
                <div className="bg-gray-900/50 rounded-lg p-4">
                  <p className="text-gray-500 text-sm">Device</p>
                  <p className="text-gray-200 font-mono uppercase">
                    {modelState.device}
                  </p>
                </div>
              </div>
            )}

            {/* Model Selector */}
            {modelState.status !== "ready" && (
              <div className="mb-6">
                <label className="block text-gray-400 text-sm mb-2">
                  Select Model
                </label>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  disabled={isLoading}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-gray-200 focus:outline-none focus:border-blue-500 disabled:opacity-50"
                >
                  {models.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name} ({model.params}, {model.resolution}px)
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-4">
              {modelState.status !== "ready" ? (
                <button
                  onClick={startLoading}
                  disabled={isLoading}
                  className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:from-gray-600 disabled:to-gray-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg
                        className="animate-spin h-5 w-5"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="none"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      Loading...
                    </span>
                  ) : (
                    "Load Model"
                  )}
                </button>
              ) : (
                <button
                  onClick={unloadModel}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200"
                >
                  Unload Model
                </button>
              )}
            </div>
          </div>

          {/* Footer Info */}
          <div className="mt-8 text-center text-gray-500 text-sm">
            <p>
              V-JEPA2 is a self-supervised video encoder developed by Meta AI
              (FAIR)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
