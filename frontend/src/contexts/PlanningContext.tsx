"use client";

import { createContext, useContext, useState, useCallback, useMemo, useRef, useEffect, type ReactNode } from "react";
import type { PlanningState, PresetType } from "@/types";
import { planningPresets, defaultPlanningState } from "@/constants/sampleData";
import { api, type PlanningProgress, type ActionResult } from "@/lib/api";

// Extended planning state with backend data
interface ExtendedPlanningState extends PlanningState {
  taskId: string | null;
  progress: PlanningProgress | null;
  result: ActionResult | null;
  error: string | null;
  // Store upload IDs for backend reference
  currentImageUploadId: string | null;
  goalImageUploadId: string | null;
}

interface PlanningContextType {
  planningState: ExtendedPlanningState;
  setPreset: (preset: PresetType) => void;
  setSamples: (samples: number) => void;
  setIterations: (iterations: number) => void;
  setCurrentImage: (image: string | null) => void;
  setGoalImage: (image: string | null) => void;
  startPlanning: (model: string) => Promise<void>;
  cancelPlanning: () => Promise<void>;
  completePlanning: () => void;
  clearError: () => void;
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
  currentImageUploadId: null,
  goalImageUploadId: null,
};

export function PlanningProvider({ children }: { children: ReactNode }) {
  const [planningState, setPlanningState] = useState<ExtendedPlanningState>(DEFAULT_STATE);
  const wsRef = useRef<{ ws: WebSocket; cancel: () => void } | null>(null);

  // Cleanup WebSocket on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.ws.close();
        wsRef.current = null;
      }
    };
  }, []);

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
    setPlanningState((prev) => ({
      ...prev,
      currentImage,
      // Clear upload ID when image changes
      currentImageUploadId: prev.currentImage !== currentImage ? null : prev.currentImageUploadId,
    }));
  }, []);

  const setGoalImage = useCallback((goalImage: string | null) => {
    setPlanningState((prev) => ({
      ...prev,
      goalImage,
      // Clear upload ID when image changes
      goalImageUploadId: prev.goalImage !== goalImage ? null : prev.goalImageUploadId,
    }));
  }, []);

  const startPlanning = useCallback(async (model: string) => {
    const { currentImage, goalImage, samples, iterations, currentImageUploadId, goalImageUploadId } = planningState;

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
      // Upload images if not already uploaded (blob URLs need to be uploaded)
      let currentUploadId = currentImageUploadId;
      let goalUploadId = goalImageUploadId;

      console.log('[PlanningContext] Starting planning with images:', {
        currentImage: currentImage?.substring(0, 50),
        goalImage: goalImage?.substring(0, 50),
        currentUploadId,
        goalUploadId,
      });

      // Upload current image if it's a blob URL
      if (currentImage.startsWith("blob:")) {
        if (!currentUploadId) {
          console.log('[PlanningContext] Uploading current image blob...');
          const response = await fetch(currentImage);
          const blob = await response.blob();
          const file = new File([blob], "current.jpg", { type: blob.type || "image/jpeg" });
          const uploadResult = await api.uploadImage(file);
          currentUploadId = uploadResult.uploadId;
          console.log('[PlanningContext] Current image uploaded:', currentUploadId);
          setPlanningState((prev) => ({ ...prev, currentImageUploadId: currentUploadId }));
        }
      }

      // Upload goal image if it's a blob URL
      if (goalImage.startsWith("blob:")) {
        if (!goalUploadId) {
          console.log('[PlanningContext] Uploading goal image blob...');
          const response = await fetch(goalImage);
          const blob = await response.blob();
          const file = new File([blob], "goal.jpg", { type: blob.type || "image/jpeg" });
          const uploadResult = await api.uploadImage(file);
          goalUploadId = uploadResult.uploadId;
          console.log('[PlanningContext] Goal image uploaded:', goalUploadId);
          setPlanningState((prev) => ({ ...prev, goalImageUploadId: goalUploadId }));
        }
      }

      // Use upload IDs for planning (must be upload IDs, not blob URLs)
      const currentImageRef = currentUploadId || currentImage;
      const goalImageRef = goalUploadId || goalImage;

      // Validate that we have valid references (not blob URLs)
      if (currentImageRef.startsWith("blob:") || goalImageRef.startsWith("blob:")) {
        throw new Error("Images must be uploaded to the backend before planning. Please try uploading again.");
      }

      console.log('[PlanningContext] Starting planning with refs:', { currentImageRef, goalImageRef, model });

      // Start planning task on backend
      const { taskId } = await api.startPlanning({
        currentImage: currentImageRef,
        goalImage: goalImageRef,
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
  }, [planningState]);

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

  const clearError = useCallback(() => {
    setPlanningState((prev) => ({ ...prev, error: null }));
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
      startPlanning,
      cancelPlanning,
      completePlanning,
      clearError,
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
      startPlanning,
      cancelPlanning,
      completePlanning,
      clearError,
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
