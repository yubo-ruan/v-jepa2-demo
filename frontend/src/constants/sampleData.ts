// Sample data constants extracted from page.tsx and HistoryPage.tsx

import type { Experiment } from "@/types";

// Preset configurations for planning
export const planningPresets = [
  { id: "minimum" as const, label: "Minimum", samples: 50, iterations: 3, tooltip: "50 samples, 3 iter (fastest)", recommended: false },
  { id: "quick" as const, label: "Quick", samples: 100, iterations: 5, tooltip: "100 samples, 5 iter (~1-2 min)", recommended: false },
  { id: "balanced" as const, label: "Balanced", samples: 400, iterations: 10, tooltip: "400 samples, 10 iter (~3-4 min)", recommended: false },
  { id: "quality" as const, label: "Quality", samples: 800, iterations: 15, tooltip: "800 samples, 15 iter (~6-8 min)", recommended: false },
] as const;

export type PresetId = typeof planningPresets[number]["id"];

// Navigation tabs
export const navTabs = [
  { id: "inference" as const, label: "Inference" },
  { id: "config" as const, label: "Config" },
  { id: "history" as const, label: "History" },
  { id: "finetune" as const, label: "Fine-tune" },
] as const;

export type NavTabId = typeof navTabs[number]["id"];

// Config tabs
export const configTabs = [
  { id: "ui" as const, label: "UI Settings" },
  { id: "advanced" as const, label: "Advanced" },
] as const;

export type ConfigTabId = typeof configTabs[number]["id"];

// Model dropdown options (base models)
export const modelOptions = [
  { value: "vit-large", label: "ViT-Large (fastest, 300M params)", isAc: false },
  { value: "vit-huge", label: "ViT-Huge (balanced, 630M params)", isAc: false },
  { value: "vit-giant", label: "ViT-Giant (best quality, 1.2B params)", isAc: false },
  { value: "vit-giant-ac", label: "ViT-Giant AC (7D actions, 1.2B params) ⭐", isAc: true },
] as const;

// Model variants - these map to actual V-JEPA2 hub models
export const modelVariants = [
  {
    id: "vit-large",
    name: "V-JEPA2 ViT-Large",
    description: "Best for 16GB devices (~300M params, ~2.1GB)",
    baseModel: "vit-large",
    baseModelName: "vjepa2_vit_large",
    isRecommended: true,
  },
  {
    id: "vit-huge",
    name: "V-JEPA2 ViT-Huge",
    description: "Balanced quality/speed (~630M params, ~4.5GB)",
    baseModel: "vit-huge",
    baseModelName: "vjepa2_vit_huge",
    isRecommended: false,
  },
  {
    id: "vit-giant",
    name: "V-JEPA2 ViT-Giant",
    description: "Best quality, requires 32GB+ (~1.2B params, ~7.2GB)",
    baseModel: "vit-giant",
    baseModelName: "vjepa2_vit_giant",
    isRecommended: false,
  },
  {
    id: "vit-giant-ac",
    name: "V-JEPA2-AC ViT-Giant",
    description: "Action-Conditioned for planning (7D actions, ~7.2GB)",
    baseModel: "vit-giant-ac",
    baseModelName: "vjepa2_ac_vit_giant",
    isRecommended: false,
  },
] as const;

// Preset dropdown options (for config page)
export const presetOptions = [
  { value: "minimum", label: "Minimum (50 samples, 3 iterations)" },
  { value: "quick", label: "Quick (100 samples, 5 iterations)" },
  { value: "balanced", label: "Balanced (400 samples, 10 iterations) ⭐" },
  { value: "quality", label: "Quality (800 samples, 15 iterations)" },
  { value: "custom", label: "Custom (save your own preset)" },
] as const;

// Cached models configuration
export const cachedModelsConfig = [
  { name: "ViT-Large", params: "300M", size: "~2.1 GB", cached: true, progress: 100 },
  { name: "ViT-Huge", params: "630M", size: "~4.5 GB", cached: false, progress: 0 },
  { name: "ViT-Giant", params: "1.2B", size: "~7.2 GB", cached: false, progress: 0 },
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
  defaultModel: "vit-large",
  defaultVariant: "vit-large",
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
  showTimeEstimates: true,
  showTooltips: true,
  distanceUnits: "cm" as const,
};

export const defaultAdvancedConfig = {
  gpuDevice: "auto",
  clearCacheAfterPlanning: true,
  debugMode: false,
};

export const defaultPlanningState = {
  preset: "minimum" as const,
  samples: 50,
  iterations: 3,
};
