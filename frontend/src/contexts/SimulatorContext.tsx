"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

interface SimulatorState {
  currentImage: string | null;  // Base64 encoded image from simulator
  isInitialized: boolean;
}

interface SimulatorContextType {
  simulatorState: SimulatorState;
  setSimulatorImage: (image: string | null) => void;
  setInitialized: (initialized: boolean) => void;
}

const SimulatorContext = createContext<SimulatorContextType | null>(null);

export function SimulatorProvider({ children }: { children: ReactNode }) {
  const [simulatorState, setSimulatorState] = useState<SimulatorState>({
    currentImage: null,
    isInitialized: false,
  });

  const setSimulatorImage = useCallback((image: string | null) => {
    setSimulatorState(prev => ({ ...prev, currentImage: image }));
  }, []);

  const setInitialized = useCallback((initialized: boolean) => {
    setSimulatorState(prev => ({ ...prev, isInitialized: initialized }));
  }, []);

  return (
    <SimulatorContext.Provider value={{ simulatorState, setSimulatorImage, setInitialized }}>
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
