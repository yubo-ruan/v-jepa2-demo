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
const MAX_HISTORY_SIZE = 20; // Limit to 20 experiments - base64 images are ~100KB each, 2 per experiment = ~4MB at 20 experiments
const MAX_STORAGE_SIZE_MB = 4; // localStorage limit is typically 5MB, leave headroom

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
    if (experiments.length === 0) {
      // Don't save empty array (preserve any existing data if we just loaded)
      return;
    }

    try {
      const data = JSON.stringify(experiments);
      localStorage.setItem(STORAGE_KEY, data);
    } catch (error) {
      // Handle QuotaExceededError by removing oldest non-favorite experiments
      if (error instanceof DOMException && error.name === "QuotaExceededError") {
        console.warn("localStorage quota exceeded, removing oldest experiments...");
        // Remove oldest non-favorite experiments until it fits
        const toSave = experiments.filter((exp) => exp.favorite);
        const nonFavorites = experiments.filter((exp) => !exp.favorite);
        // Keep only the 5 most recent non-favorites
        const kept = [...toSave, ...nonFavorites.slice(0, 5)];
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(kept));
          console.log(`Reduced history from ${experiments.length} to ${kept.length} experiments`);
        } catch {
          // If still too big, clear history entirely
          console.error("Still too large, clearing history");
          localStorage.removeItem(STORAGE_KEY);
        }
      } else {
        console.error("Failed to save history to localStorage:", error);
      }
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
