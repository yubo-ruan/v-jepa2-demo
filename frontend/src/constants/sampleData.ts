// Sample data constants extracted from page.tsx and HistoryPage.tsx

import type { Experiment } from "@/types";

// Preset configurations for planning
export const planningPresets = [
  { id: "quick" as const, label: "Quick", samples: 100, iterations: 5, tooltip: "100 samples, 5 iter (~1-2 min)" },
  { id: "balanced" as const, label: "Balanced", samples: 400, iterations: 10, tooltip: "400 samples, 10 iter (~3-4 min) - Recommended", recommended: true },
  { id: "quality" as const, label: "Quality", samples: 800, iterations: 15, tooltip: "800 samples, 15 iter (~6-8 min)" },
] as const;

export type PresetId = typeof planningPresets[number]["id"];

// Navigation tabs
export const navTabs = [
  { id: "upload" as const, label: "Upload" },
  { id: "config" as const, label: "Config" },
  { id: "history" as const, label: "History" },
  { id: "research" as const, label: "Research" },
] as const;

export type NavTabId = typeof navTabs[number]["id"];

// Config tabs
export const configTabs = [
  { id: "model" as const, label: "Model Preferences" },
  { id: "ui" as const, label: "UI Settings" },
  { id: "advanced" as const, label: "Advanced" },
] as const;

export type ConfigTabId = typeof configTabs[number]["id"];

// Model dropdown options
export const modelOptions = [
  { value: "vit-large", label: "ViT-Large (fastest, 300M params)" },
  { value: "vit-huge", label: "ViT-Huge (balanced, 600M params)" },
  { value: "vit-giant", label: "ViT-Giant (best quality, 1.2B params) ⭐" },
  { value: "vit-giant-384", label: "ViT-Giant 384 (highest resolution, 1.2B params)" },
] as const;

// Preset dropdown options (for config page)
export const presetOptions = [
  { value: "quick", label: "Quick (100 samples, 5 iterations)" },
  { value: "balanced", label: "Balanced (400 samples, 10 iterations) ⭐" },
  { value: "quality", label: "Quality (800 samples, 15 iterations)" },
  { value: "custom", label: "Custom (save your own preset)" },
] as const;

// Cached models configuration
export const cachedModelsConfig = [
  { name: "ViT-Giant", params: "1.2B", size: "7.2 GB", cached: true, progress: 100 },
  { name: "ViT-Huge", params: "600M", size: "~4.5 GB", cached: false, progress: 0 },
  { name: "ViT-Large", params: "300M", size: "~2.1 GB", cached: false, progress: 0 },
] as const;

// Sample history data for demo
export const sampleExperiments: Experiment[] = [
  {
    id: "exp_001",
    timestamp: "Nov 25, 2024 - 2:34 PM",
    title: "Robot reach task",
    confidence: 82,
    energy: 1.23,
    time: 3.4,
    model: "ViT-Giant",
    action: [3.2, -1.5, 0.8],
    samples: 400,
    iterations: 10,
    favorite: true,
  },
  {
    id: "exp_002",
    timestamp: "Nov 25, 2024 - 1:15 PM",
    title: "Pick and place demo",
    confidence: 75,
    energy: 1.45,
    time: 2.8,
    model: "ViT-Huge",
    action: [2.8, -1.2, 1.0],
    samples: 200,
    iterations: 8,
    favorite: false,
  },
  {
    id: "exp_003",
    timestamp: "Nov 24, 2024 - 4:22 PM",
    title: "Grasp optimization",
    confidence: 90,
    energy: 0.98,
    time: 4.1,
    model: "ViT-Giant",
    action: [-1.5, 2.3, 0.5],
    samples: 600,
    iterations: 12,
    favorite: true,
  },
  {
    id: "exp_004",
    timestamp: "Nov 24, 2024 - 11:08 AM",
    title: "Assembly task test",
    confidence: 45,
    energy: 2.34,
    time: 5.2,
    model: "ViT-Large",
    action: [0.8, -0.5, 2.1],
    samples: 100,
    iterations: 5,
    favorite: false,
  },
];

// Default values for state initialization
export const defaultModelConfig = {
  defaultModel: "vit-giant",
  defaultPreset: "balanced",
  customSamples: 600,
  customIterations: 12,
  customEliteFraction: 0.15,
  autoDownload: true,
  cacheModels: true,
  cpuOnly: false,
  actionDimensions: "7d" as const,
};

export const defaultUIConfig = {
  theme: "dark" as const,
  showCostEstimates: true,
  showTimeEstimates: true,
  showTooltips: true,
  compactMode: false,
  distanceUnits: "cm" as const,
};

export const defaultAdvancedConfig = {
  gpuDevice: "auto",
  clearCacheAfterPlanning: true,
  debugMode: false,
};

export const defaultPlanningState = {
  preset: "balanced" as const,
  samples: 400,
  iterations: 10,
};
