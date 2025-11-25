"use client";

import { createContext, useContext, useState, useCallback, useMemo, useEffect, type ReactNode } from "react";
import type { ModelConfig, UIConfig, AdvancedConfig, DownloadConfig } from "@/types";
import { defaultModelConfig, defaultUIConfig, defaultAdvancedConfig } from "@/constants/sampleData";

interface ConfigContextType {
  modelConfig: ModelConfig;
  uiConfig: UIConfig;
  advancedConfig: AdvancedConfig;
  downloadConfig: DownloadConfig;
  isHydrated: boolean;
  updateModelConfig: (updates: Partial<ModelConfig>) => void;
  updateUIConfig: (updates: Partial<UIConfig>) => void;
  updateAdvancedConfig: (updates: Partial<AdvancedConfig>) => void;
  updateDownloadConfig: (updates: Partial<DownloadConfig>) => void;
  saveConfig: () => void;
  resetConfig: () => void;
}

const ConfigContext = createContext<ConfigContextType | null>(null);

const STORAGE_KEY = "vjepa2-config";

// Extract download config from model config
const extractDownloadConfig = (mc: typeof defaultModelConfig): DownloadConfig => ({
  autoDownload: mc.autoDownload,
  cacheModels: mc.cacheModels,
  cpuOnly: mc.cpuOnly,
});

export function ConfigProvider({ children }: { children: ReactNode }) {
  const [modelConfig, setModelConfig] = useState<ModelConfig>(defaultModelConfig);
  const [uiConfig, setUIConfig] = useState<UIConfig>(defaultUIConfig);
  const [advancedConfig, setAdvancedConfig] = useState<AdvancedConfig>(defaultAdvancedConfig);
  const [downloadConfig, setDownloadConfig] = useState<DownloadConfig>(extractDownloadConfig(defaultModelConfig));
  const [isHydrated, setIsHydrated] = useState(false);

  // Load config from localStorage after hydration to avoid mismatch
  useEffect(() => {
    setIsHydrated(true);
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.modelConfig) setModelConfig(parsed.modelConfig);
        if (parsed.uiConfig) setUIConfig(parsed.uiConfig);
        if (parsed.advancedConfig) setAdvancedConfig(parsed.advancedConfig);
        if (parsed.downloadConfig) setDownloadConfig(parsed.downloadConfig);
      }
    } catch {
      // Ignore parse errors, use defaults
    }
  }, []);

  const updateModelConfig = useCallback((updates: Partial<ModelConfig>) => {
    setModelConfig((prev) => ({ ...prev, ...updates }));
  }, []);

  const updateUIConfig = useCallback((updates: Partial<UIConfig>) => {
    setUIConfig((prev) => ({ ...prev, ...updates }));
  }, []);

  const updateAdvancedConfig = useCallback((updates: Partial<AdvancedConfig>) => {
    setAdvancedConfig((prev) => ({ ...prev, ...updates }));
  }, []);

  const updateDownloadConfig = useCallback((updates: Partial<DownloadConfig>) => {
    setDownloadConfig((prev) => ({ ...prev, ...updates }));
  }, []);

  const saveConfig = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        modelConfig,
        uiConfig,
        advancedConfig,
        downloadConfig,
      }));
    } catch {
      // Ignore storage errors
    }
  }, [modelConfig, uiConfig, advancedConfig, downloadConfig]);

  const resetConfig = useCallback(() => {
    setModelConfig(defaultModelConfig);
    setUIConfig(defaultUIConfig);
    setAdvancedConfig(defaultAdvancedConfig);
    setDownloadConfig(extractDownloadConfig(defaultModelConfig));
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const value = useMemo(() => ({
    modelConfig,
    uiConfig,
    advancedConfig,
    downloadConfig,
    isHydrated,
    updateModelConfig,
    updateUIConfig,
    updateAdvancedConfig,
    updateDownloadConfig,
    saveConfig,
    resetConfig,
  }), [
    modelConfig,
    uiConfig,
    advancedConfig,
    downloadConfig,
    isHydrated,
    updateModelConfig,
    updateUIConfig,
    updateAdvancedConfig,
    updateDownloadConfig,
    saveConfig,
    resetConfig,
  ]);

  return (
    <ConfigContext.Provider value={value}>
      {children}
    </ConfigContext.Provider>
  );
}

export function useConfig() {
  const context = useContext(ConfigContext);
  if (!context) {
    throw new Error("useConfig must be used within a ConfigProvider");
  }
  return context;
}
