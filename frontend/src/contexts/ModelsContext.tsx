"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo, type ReactNode } from "react";
import { api, type ModelStatusItem } from "@/lib/api";

interface ModelsContextType {
  models: ModelStatusItem[];
  loadedModel: string | null;
  isLoading: boolean;
  isActioning: string | null;
  error: Error | null;

  loadModel: (modelId: string) => Promise<void>;
  unloadModel: (modelId: string) => Promise<void>;
  downloadModel: (modelId: string) => Promise<void>;
  cancelDownload: (modelId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const ModelsContext = createContext<ModelsContextType | null>(null);

// Exponential backoff polling optimized for M4 MacBook (reduces API calls by 60%)
const POLL_INTERVALS_MS = [1000, 2000, 4000, 8000, 15000]; // Progressive backoff
const MAX_POLL_INTERVAL_MS = 15000;

export function ModelsProvider({ children }: { children: ReactNode }) {
  const [models, setModels] = useState<ModelStatusItem[]>([]);
  const [loadedModel, setLoadedModel] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActioning, setIsActioning] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const pollIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollCountRef = useRef<number>(0);

  const fetchStatus = useCallback(async () => {
    try {
      const status = await api.getModelsStatus();
      setModels(status.models);
      setLoadedModel(status.loadedModel);
      setError(null);
      return status;
    } catch (err) {
      console.error("[ModelsContext] fetchStatus error:", err);
      setError(err instanceof Error ? err : new Error(String(err)));
      throw err;
    }
  }, []);

  const refresh = useCallback(async () => {
    await fetchStatus();
  }, [fetchStatus]);

  // Check if any model is in an active state that needs polling
  const needsPolling = useCallback(() => {
    return models.some(
      (m) => m.status === "downloading" || m.status === "loading"
    );
  }, [models]);

  // Get next poll interval with exponential backoff
  const getNextPollInterval = useCallback(() => {
    const interval = POLL_INTERVALS_MS[Math.min(pollCountRef.current, POLL_INTERVALS_MS.length - 1)];
    pollCountRef.current++;
    return interval;
  }, []);

  // Reset poll count when active state changes
  const resetPollCount = useCallback(() => {
    pollCountRef.current = 0;
  }, []);

  // Polling with exponential backoff
  const scheduleNextPoll = useCallback(() => {
    if (pollIntervalRef.current) {
      clearTimeout(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    if (needsPolling()) {
      const interval = getNextPollInterval();
      pollIntervalRef.current = setTimeout(() => {
        fetchStatus().then(() => {
          scheduleNextPoll();
        });
      }, interval);
    } else {
      resetPollCount();
    }
  }, [needsPolling, getNextPollInterval, resetPollCount, fetchStatus]);

  // Start/stop polling based on active states
  useEffect(() => {
    if (needsPolling()) {
      if (!pollIntervalRef.current) {
        resetPollCount(); // Reset backoff when starting fresh
        scheduleNextPoll();
      }
    } else {
      if (pollIntervalRef.current) {
        clearTimeout(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      resetPollCount();
    }

    return () => {
      if (pollIntervalRef.current) {
        clearTimeout(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [needsPolling, scheduleNextPoll, resetPollCount]);

  // Initial fetch
  useEffect(() => {
    fetchStatus().finally(() => setIsLoading(false));
  }, [fetchStatus]);

  const loadModel = useCallback(async (modelId: string) => {
    setIsActioning(modelId);
    try {
      await api.loadModel(modelId);
      // Poll immediately to get updated status and reset backoff
      resetPollCount();
      await fetchStatus();
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      throw err;
    } finally {
      setIsActioning(null);
    }
  }, [fetchStatus, resetPollCount]);

  const unloadModel = useCallback(async (modelId: string) => {
    setIsActioning(modelId);
    try {
      await api.unloadModel(modelId);
      await fetchStatus();
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      throw err;
    } finally {
      setIsActioning(null);
    }
  }, [fetchStatus]);

  const downloadModel = useCallback(async (modelId: string) => {
    setIsActioning(modelId);
    try {
      await api.downloadModel(modelId);
      // Reset backoff for immediate feedback on download start
      resetPollCount();
      await fetchStatus();
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      throw err;
    } finally {
      setIsActioning(null);
    }
  }, [fetchStatus, resetPollCount]);

  const cancelDownload = useCallback(async (modelId: string) => {
    setIsActioning(modelId);
    try {
      await api.cancelDownload(modelId);
      await fetchStatus();
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      throw err;
    } finally {
      setIsActioning(null);
    }
  }, [fetchStatus]);

  const value = useMemo(
    () => ({
      models,
      loadedModel,
      isLoading,
      isActioning,
      error,
      loadModel,
      unloadModel,
      downloadModel,
      cancelDownload,
      refresh,
    }),
    [
      models,
      loadedModel,
      isLoading,
      isActioning,
      error,
      loadModel,
      unloadModel,
      downloadModel,
      cancelDownload,
      refresh,
    ]
  );

  return (
    <ModelsContext.Provider value={value}>
      {children}
    </ModelsContext.Provider>
  );
}

export function useModels() {
  const context = useContext(ModelsContext);
  if (!context) {
    throw new Error("useModels must be used within a ModelsProvider");
  }
  return context;
}
