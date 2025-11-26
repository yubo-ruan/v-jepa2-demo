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

const POLL_INTERVAL_MS = 2000;

export function ModelsProvider({ children }: { children: ReactNode }) {
  const [models, setModels] = useState<ModelStatusItem[]>([]);
  const [loadedModel, setLoadedModel] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActioning, setIsActioning] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  // Start/stop polling based on active states
  useEffect(() => {
    if (needsPolling()) {
      if (!pollIntervalRef.current) {
        pollIntervalRef.current = setInterval(fetchStatus, POLL_INTERVAL_MS);
      }
    } else {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [needsPolling, fetchStatus]);

  // Initial fetch
  useEffect(() => {
    fetchStatus().finally(() => setIsLoading(false));
  }, [fetchStatus]);

  const loadModel = useCallback(async (modelId: string) => {
    setIsActioning(modelId);
    try {
      await api.loadModel(modelId);
      // Poll immediately to get updated status
      await fetchStatus();
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      throw err;
    } finally {
      setIsActioning(null);
    }
  }, [fetchStatus]);

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
      await fetchStatus();
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      throw err;
    } finally {
      setIsActioning(null);
    }
  }, [fetchStatus]);

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
