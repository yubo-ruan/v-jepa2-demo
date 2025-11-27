/**
 * API client for V-JEPA2 backend.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";
const WS_BASE = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000";

// =============================================================================
// Types
// =============================================================================

export interface PlanningParams {
  currentImage: string; // base64 or upload_id
  goalImage: string;
  model?: string;
  samples?: number;
  iterations?: number;
  eliteFraction?: number;
}

export interface PlanningProgress {
  status: "loading_model" | "encoding" | "running" | "completed";
  modelLoading?: string;  // Model name when status is "loading_model"
  downloadProgress?: number;  // 0.0-1.0 for model download progress
  downloadTotalGb?: number;  // Total download size in GB
  downloadDownloadedGb?: number;  // Downloaded so far in GB
  downloadSpeedMbps?: number;  // Current download speed in MB/s
  downloadEtaSeconds?: number;  // Estimated time remaining for download
  iteration: number;
  totalIterations: number;
  bestEnergy: number;
  energyHistory: number[];
  samplesEvaluated: number;
  elapsedSeconds: number;
  etaSeconds: number;
}

export interface ActionResult {
  action: number[];
  confidence: number;
  energy: number;
  energyHistory: number[];
  isAcModel?: boolean; // True if action-conditioned predictor was used

  // Validation fields
  energyThreshold?: number;
  passesThreshold?: boolean;
  normalizedDistance?: number;
}

export interface PlanningTask {
  taskId: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  progress?: PlanningProgress;
  result?: ActionResult;
  error?: string;
}

export interface ActionEnergy {
  action: number[];
  energy: number;
}

export interface EvaluateActionsResponse {
  energies: ActionEnergy[];
  minEnergy: number;
  maxEnergy: number;
  isAcModel: boolean;
}

export interface ModelInfo {
  id: string;
  name: string;
  params: string;
  sizeGb: number;
  cached: boolean;
  downloadProgress: number;
  isAc?: boolean; // True if action-conditioned model
  actionDim?: number | null; // 7 for AC models (DROID format)
}

// Model status for management UI
export type ModelStatus = "loaded" | "loading" | "cached" | "downloading" | "not_downloaded";

export interface ModelStatusItem {
  id: string;
  name: string;
  params: string;
  sizeGb: number;
  status: ModelStatus;
  downloadPercent: number;
  isAc: boolean;
}

export interface ModelsStatusResponse {
  models: ModelStatusItem[];
  loadedModel: string | null;
}

export interface ModelVariant {
  id: string;
  name: string;
  description: string;
  baseModel: string;
  baseModelName: string;
  isRecommended: boolean;
}

export interface Preset {
  presetId: string;
  name: string;
  description?: string;
  config: {
    model: string;
    samples: number;
    iterations: number;
    eliteFraction: number;
    planningHorizon: number;
  };
  category: string;
  isDefault: boolean;
  isFavorite: boolean;
  useCount: number;
}

export interface TrajectoryStep {
  step: number;  // 0-indexed step number
  action: number[];
  confidence: number;
  energy: number;
  energyHistory: number[];  // CEM convergence for this step
  // Progress tracking fields (embedding-space rollout)
  distanceToGoal: number;  // Embedding distance to goal at this step
  progressRatio: number;   // 0-1, how much closer to goal vs initial
  // Simulator observation (only populated when useSimulator=true)
  observedImageUrl?: string;  // URL to fetch observed image after this step
}

export interface TrajectoryProgress {
  status: "loading_model" | "encoding" | "running" | "completed";
  modelLoading?: string;
  downloadProgress?: number;
  downloadTotalGb?: number;
  downloadDownloadedGb?: number;
  downloadSpeedMbps?: number;
  downloadEtaSeconds?: number;
  // Trajectory-specific
  currentStep: number;  // Which step we're on
  totalSteps: number;
  // CEM progress within step
  iteration: number;
  totalIterations: number;
  bestEnergy: number;
  energyHistory: number[];
  samplesEvaluated: number;
  elapsedSeconds: number;
  etaSeconds: number;
  completedSteps: TrajectoryStep[];
  // Simulator mode
  useSimulator: boolean;  // Whether using RoboSuite simulator
  observedImageUrl?: string;  // Current step's observation (real-time)
}

export interface TrajectoryResult {
  steps: TrajectoryStep[];
  totalEnergy: number;
  avgEnergy: number;
  avgConfidence: number;
  isAcModel: boolean;
  // Progress tracking metrics (embedding-space rollout)
  initialDistance: number;   // Embedding distance from start to goal
  finalDistance: number;     // Embedding distance after all steps
  totalProgress: number;     // 1 - final/initial (overall improvement)
  energyTrend: "decreasing" | "stable" | "increasing" | "unknown";
  // Simulator mode
  useSimulator: boolean;  // Whether RoboSuite simulator was used
}

// Single-step trajectory planning (step-by-step mode)
export interface SingleStepRequest {
  currentImage: string;  // upload_id from simulator observation
  goalImage: string;     // upload_id of goal image
  model?: string;
  samples?: number;
  iterations?: number;
  stepIndex?: number;    // Which step this is (for display)
}

export interface SingleStepResult {
  stepIndex: number;
  action: number[];      // 7D for AC models
  energy: number;
  confidence: number;
  energyHistory: number[];
  isAcModel: boolean;
  energyThreshold: number;
  passesThreshold: boolean;
  distanceToGoal: number;  // Normalized distance (0-1)
}

export interface SingleStepResponse {
  success: boolean;
  result?: SingleStepResult;
  error?: string;
}

export interface ComparisonResult {
  comparisonId: string;
  status: string;
  modelsCompared: number;
  results: Array<{
    modelId: string;
    modelName: string;
    action: number[];
    confidence: number;
    energy: number;
    inferenceTimeMs: number;
    memoryUsedMb: number;
  }>;
  winner?: string;
}

export interface VideoInfo {
  videoId: string;
  filename: string;
  durationSeconds: number;
  fps: number;
  width: number;
  height: number;
  frameCount: number;
}

export interface ExtractedFrame {
  frameId: string;
  frameNumber: number;
  timestampSeconds: number;
  thumbnailUrl: string;
}

export interface Experiment {
  id: string;
  createdAt: string;
  title: string;
  confidence: number;
  energy: number;
  timeSeconds: number;
  model: string;
  action: number[];
  samples: number;
  iterations: number;
  favorite: boolean;
  currentImageUrl?: string;
  goalImageUrl?: string;
}

export interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  gpuAvailable: boolean;
  gpuName?: string;
  modelsLoaded: string[];
  version: string;
  mode: "dummy" | "production";
}

// =============================================================================
// Utility functions
// =============================================================================

function snakeToCamel(obj: unknown): unknown {
  if (Array.isArray(obj)) {
    return obj.map(snakeToCamel);
  }
  if (obj !== null && typeof obj === "object") {
    return Object.entries(obj).reduce(
      (acc, [key, value]) => {
        const camelKey = key.replace(/_([a-z])/g, (_, letter) =>
          letter.toUpperCase()
        );
        acc[camelKey] = snakeToCamel(value);
        return acc;
      },
      {} as Record<string, unknown>
    );
  }
  return obj;
}

function camelToSnake(obj: unknown): unknown {
  if (Array.isArray(obj)) {
    return obj.map(camelToSnake);
  }
  if (obj !== null && typeof obj === "object") {
    return Object.entries(obj).reduce(
      (acc, [key, value]) => {
        const snakeKey = key.replace(
          /[A-Z]/g,
          (letter) => `_${letter.toLowerCase()}`
        );
        acc[snakeKey] = camelToSnake(value);
        return acc;
      },
      {} as Record<string, unknown>
    );
  }
  return obj;
}

async function fetchJson<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail || `HTTP ${res.status}`);
  }

  const data = await res.json();
  return snakeToCamel(data) as T;
}

// =============================================================================
// API Client
// =============================================================================

export const api = {
  // ---------------------------------------------------------------------------
  // Health
  // ---------------------------------------------------------------------------

  async getHealth(): Promise<HealthStatus> {
    return fetchJson<HealthStatus>(`${API_BASE}/health`);
  },

  // ---------------------------------------------------------------------------
  // Planning
  // ---------------------------------------------------------------------------

  async startPlanning(params: PlanningParams): Promise<{ taskId: string; websocketUrl: string }> {
    const body = camelToSnake({
      currentImage: params.currentImage,
      goalImage: params.goalImage,
      model: params.model || "vit-large",
      samples: params.samples || 400,
      iterations: params.iterations || 10,
      eliteFraction: params.eliteFraction || 0.1,
    });

    return fetchJson(`${API_BASE}/plan`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  async getPlanningStatus(taskId: string): Promise<PlanningTask> {
    return fetchJson<PlanningTask>(`${API_BASE}/plan/${taskId}`);
  },

  async cancelPlanning(taskId: string): Promise<void> {
    await fetchJson(`${API_BASE}/plan/${taskId}/cancel`, {
      method: "POST",
    });
  },

  async evaluateActions(params: {
    currentImage: string;
    goalImage: string;
    actions: number[][];
    model?: string;
  }): Promise<EvaluateActionsResponse> {
    const body = camelToSnake({
      currentImage: params.currentImage,
      goalImage: params.goalImage,
      actions: params.actions,
      model: params.model || "vit-giant",
    });

    const response = await fetchJson(`${API_BASE}/plan/evaluate-actions`, {
      method: "POST",
      body: JSON.stringify(body),
    });

    return snakeToCamel(response) as EvaluateActionsResponse;
  },

  /**
   * Subscribe to real-time planning progress via WebSocket.
   * Includes automatic reconnection with exponential backoff.
   */
  subscribeToPlanningProgress(
    taskId: string,
    callbacks: {
      onProgress?: (progress: PlanningProgress) => void;
      onComplete?: (result: ActionResult) => void;
      onError?: (error: string) => void;
      onCancelled?: () => void;
    }
  ): { ws: WebSocket; cancel: () => void } {
    let ws: WebSocket;
    let reconnectAttempts = 0;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    let isCancelled = false;
    let isComplete = false;

    const MAX_RECONNECT_ATTEMPTS = 5;
    const BASE_DELAY_MS = 1000;
    const MAX_DELAY_MS = 30000;

    const connect = () => {
      ws = new WebSocket(`${WS_BASE}/ws/plan/${taskId}`);

      ws.onopen = () => {
        reconnectAttempts = 0; // Reset on successful connection
      };

      ws.onmessage = (event) => {
        try {
          console.log('[WebSocket] Raw message received:', event.data);
          const msg = JSON.parse(event.data);
          console.log('[WebSocket] Parsed message:', { type: msg.type, data: msg.data });
          const data = snakeToCamel(msg.data) as Record<string, unknown>;
          console.log('[WebSocket] Converted to camelCase:', data);

          switch (msg.type) {
            case "progress":
              console.log('[WebSocket] Calling onProgress callback');
              callbacks.onProgress?.(data as unknown as PlanningProgress);
              break;
            case "completed":
              console.log('[WebSocket] *** COMPLETED MESSAGE RECEIVED ***');
              console.log('[WebSocket] Result data:', data);
              isComplete = true;
              console.log('[WebSocket] Calling onComplete callback');
              callbacks.onComplete?.(data as unknown as ActionResult);
              console.log('[WebSocket] onComplete callback finished');
              break;
            case "error":
              console.log('[WebSocket] Error message received:', data);
              isComplete = true;
              callbacks.onError?.((data as { message?: string }).message || "Unknown error");
              break;
            case "cancelled":
              console.log('[WebSocket] Cancelled message received');
              isComplete = true;
              callbacks.onCancelled?.();
              break;
            default:
              console.warn('[WebSocket] Unknown message type:', msg.type);
          }
        } catch (e) {
          console.error("[WebSocket] Message parse error:", e, "Raw data:", event.data);
        }
      };

      ws.onclose = (event) => {
        // Don't reconnect if cancelled, complete, or normal closure
        if (isCancelled || isComplete || event.code === 1000) {
          return;
        }

        // Attempt reconnection with exponential backoff
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          const delay = Math.min(
            BASE_DELAY_MS * Math.pow(2, reconnectAttempts),
            MAX_DELAY_MS
          );
          reconnectAttempts++;
          console.log(`WebSocket closed, reconnecting in ${delay}ms (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
          reconnectTimeout = setTimeout(connect, delay);
        } else {
          callbacks.onError?.("WebSocket connection lost after max retries");
        }
      };

      ws.onerror = () => {
        // Error will be followed by close event, which handles reconnection
      };
    };

    connect();

    return {
      get ws() { return ws; },
      cancel: () => {
        isCancelled = true;
        if (reconnectTimeout) {
          clearTimeout(reconnectTimeout);
        }
        if (ws.readyState === WebSocket.OPEN) {
          ws.send("cancel");
        }
        ws.close(1000); // Normal closure
      },
    };
  },

  // ---------------------------------------------------------------------------
  // Models
  // ---------------------------------------------------------------------------

  async getModels(): Promise<ModelInfo[]> {
    const data = await fetchJson<{ models: ModelInfo[] }>(`${API_BASE}/models`);
    return data.models;
  },

  /**
   * Get unified status of all models for management UI.
   * Returns status for each model (loaded/loading/cached/downloading/not_downloaded)
   * and the currently loaded model ID.
   */
  async getModelsStatus(): Promise<ModelsStatusResponse> {
    // fetchJson already applies snakeToCamel transformation
    return fetchJson<ModelsStatusResponse>(`${API_BASE}/models/status`);
  },

  /**
   * Load a cached model into GPU memory.
   * Returns immediately, actual loading happens in background.
   */
  async loadModel(modelId: string): Promise<{ status: string; modelId: string; message?: string }> {
    return fetchJson(`${API_BASE}/models/${modelId}/load`, {
      method: "POST",
    });
  },

  /**
   * Unload a model from GPU memory.
   */
  async unloadModel(modelId: string): Promise<{ status: string; modelId: string; message?: string }> {
    return fetchJson(`${API_BASE}/models/${modelId}/unload`, {
      method: "POST",
    });
  },

  async downloadModel(modelId: string): Promise<void> {
    await fetchJson(`${API_BASE}/models/${modelId}/download`, {
      method: "POST",
    });
  },

  /**
   * Cancel an ongoing model download.
   */
  async cancelDownload(modelId: string): Promise<void> {
    await fetchJson(`${API_BASE}/models/${modelId}/download/cancel`, {
      method: "POST",
    });
  },

  async deleteModelCache(modelId: string): Promise<void> {
    await fetchJson(`${API_BASE}/models/${modelId}/cache`, {
      method: "DELETE",
    });
  },

  async getModelVariants(): Promise<ModelVariant[]> {
    const data = await fetchJson<{ variants: ModelVariant[] }>(`${API_BASE}/models/variants`);
    return data.variants;
  },

  // ---------------------------------------------------------------------------
  // Presets
  // ---------------------------------------------------------------------------

  async getPresets(category?: string): Promise<Preset[]> {
    const query = category ? `?category=${category}` : "";
    return fetchJson<Preset[]>(`${API_BASE}/presets${query}`);
  },

  async createPreset(data: {
    name: string;
    description?: string;
    config: { model: string; samples: number; iterations: number };
    category?: string;
  }): Promise<Preset> {
    return fetchJson(`${API_BASE}/presets`, {
      method: "POST",
      body: JSON.stringify(camelToSnake(data)),
    });
  },

  async usePreset(presetId: string): Promise<{ presetId: string; useCount: number; config: unknown }> {
    return fetchJson(`${API_BASE}/presets/${presetId}/use`, {
      method: "POST",
    });
  },

  // ---------------------------------------------------------------------------
  // Trajectory Planning
  // ---------------------------------------------------------------------------

  async startTrajectoryPlanning(params: {
    currentImage: string | null;  // Optional in simulator mode (simulator provides initial observation)
    goalImage: string;
    model?: string;
    numSteps?: number;
    samples?: number;
    iterations?: number;
    useSimulator?: boolean;  // Use RoboSuite simulator for real observations
  }): Promise<{ taskId: string; websocketUrl: string }> {
    // Build request body, only including currentImage if provided
    const requestData: Record<string, unknown> = {
      goalImage: params.goalImage,
      model: params.model || "vit-giant-ac",
      numSteps: params.numSteps || 5,
      samples: params.samples || 400,
      iterations: params.iterations || 10,
      useSimulator: params.useSimulator || false,
    };

    // Only include currentImage if provided (not required in simulator mode)
    if (params.currentImage) {
      requestData.currentImage = params.currentImage;
    }

    const body = camelToSnake(requestData);

    return fetchJson(`${API_BASE}/plan/trajectory`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  async getTrajectoryStatus(taskId: string): Promise<{
    taskId: string;
    status: string;
    progress?: TrajectoryProgress;
    result?: TrajectoryResult;
    error?: string;
  }> {
    return fetchJson(`${API_BASE}/plan/trajectory/${taskId}`);
  },

  async cancelTrajectory(taskId: string): Promise<void> {
    await fetchJson(`${API_BASE}/plan/trajectory/${taskId}/cancel`, {
      method: "POST",
    });
  },

  /**
   * Get the URL for a simulator observation image.
   * @param taskId - The trajectory task ID
   * @param step - The step number (-1 for initial observation, 0+ for step observations)
   */
  getObservationImageUrl(taskId: string, step: number): string {
    return `${API_BASE}/plan/observations/${taskId}/${step}`;
  },

  /**
   * Plan a single trajectory step (step-by-step mode).
   * Uses real observations from simulator instead of embedding rollout.
   */
  async planTrajectoryStep(params: SingleStepRequest): Promise<SingleStepResponse> {
    const body = camelToSnake({
      currentImage: params.currentImage,
      goalImage: params.goalImage,
      model: params.model || "vit-giant-ac",
      samples: params.samples || 400,
      iterations: params.iterations || 10,
      stepIndex: params.stepIndex || 0,
    });

    return fetchJson<SingleStepResponse>(`${API_BASE}/plan/trajectory/step`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  subscribeToTrajectoryProgress(
    taskId: string,
    callbacks: {
      onProgress?: (progress: TrajectoryProgress) => void;
      onComplete?: (result: TrajectoryResult) => void;
      onError?: (error: string) => void;
      onCancelled?: () => void;
    }
  ): { ws: WebSocket; cancel: () => void } {
    let ws: WebSocket;
    let reconnectAttempts = 0;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    let isCancelled = false;
    let isComplete = false;

    const MAX_RECONNECT_ATTEMPTS = 5;
    const BASE_DELAY_MS = 1000;
    const MAX_DELAY_MS = 30000;

    const connect = () => {
      ws = new WebSocket(`${WS_BASE}/ws/plan/${taskId}`);

      ws.onopen = () => {
        reconnectAttempts = 0;
      };

      ws.onmessage = (event) => {
        try {
          console.log('[Trajectory WS] Raw message:', event.data);
          const msg = JSON.parse(event.data);
          const data = snakeToCamel(msg.data) as Record<string, unknown>;
          console.log('[Trajectory WS] Parsed:', { type: msg.type, data });

          switch (msg.type) {
            case "trajectory_progress":
              callbacks.onProgress?.(data as unknown as TrajectoryProgress);
              break;
            case "trajectory_completed":
              console.log('[Trajectory WS] *** COMPLETED ***');
              isComplete = true;
              callbacks.onComplete?.(data as unknown as TrajectoryResult);
              break;
            case "error":
              console.log('[Trajectory WS] Error:', data);
              isComplete = true;
              callbacks.onError?.((data as { message?: string }).message || "Unknown error");
              break;
            case "cancelled":
              isComplete = true;
              callbacks.onCancelled?.();
              break;
            default:
              console.warn('[Trajectory WS] Unknown type:', msg.type);
          }
        } catch (e) {
          console.error("[Trajectory WS] Parse error:", e);
        }
      };

      ws.onclose = (event) => {
        if (isCancelled || isComplete || event.code === 1000) return;

        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          const delay = Math.min(BASE_DELAY_MS * Math.pow(2, reconnectAttempts), MAX_DELAY_MS);
          reconnectAttempts++;
          console.log(`Trajectory WS closed, reconnecting in ${delay}ms`);
          reconnectTimeout = setTimeout(connect, delay);
        } else {
          callbacks.onError?.("WebSocket connection lost after max retries");
        }
      };
    };

    connect();

    return {
      get ws() { return ws; },
      cancel: () => {
        isCancelled = true;
        if (reconnectTimeout) clearTimeout(reconnectTimeout);
        ws.close(1000);
      },
    };
  },

  // ---------------------------------------------------------------------------
  // Model Comparison
  // ---------------------------------------------------------------------------

  async compareModels(params: {
    currentImage: string;
    goalImage: string;
    models?: string[];
    samples?: number;
    iterations?: number;
  }): Promise<ComparisonResult> {
    return fetchJson(`${API_BASE}/compare`, {
      method: "POST",
      body: JSON.stringify(camelToSnake(params)),
    });
  },

  async getComparison(comparisonId: string): Promise<ComparisonResult> {
    return fetchJson(`${API_BASE}/compare/${comparisonId}`);
  },

  async getModelLeaderboard(): Promise<{
    leaderboard: Array<{
      modelId: string;
      modelName: string;
      totalRuns: number;
      wins: number;
      winRate: number;
      avgEnergy: number;
      avgConfidence: number;
    }>;
    totalComparisons: number;
  }> {
    return fetchJson(`${API_BASE}/compare/leaderboard`);
  },

  // ---------------------------------------------------------------------------
  // Video Processing
  // ---------------------------------------------------------------------------

  async uploadVideo(file: File): Promise<VideoInfo> {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(`${API_BASE}/video/upload`, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(error.detail || `HTTP ${res.status}`);
    }

    const data = await res.json();
    return snakeToCamel(data) as VideoInfo;
  },

  async extractFrames(params: {
    videoId: string;
    strategy?: "uniform" | "keyframes" | "interval";
    numFrames?: number;
    intervalSeconds?: number;
  }): Promise<{ taskId: string; videoId: string; status: string }> {
    return fetchJson(`${API_BASE}/video/extract`, {
      method: "POST",
      body: JSON.stringify(camelToSnake(params)),
    });
  },

  async getExtractedFrames(taskId: string): Promise<{
    taskId: string;
    status: string;
    progressPercent: number;
    frames: ExtractedFrame[];
  }> {
    return fetchJson(`${API_BASE}/video/extract/${taskId}`);
  },

  // ---------------------------------------------------------------------------
  // Analytics
  // ---------------------------------------------------------------------------

  async getUsageSummary(days?: number): Promise<{
    totalPlans: number;
    totalExperiments: number;
    avgPlanningTimeSeconds: number;
    avgConfidence: number;
    avgEnergy: number;
    modelsUsed: Record<string, number>;
  }> {
    const query = days ? `?days=${days}` : "";
    return fetchJson(`${API_BASE}/analytics/usage/summary${query}`);
  },

  async getDailyUsage(days?: number): Promise<{
    periodDays: number;
    data: Array<{
      date: string;
      plans: number;
      experiments: number;
      apiCalls: number;
    }>;
  }> {
    const query = days ? `?days=${days}` : "";
    return fetchJson(`${API_BASE}/analytics/usage/daily${query}`);
  },

  async getModelPerformance(): Promise<Array<{
    modelId: string;
    modelName: string;
    totalInferences: number;
    avgInferenceTimeMs: number;
    avgEnergy: number;
    avgConfidence: number;
    successRate: number;
  }>> {
    return fetchJson(`${API_BASE}/analytics/performance/models`);
  },

  // ---------------------------------------------------------------------------
  // Experiments
  // ---------------------------------------------------------------------------

  async getExperiments(params?: {
    filter?: string;
    sort?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ experiments: Experiment[]; total: number }> {
    const query = new URLSearchParams();
    if (params?.filter) query.set("filter", params.filter);
    if (params?.sort) query.set("sort", params.sort);
    if (params?.limit) query.set("limit", String(params.limit));
    if (params?.offset) query.set("offset", String(params.offset));

    return fetchJson(`${API_BASE}/experiments?${query}`);
  },

  async getExperiment(id: string): Promise<Experiment> {
    return fetchJson<Experiment>(`${API_BASE}/experiments/${id}`);
  },

  async createExperiment(data: {
    title: string;
    model: string;
    action: number[];
    confidence: number;
    energy: number;
    timeSeconds: number;
    samples: number;
    iterations: number;
    currentImageUrl?: string;
    goalImageUrl?: string;
  }): Promise<Experiment> {
    return fetchJson(`${API_BASE}/experiments`, {
      method: "POST",
      body: JSON.stringify(camelToSnake(data)),
    });
  },

  async updateExperiment(
    id: string,
    data: { title?: string; favorite?: boolean }
  ): Promise<Experiment> {
    return fetchJson(`${API_BASE}/experiments/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  async deleteExperiment(id: string): Promise<void> {
    await fetchJson(`${API_BASE}/experiments/${id}`, {
      method: "DELETE",
    });
  },

  // ---------------------------------------------------------------------------
  // Upload
  // ---------------------------------------------------------------------------

  async uploadImage(file: File): Promise<{ uploadId: string; url: string; width: number; height: number }> {
    console.log('[API] uploadImage called:', file.name, file.size, 'bytes');
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(`${API_BASE}/upload`, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: res.statusText }));
      console.error('[API] uploadImage failed:', error);
      throw new Error(error.detail || `HTTP ${res.status}`);
    }

    const data = await res.json();
    const result = snakeToCamel(data) as { uploadId: string; url: string; width: number; height: number };
    console.log('[API] uploadImage succeeded:', result.uploadId);
    return result;
  },

  /**
   * Validate if an upload ID still exists on the backend.
   * Useful to check for stale cached IDs after backend restart.
   */
  async validateUpload(uploadId: string): Promise<boolean> {
    console.log('[API] validateUpload called:', uploadId);
    try {
      const res = await fetch(`${API_BASE}/upload/validate/${uploadId}`);
      if (!res.ok) {
        console.log('[API] validateUpload: upload not found (HTTP', res.status, ')');
        return false;
      }
      const data = await res.json();
      console.log('[API] validateUpload result:', data);
      return data.exists === true;
    } catch (error) {
      console.error('[API] validateUpload error:', error);
      return false;
    }
  },

  // ---------------------------------------------------------------------------
  // Simulator Testing
  // ---------------------------------------------------------------------------

  async getSimulatorStatus(): Promise<{
    initialized: boolean;
    available: boolean;
    error?: string;
  }> {
    return fetchJson(`${API_BASE}/simulator/status`);
  },

  async initializeSimulator(task: string = "Lift"): Promise<{
    success: boolean;
    imageBase64: string;
    message: string;
  }> {
    return fetchJson(`${API_BASE}/simulator/init?task=${encodeURIComponent(task)}`, {
      method: "POST",
    });
  },

  async stepSimulator(action: number[]): Promise<{
    success: boolean;
    imageBase64: string;
    robotState?: number[];
    gripperState?: number[];
    reward: number;
    done: boolean;
    rawAction: number[];
    transformedAction: number[];
    message: string;
  }> {
    return fetchJson(`${API_BASE}/simulator/step`, {
      method: "POST",
      body: JSON.stringify({ action }),
    });
  },

  async resetSimulator(): Promise<{
    success: boolean;
    imageBase64: string;
    message: string;
  }> {
    return fetchJson(`${API_BASE}/simulator/reset`, {
      method: "POST",
    });
  },

  async closeSimulator(): Promise<{
    success: boolean;
    message: string;
  }> {
    return fetchJson(`${API_BASE}/simulator/close`, {
      method: "POST",
    });
  },

  /**
   * Save current simulator state and download as .pkl file.
   * The file can be loaded later to restore the exact simulator state.
   */
  async saveSimulatorState(): Promise<void> {
    const response = await fetch(`${API_BASE}/simulator/save-state`);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(error.detail || "Failed to save state");
    }

    // Trigger file download
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `simulator_state_${Date.now()}.pkl`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  },

  /**
   * Load simulator state from a .pkl file.
   * This will restore the simulator to the exact state when saved.
   */
  async loadSimulatorState(file: File): Promise<{
    success: boolean;
    message: string;
    imageBase64: string;
    task: string;
  }> {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${API_BASE}/simulator/load-state`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(error.detail || "Failed to load state");
    }

    const data = await response.json();
    return snakeToCamel(data) as {
      success: boolean;
      message: string;
      imageBase64: string;
      task: string;
    };
  },
};

export default api;
