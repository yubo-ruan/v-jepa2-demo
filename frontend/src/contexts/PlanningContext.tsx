"use client";

import { createContext, useContext, useState, useCallback, useMemo, useRef, type ReactNode } from "react";
import type { PlanningState, PresetType } from "@/types";
import { planningPresets, defaultPlanningState } from "@/constants/sampleData";
import { api, type PlanningProgress, type ActionResult } from "@/lib/api";

// Extended planning state with backend data
interface ExtendedPlanningState extends PlanningState {
  taskId: string | null;
  progress: PlanningProgress | null;
  result: ActionResult | null;
  error: string | null;
}

interface PlanningContextType {
  planningState: ExtendedPlanningState;
  setPreset: (preset: PresetType) => void;
  setSamples: (samples: number) => void;
  setIterations: (iterations: number) => void;
  setCurrentImage: (image: string | null) => void;
  setGoalImage: (image: string | null) => void;
  setModel: (model: string) => void;
  startPlanning: () => Promise<void>;
  cancelPlanning: () => Promise<void>;
  completePlanning: () => void;
  reset: () => void;
  canGenerate: boolean;
  estimatedTime: number;
  estimatedCost: string;
}

const PlanningContext = createContext<PlanningContextType | null>(null);

const DEFAULT_STATE: ExtendedPlanningState = {
  ...defaultPlanningState,
  currentImage: null,
  goalImage: null,
  hasResults: false,
  isProcessing: false,
  taskId: null,
  progress: null,
  result: null,
  error: null,
};

export function PlanningProvider({ children }: { children: ReactNode }) {
  const [planningState, setPlanningState] = useState<ExtendedPlanningState>(DEFAULT_STATE);
  const [model, setModelState] = useState("vit-giant");
  const wsRef = useRef<{ ws: WebSocket; cancel: () => void } | null>(null);

  const setPreset = useCallback((preset: PresetType) => {
    const presetConfig = planningPresets.find((p) => p.id === preset);
    if (presetConfig) {
      setPlanningState((prev) => ({
        ...prev,
        preset,
        samples: presetConfig.samples,
        iterations: presetConfig.iterations,
      }));
    }
  }, []);

  const setSamples = useCallback((samples: number) => {
    setPlanningState((prev) => ({ ...prev, samples }));
  }, []);

  const setIterations = useCallback((iterations: number) => {
    setPlanningState((prev) => ({ ...prev, iterations }));
  }, []);

  const setCurrentImage = useCallback((currentImage: string | null) => {
    setPlanningState((prev) => ({ ...prev, currentImage }));
  }, []);

  const setGoalImage = useCallback((goalImage: string | null) => {
    setPlanningState((prev) => ({ ...prev, goalImage }));
  }, []);

  const setModel = useCallback((newModel: string) => {
    setModelState(newModel);
  }, []);

  const startPlanning = useCallback(async () => {
    const { currentImage, goalImage, samples, iterations } = planningState;

    if (!currentImage || !goalImage) {
      return;
    }

    // Reset state and start processing
    setPlanningState((prev) => ({
      ...prev,
      isProcessing: true,
      hasResults: false,
      taskId: null,
      progress: null,
      result: null,
      error: null,
    }));

    try {
      // Start planning task on backend
      const { taskId } = await api.startPlanning({
        currentImage,
        goalImage,
        model,
        samples,
        iterations,
      });

      setPlanningState((prev) => ({ ...prev, taskId }));

      // Subscribe to WebSocket for real-time progress
      const subscription = api.subscribeToPlanningProgress(taskId, {
        onProgress: (progress) => {
          setPlanningState((prev) => ({ ...prev, progress }));
        },
        onComplete: (result) => {
          setPlanningState((prev) => ({
            ...prev,
            isProcessing: false,
            hasResults: true,
            result,
          }));
          wsRef.current = null;
        },
        onError: (error) => {
          setPlanningState((prev) => ({
            ...prev,
            isProcessing: false,
            error,
          }));
          wsRef.current = null;
        },
        onCancelled: () => {
          setPlanningState((prev) => ({
            ...prev,
            isProcessing: false,
          }));
          wsRef.current = null;
        },
      });

      wsRef.current = subscription;
    } catch (error) {
      setPlanningState((prev) => ({
        ...prev,
        isProcessing: false,
        error: error instanceof Error ? error.message : "Failed to start planning",
      }));
    }
  }, [planningState, model]);

  const cancelPlanning = useCallback(async () => {
    const { taskId } = planningState;

    // Cancel via WebSocket if connected
    if (wsRef.current) {
      wsRef.current.cancel();
      wsRef.current.ws.close();
      wsRef.current = null;
    }

    // Also cancel via API
    if (taskId) {
      try {
        await api.cancelPlanning(taskId);
      } catch {
        // Ignore errors - task might already be done
      }
    }

    setPlanningState((prev) => ({ ...prev, isProcessing: false }));
  }, [planningState.taskId]);

  const completePlanning = useCallback(() => {
    // For demo mode - manually trigger completion with mock data
    setPlanningState((prev) => ({
      ...prev,
      isProcessing: false,
      hasResults: true,
      result: {
        action: [3.2, -1.5, 0.8],
        confidence: 0.82,
        energy: 1.23,
        energyHistory: [8, 6.5, 5.2, 4.1, 3.5, 3.1, 2.8, 2.6, 2.5, 1.23],
      },
    }));
  }, []);

  const reset = useCallback(() => {
    // Clean up WebSocket
    if (wsRef.current) {
      wsRef.current.ws.close();
      wsRef.current = null;
    }
    setPlanningState(DEFAULT_STATE);
  }, []);

  const canGenerate = useMemo(
    () => !!planningState.currentImage && !!planningState.goalImage && !planningState.isProcessing,
    [planningState.currentImage, planningState.goalImage, planningState.isProcessing]
  );

  const estimatedTime = useMemo(
    () => Math.round((planningState.samples / 100) * (planningState.iterations / 5) * 0.5),
    [planningState.samples, planningState.iterations]
  );

  const estimatedCost = useMemo(
    () => ((planningState.samples / 100) * (planningState.iterations / 5) * 0.005).toFixed(3),
    [planningState.samples, planningState.iterations]
  );

  const value = useMemo(
    () => ({
      planningState,
      setPreset,
      setSamples,
      setIterations,
      setCurrentImage,
      setGoalImage,
      setModel,
      startPlanning,
      cancelPlanning,
      completePlanning,
      reset,
      canGenerate,
      estimatedTime,
      estimatedCost,
    }),
    [
      planningState,
      setPreset,
      setSamples,
      setIterations,
      setCurrentImage,
      setGoalImage,
      setModel,
      startPlanning,
      cancelPlanning,
      completePlanning,
      reset,
      canGenerate,
      estimatedTime,
      estimatedCost,
    ]
  );

  return <PlanningContext.Provider value={value}>{children}</PlanningContext.Provider>;
}

export function usePlanning() {
  const context = useContext(PlanningContext);
  if (!context) {
    throw new Error("usePlanning must be used within a PlanningProvider");
  }
  return context;
}
