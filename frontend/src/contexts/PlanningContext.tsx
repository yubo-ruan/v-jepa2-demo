"use client";

import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from "react";
import type { PlanningState, PresetType } from "@/types";
import { planningPresets, defaultPlanningState } from "@/constants/sampleData";

interface PlanningContextType {
  planningState: PlanningState;
  setPreset: (preset: PresetType) => void;
  setSamples: (samples: number) => void;
  setIterations: (iterations: number) => void;
  setCurrentImage: (image: string | null) => void;
  setGoalImage: (image: string | null) => void;
  startPlanning: () => void;
  cancelPlanning: () => void;
  completePlanning: () => void;
  reset: () => void;
  canGenerate: boolean;
  estimatedTime: number;
  estimatedCost: string;
}

const PlanningContext = createContext<PlanningContextType | null>(null);

const DEFAULT_STATE: PlanningState = {
  ...defaultPlanningState,
  currentImage: null,
  goalImage: null,
  hasResults: false,
  isProcessing: false,
};

export function PlanningProvider({ children }: { children: ReactNode }) {
  const [planningState, setPlanningState] = useState<PlanningState>(DEFAULT_STATE);

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

  const startPlanning = useCallback(() => {
    setPlanningState((prev) => ({ ...prev, isProcessing: true, hasResults: false }));
  }, []);

  const cancelPlanning = useCallback(() => {
    setPlanningState((prev) => ({ ...prev, isProcessing: false }));
  }, []);

  const completePlanning = useCallback(() => {
    setPlanningState((prev) => ({ ...prev, isProcessing: false, hasResults: true }));
  }, []);

  const reset = useCallback(() => {
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

  const value = useMemo(() => ({
    planningState,
    setPreset,
    setSamples,
    setIterations,
    setCurrentImage,
    setGoalImage,
    startPlanning,
    cancelPlanning,
    completePlanning,
    reset,
    canGenerate,
    estimatedTime,
    estimatedCost,
  }), [
    planningState,
    setPreset,
    setSamples,
    setIterations,
    setCurrentImage,
    setGoalImage,
    startPlanning,
    cancelPlanning,
    completePlanning,
    reset,
    canGenerate,
    estimatedTime,
    estimatedCost,
  ]);

  return (
    <PlanningContext.Provider value={value}>
      {children}
    </PlanningContext.Provider>
  );
}

export function usePlanning() {
  const context = useContext(PlanningContext);
  if (!context) {
    throw new Error("usePlanning must be used within a PlanningProvider");
  }
  return context;
}
