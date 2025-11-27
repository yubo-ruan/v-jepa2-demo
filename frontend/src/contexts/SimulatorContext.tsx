"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

interface SimulatorState {
  currentImage: string | null;  // Base64 encoded image from simulator
  isInitialized: boolean;
  pendingAction: number[] | null;  // Action to be loaded in simulator (7-DOF)
}

interface SimulatorContextType {
  simulatorState: SimulatorState;
  setSimulatorImage: (image: string | null) => void;
  setInitialized: (initialized: boolean) => void;
  setPendingAction: (action: number[] | null) => void;
  goToSimulator: () => void;
  setGoToSimulator: (callback: () => void) => void;
}

const SimulatorContext = createContext<SimulatorContextType | null>(null);

export function SimulatorProvider({ children }: { children: ReactNode }) {
  const [simulatorState, setSimulatorState] = useState<SimulatorState>({
    currentImage: null,
    isInitialized: false,
    pendingAction: null,
  });
  const [goToSimulatorCallback, setGoToSimulatorCallback] = useState<() => void>(() => () => {});

  const setSimulatorImage = useCallback((image: string | null) => {
    setSimulatorState(prev => ({ ...prev, currentImage: image }));
  }, []);

  const setInitialized = useCallback((initialized: boolean) => {
    setSimulatorState(prev => ({ ...prev, isInitialized: initialized }));
  }, []);

  const setPendingAction = useCallback((action: number[] | null) => {
    setSimulatorState(prev => ({ ...prev, pendingAction: action }));
  }, []);

  const goToSimulator = useCallback(() => {
    goToSimulatorCallback();
  }, [goToSimulatorCallback]);

  const setGoToSimulator = useCallback((callback: () => void) => {
    setGoToSimulatorCallback(() => callback);
  }, []);

  return (
    <SimulatorContext.Provider value={{ simulatorState, setSimulatorImage, setInitialized, setPendingAction, goToSimulator, setGoToSimulator }}>
      {children}
    </SimulatorContext.Provider>
  );
}

export function useSimulator() {
  const context = useContext(SimulatorContext);
  if (!context) {
    throw new Error("useSimulator must be used within a SimulatorProvider");
  }
  return context;
}
