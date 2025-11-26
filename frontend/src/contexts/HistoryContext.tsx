"use client";

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";

export interface ExperimentHistory {
  id: string;
  title: string;
  timestamp: number;
  currentImage: string; // upload_id or base64
  goalImage: string; // upload_id or base64
  action: [number, number, number];
  confidence: number;
  energy: number;
  time: number; // seconds
  model: string;
  samples: number;
  iterations: number;
  favorite: boolean;
  energyHistory?: number[];
}

interface HistoryContextType {
  experiments: ExperimentHistory[];
  addExperiment: (experiment: Omit<ExperimentHistory, "id" | "timestamp" | "favorite">) => void;
  removeExperiment: (id: string) => void;
  toggleFavorite: (id: string) => void;
  clearAll: () => void;
}

const HistoryContext = createContext<HistoryContextType | null>(null);

const STORAGE_KEY = "vjepa2-planning-history";
const MAX_HISTORY_SIZE = 100; // Limit history to prevent excessive storage

export function HistoryProvider({ children }: { children: ReactNode }) {
  const [experiments, setExperiments] = useState<ExperimentHistory[]>([]);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setExperiments(parsed);
      }
    } catch (error) {
      console.error("Failed to load history from localStorage:", error);
    }
  }, []);

  // Save to localStorage whenever experiments change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(experiments));
    } catch (error) {
      console.error("Failed to save history to localStorage:", error);
    }
  }, [experiments]);

  const addExperiment = useCallback((experiment: Omit<ExperimentHistory, "id" | "timestamp" | "favorite">) => {
    const newExperiment: ExperimentHistory = {
      ...experiment,
      id: `exp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      favorite: false,
    };

    setExperiments((prev) => {
      // Add to front (most recent first)
      const updated = [newExperiment, ...prev];
      // Limit size
      return updated.slice(0, MAX_HISTORY_SIZE);
    });
  }, []);

  const removeExperiment = useCallback((id: string) => {
    setExperiments((prev) => prev.filter((exp) => exp.id !== id));
  }, []);

  const toggleFavorite = useCallback((id: string) => {
    setExperiments((prev) =>
      prev.map((exp) =>
        exp.id === id ? { ...exp, favorite: !exp.favorite } : exp
      )
    );
  }, []);

  const clearAll = useCallback(() => {
    setExperiments([]);
  }, []);

  return (
    <HistoryContext.Provider
      value={{
        experiments,
        addExperiment,
        removeExperiment,
        toggleFavorite,
        clearAll,
      }}
    >
      {children}
    </HistoryContext.Provider>
  );
}

export function useHistory() {
  const context = useContext(HistoryContext);
  if (!context) {
    throw new Error("useHistory must be used within a HistoryProvider");
  }
  return context;
}
