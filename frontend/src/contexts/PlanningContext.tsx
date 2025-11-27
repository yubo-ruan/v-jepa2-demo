"use client";

import { createContext, useContext, useState, useCallback, useMemo, useRef, useEffect, type ReactNode } from "react";
import type { PlanningState, PresetType } from "@/types";
import { planningPresets, defaultPlanningState } from "@/constants/sampleData";
import { api, type PlanningProgress, type ActionResult, type TrajectoryProgress, type TrajectoryResult } from "@/lib/api";
import { useHistory } from "./HistoryContext";

// Helper to fetch with timeout (prevents hanging on stale blob URLs)
async function fetchWithTimeout(url: string, timeoutMs: number = 5000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Fetch timed out after ${timeoutMs}ms - the image may no longer be available`);
    }
    throw error;
  }
}

// Planning mode type
type PlanningMode = "single" | "trajectory";

// Extended planning state with backend data
interface ExtendedPlanningState extends PlanningState {
  taskId: string | null;
  progress: PlanningProgress | null;
  result: ActionResult | null;
  error: string | null;
  // Store upload IDs for backend reference
  currentImageUploadId: string | null;
  goalImageUploadId: string | null;
  // Track planning start time for history
  planningStartTime: number | null;
  planningModel: string | null;
  // Track previous images to detect changes
  previousCurrentImage: string | null;
  previousGoalImage: string | null;
  // Trajectory planning
  mode: PlanningMode;
  trajectorySteps: number;  // Number of steps in trajectory (2-20)
  trajectoryProgress: TrajectoryProgress | null;
  trajectoryResult: TrajectoryResult | null;
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
  // Expose upload IDs for components that need to fetch energy data
  currentImageUploadId: string | null;
  goalImageUploadId: string | null;
  // Trajectory mode
  setMode: (mode: PlanningMode) => void;
  setTrajectorySteps: (steps: number) => void;
}

const PlanningContext = createContext<PlanningContextType | null>(null);

// Helper function to convert image to data URL for permanent storage
async function convertToDataURL(imageRef: string, uploadId: string | null): Promise<string> {
  console.log('[convertToDataURL] Called with:', { imageRef: imageRef?.substring(0, 50), uploadId });

  // If already a data URL, return as-is
  if (imageRef.startsWith("data:")) {
    console.log('[convertToDataURL] Already a data URL, returning as-is');
    return imageRef;
  }

  // If it's a blob URL, convert to data URL
  if (imageRef.startsWith("blob:")) {
    console.log('[convertToDataURL] Converting blob URL to data URL');
    try {
      // Use timeout to prevent hanging on stale blob URLs
      const response = await fetchWithTimeout(imageRef, 5000);
      if (!response.ok) {
        throw new Error(`Failed to fetch blob: ${response.statusText}`);
      }
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          console.log('[convertToDataURL] Blob converted to data URL');
          resolve(reader.result as string);
        };
        reader.onerror = () => {
          console.error('[convertToDataURL] FileReader error');
          reject(new Error('Failed to read blob as data URL'));
        };
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('[convertToDataURL] Failed to convert blob URL:', error);
      // If blob conversion fails, try to use upload ID as fallback
      if (uploadId) {
        console.log('[convertToDataURL] Falling back to upload ID:', uploadId);
        const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";
        const url = `${apiBase}/upload/${uploadId}`;
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to fetch upload: ${response.status} ${response.statusText}`);
        }
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            console.log('[convertToDataURL] Upload converted to data URL');
            resolve(reader.result as string);
          };
          reader.onerror = () => reject(new Error('Failed to read blob as data URL'));
          reader.readAsDataURL(blob);
        });
      }
      throw error;
    }
  }

  // If we have an upload ID, fetch from backend and convert to data URL
  if (uploadId) {
    console.log('[convertToDataURL] Fetching upload ID from backend:', uploadId);
    const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";
    const url = `${apiBase}/upload/${uploadId}`;
    console.log('[convertToDataURL] Fetching from:', url);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch upload: ${response.status} ${response.statusText}`);
    }
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        console.log('[convertToDataURL] Upload converted to data URL');
        resolve(reader.result as string);
      };
      reader.readAsDataURL(blob);
    });
  }

  // Fallback: return as-is
  console.log('[convertToDataURL] No conversion needed, returning as-is');
  return imageRef;
}

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
  planningStartTime: null,
  planningModel: null,
  previousCurrentImage: null,
  previousGoalImage: null,
  // Trajectory defaults
  mode: "trajectory",
  trajectorySteps: 5,
  trajectoryProgress: null,
  trajectoryResult: null,
};

export function PlanningProvider({ children }: { children: ReactNode }) {
  const [planningState, setPlanningState] = useState<ExtendedPlanningState>(DEFAULT_STATE);
  const wsRef = useRef<{ ws: WebSocket; cancel: () => void } | null>(null);
  // Keep the latest planning state in a ref so async callbacks (WebSocket) don't close over stale values
  const planningStateRef = useRef<ExtendedPlanningState>(DEFAULT_STATE);
  const { addExperiment } = useHistory();

  // Cleanup WebSocket on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.ws.close();
        wsRef.current = null;
      }
    };
  }, []);

  // Sync ref whenever state changes
  useEffect(() => {
    planningStateRef.current = planningState;
  }, [planningState]);

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

  const setMode = useCallback((mode: PlanningMode) => {
    setPlanningState((prev) => ({
      ...prev,
      mode,
      // Clear results when switching modes
      hasResults: false,
      result: null,
      trajectoryResult: null,
    }));
  }, []);

  const setTrajectorySteps = useCallback((trajectorySteps: number) => {
    setPlanningState((prev) => ({ ...prev, trajectorySteps }));
  }, []);

  const startPlanning = useCallback(async (model: string) => {
    // Use ref to get the latest state (avoid stale closure)
    const { currentImage, goalImage, samples, iterations, currentImageUploadId, goalImageUploadId, previousCurrentImage, previousGoalImage, mode, trajectorySteps } = planningStateRef.current;

    if (!currentImage || !goalImage) {
      return;
    }

    // Close any existing WebSocket connection before starting new planning
    if (wsRef.current) {
      console.log('[PlanningContext] Closing existing WebSocket before new planning');
      wsRef.current.ws.close();
      wsRef.current = null;
    }

    // Reset state and start processing
    // Clear BOTH single action and trajectory results to prevent stale data
    setPlanningState((prev) => ({
      ...prev,
      isProcessing: true,
      hasResults: false,
      taskId: null,
      progress: null,
      result: null,
      error: null,
      planningStartTime: Date.now(),
      planningModel: model,
      // Clear trajectory data when starting new planning
      trajectoryProgress: null,
      trajectoryResult: null,
    }));

    try {
      // Upload images if not already uploaded (blob URLs need to be uploaded)
      let currentUploadId = currentImageUploadId;
      let goalUploadId = goalImageUploadId;

      // Check if images have changed from previous planning run
      const currentImageChanged = currentImage !== previousCurrentImage;
      const goalImageChanged = goalImage !== previousGoalImage;

      console.log('[PlanningContext] Starting planning with images:', {
        currentImage: currentImage?.substring(0, 50),
        goalImage: goalImage?.substring(0, 50),
        currentUploadId,
        goalUploadId,
        currentImageChanged,
        goalImageChanged,
      });

      // Upload current image only if:
      // 1. No cached upload ID exists, OR
      // 2. Image has changed from previous run
      if (currentImage.startsWith("blob:") && (!currentUploadId || currentImageChanged)) {
        console.log('[PlanningContext] Uploading current image blob...', {
          hasUploadId: !!currentUploadId,
          imageChanged: currentImageChanged
        });
        try {
          // Use timeout to prevent hanging on stale blob URLs
          console.log('[PlanningContext] Fetching blob URL...');
          const fetchStart = performance.now();
          const response = await fetchWithTimeout(currentImage, 5000);
          console.log(`[PlanningContext] Blob fetch took ${(performance.now() - fetchStart).toFixed(0)}ms`);
          if (!response.ok) {
            throw new Error(`Failed to fetch blob: ${response.statusText}`);
          }
          const blobStart = performance.now();
          const blob = await response.blob();
          console.log(`[PlanningContext] response.blob() took ${(performance.now() - blobStart).toFixed(0)}ms, size: ${blob.size}`);
          const file = new File([blob], "current.jpg", { type: blob.type || "image/jpeg" });
          console.log('[PlanningContext] Uploading to backend...');
          const uploadStart = performance.now();
          const uploadResult = await api.uploadImage(file);
          console.log(`[PlanningContext] Backend upload took ${(performance.now() - uploadStart).toFixed(0)}ms`);
          currentUploadId = uploadResult.uploadId;
          console.log('[PlanningContext] Current image uploaded:', currentUploadId);
          setPlanningState((prev) => ({ ...prev, currentImageUploadId: currentUploadId }));
        } catch (error) {
          console.error('[PlanningContext] Failed to upload current image:', error);
          throw new Error("Current image is no longer available. Please re-upload the image.");
        }
      } else if (currentUploadId && !currentImageChanged) {
        console.log('[PlanningContext] Reusing cached current image upload ID:', currentUploadId);
      }

      // Upload goal image only if:
      // 1. No cached upload ID exists, OR
      // 2. Image has changed from previous run
      if (goalImage.startsWith("blob:") && (!goalUploadId || goalImageChanged)) {
        console.log('[PlanningContext] Uploading goal image blob...', {
          hasUploadId: !!goalUploadId,
          imageChanged: goalImageChanged
        });
        try {
          // Use timeout to prevent hanging on stale blob URLs
          console.log('[PlanningContext] Fetching goal blob URL...');
          const fetchStart = performance.now();
          const response = await fetchWithTimeout(goalImage, 5000);
          console.log(`[PlanningContext] Goal blob fetch took ${(performance.now() - fetchStart).toFixed(0)}ms`);
          if (!response.ok) {
            throw new Error(`Failed to fetch blob: ${response.statusText}`);
          }
          const blobStart = performance.now();
          const blob = await response.blob();
          console.log(`[PlanningContext] Goal response.blob() took ${(performance.now() - blobStart).toFixed(0)}ms, size: ${blob.size}`);
          const file = new File([blob], "goal.jpg", { type: blob.type || "image/jpeg" });
          console.log('[PlanningContext] Uploading goal to backend...');
          const uploadStart = performance.now();
          const uploadResult = await api.uploadImage(file);
          console.log(`[PlanningContext] Goal backend upload took ${(performance.now() - uploadStart).toFixed(0)}ms`);
          goalUploadId = uploadResult.uploadId;
          console.log('[PlanningContext] Goal image uploaded:', goalUploadId);
          setPlanningState((prev) => ({ ...prev, goalImageUploadId: goalUploadId }));
        } catch (error) {
          console.error('[PlanningContext] Failed to upload goal image:', error);
          throw new Error("Goal image is no longer available. Please re-upload the image.");
        }
      } else if (goalUploadId && !goalImageChanged) {
        console.log('[PlanningContext] Reusing cached goal image upload ID:', goalUploadId);
      }

      // Use upload IDs for planning (must be upload IDs, not blob URLs)
      const currentImageRef = currentUploadId || currentImage;
      const goalImageRef = goalUploadId || goalImage;

      // Validate that we have valid references (not blob URLs)
      if (currentImageRef.startsWith("blob:") || goalImageRef.startsWith("blob:")) {
        throw new Error("Images must be uploaded to the backend before planning. Please try uploading again.");
      }

      console.log('[PlanningContext] Starting planning with refs:', { currentImageRef, goalImageRef, model, mode });

      // Branch based on planning mode
      if (mode === "trajectory") {
        // Trajectory planning mode
        console.log('[PlanningContext] Starting trajectory planning...');
        let taskId;
        try {
          const response = await api.startTrajectoryPlanning({
            currentImage: currentImageRef,
            goalImage: goalImageRef,
            model,
            numSteps: trajectorySteps,
            samples,
            iterations,
          });
          taskId = response.taskId;
          console.log('[PlanningContext] Trajectory planning started, taskId:', taskId);
        } catch (apiError) {
          console.error('[PlanningContext] api.startTrajectoryPlanning failed:', apiError);
          const errorMsg = apiError instanceof Error ? apiError.message : String(apiError);
          const isUploadError = errorMsg.toLowerCase().includes('upload not found') ||
                                errorMsg.toLowerCase().includes('re-upload');
          if (isUploadError) {
            setPlanningState((prev) => ({
              ...prev,
              currentImageUploadId: null,
              goalImageUploadId: null,
              previousCurrentImage: null,
              previousGoalImage: null,
            }));
            throw new Error("Images need to be re-uploaded. Please try again.");
          }
          throw apiError;
        }

        // Update task ID
        setPlanningState((prev) => ({
          ...prev,
          taskId,
          previousCurrentImage: currentImage,
          previousGoalImage: goalImage,
        }));

        // Subscribe to trajectory progress WebSocket
        console.log('[PlanningContext] Subscribing to trajectory WebSocket for task:', taskId);
        const subscription = api.subscribeToTrajectoryProgress(taskId, {
          onProgress: (trajectoryProgress) => {
            console.log('[PlanningContext] Trajectory progress:', trajectoryProgress);
            setPlanningState((prev) => ({ ...prev, trajectoryProgress }));
          },
          onComplete: (trajectoryResult) => {
            console.log('[PlanningContext] Trajectory completed:', trajectoryResult);
            setPlanningState((prev) => ({
              ...prev,
              isProcessing: false,
              hasResults: true,
              trajectoryResult,
            }));
            wsRef.current = null;
          },
          onError: (error) => {
            console.error('[PlanningContext] Trajectory error:', error);
            const lowerError = error.toLowerCase();
            const isImageError = lowerError.includes('could not load images') ||
                                 lowerError.includes('upload not found') ||
                                 lowerError.includes('re-upload');
            if (isImageError) {
              setPlanningState((prev) => ({
                ...prev,
                isProcessing: false,
                error: "Images need to be re-uploaded. Please try again.",
                currentImageUploadId: null,
                goalImageUploadId: null,
                previousCurrentImage: null,
                previousGoalImage: null,
              }));
            } else {
              setPlanningState((prev) => ({
                ...prev,
                isProcessing: false,
                error,
              }));
            }
            wsRef.current = null;
          },
          onCancelled: () => {
            console.log('[PlanningContext] Trajectory cancelled');
            setPlanningState((prev) => ({ ...prev, isProcessing: false }));
            wsRef.current = null;
          },
        });

        wsRef.current = subscription;
        return;  // Exit early for trajectory mode
      }

      // Single action planning mode (existing logic)
      console.log('[PlanningContext] Calling api.startPlanning...');
      let taskId;
      try {
        const response = await api.startPlanning({
          currentImage: currentImageRef,
          goalImage: goalImageRef,
          model,
          samples,
          iterations,
        });
        taskId = response.taskId;
        console.log('[PlanningContext] api.startPlanning returned taskId:', taskId);
      } catch (apiError) {
        console.error('[PlanningContext] api.startPlanning failed:', apiError);

        // Check if error is related to stale upload IDs
        const errorMsg = apiError instanceof Error ? apiError.message : String(apiError);
        const isUploadError = errorMsg.toLowerCase().includes('upload not found') ||
                              errorMsg.toLowerCase().includes('re-upload');

        if (isUploadError) {
          console.log('[PlanningContext] Stale upload ID detected, clearing cache and retrying...');
          // Clear cached upload IDs
          setPlanningState((prev) => ({
            ...prev,
            currentImageUploadId: null,
            goalImageUploadId: null,
            previousCurrentImage: null,
            previousGoalImage: null,
          }));
          throw new Error("Images need to be re-uploaded. Please try again.");
        }
        throw apiError;
      }

      // Update task ID and track current images for next run
      setPlanningState((prev) => ({
        ...prev,
        taskId,
        previousCurrentImage: currentImage,
        previousGoalImage: goalImage,
      }));

      // Subscribe to WebSocket for real-time progress
      console.log('[PlanningContext] Subscribing to WebSocket for task:', taskId);
      const subscription = api.subscribeToPlanningProgress(taskId, {
        onProgress: (progress) => {
          console.log('[PlanningContext] onProgress called:', progress);
          setPlanningState((prev) => ({ ...prev, progress }));
        },
        onComplete: (result) => {
          console.log('[PlanningContext] *** onComplete CALLBACK TRIGGERED ***');
          console.log('[PlanningContext] Result received:', result);

          // Update state first
          setPlanningState((prev) => ({
            ...prev,
            isProcessing: false,
            hasResults: true,
            result,
          }));

          // Auto-save to history (moved outside setState to avoid React warning)
          const currentState = planningStateRef.current;
          if (currentState.planningStartTime && currentState.planningModel) {
            const elapsedSeconds = Math.round((Date.now() - currentState.planningStartTime) / 1000);

            // Use setTimeout to defer the state update to the next tick
            setTimeout(async () => {
              try {
                console.log('[PlanningContext] Converting images to data URLs...');
                // Convert images to data URLs for permanent storage
                const currentImageData = await convertToDataURL(currentImage, currentUploadId);
                const goalImageData = await convertToDataURL(goalImage, goalUploadId);

                console.log('[PlanningContext] Images converted, saving to history...');
                addExperiment({
                  title: `Action planning - ${new Date().toLocaleDateString()}`,
                  currentImage: currentImageData,
                  goalImage: goalImageData,
                  action: result.action as [number, number, number],
                  confidence: result.confidence || 0,
                  energy: result.energy,
                  time: elapsedSeconds,
                  model: currentState.planningModel!,
                  samples: currentState.samples,
                  iterations: currentState.iterations,
                  energyHistory: result.energyHistory,
                });
                console.log('[PlanningContext] Experiment saved to history');
              } catch (error) {
                console.error('[PlanningContext] Failed to save experiment to history:', error);
              }
            }, 0);
          }

          wsRef.current = null;
        },
        onError: (error) => {
          console.error('[PlanningContext] onError callback triggered:', error);

          // Check if error is related to image loading (stale upload IDs)
          // Must be specific to avoid false positives (e.g., "Embeddings not cached" contains "image" in "images")
          const lowerError = error.toLowerCase();
          const isImageError = lowerError.includes('could not load images') ||
                               lowerError.includes('upload not found') ||
                               lowerError.includes('re-upload');

          if (isImageError) {
            console.log('[PlanningContext] Image loading error detected, clearing cached upload IDs');
            // Clear cached upload IDs so they're re-uploaded next time
            setPlanningState((prev) => ({
              ...prev,
              isProcessing: false,
              error: "Images need to be re-uploaded. This can happen if the backend was restarted. Please try again.",
              currentImageUploadId: null,
              goalImageUploadId: null,
              previousCurrentImage: null,
              previousGoalImage: null,
            }));
          } else {
            setPlanningState((prev) => ({
              ...prev,
              isProcessing: false,
              error,
            }));
          }
          wsRef.current = null;
        },
        onCancelled: () => {
          console.log('[PlanningContext] onCancelled callback triggered');
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
  }, [addExperiment]);

  const cancelPlanning = useCallback(async () => {
    const { taskId, mode } = planningState;

    // Cancel via WebSocket if connected
    if (wsRef.current) {
      wsRef.current.cancel();
      wsRef.current.ws.close();
      wsRef.current = null;
    }

    // Also cancel via API (use correct endpoint based on mode)
    if (taskId) {
      try {
        if (mode === "trajectory") {
          await api.cancelTrajectory(taskId);
        } else {
          await api.cancelPlanning(taskId);
        }
      } catch {
        // Ignore errors - task might already be done
      }
    }

    setPlanningState((prev) => ({ ...prev, isProcessing: false }));
  }, [planningState.taskId, planningState.mode]);

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
      currentImageUploadId: planningState.currentImageUploadId,
      goalImageUploadId: planningState.goalImageUploadId,
      setMode,
      setTrajectorySteps,
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
      setMode,
      setTrajectorySteps,
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
