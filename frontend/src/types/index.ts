// Experiment/History types
export interface Experiment {
  id: string;
  timestamp: string;
  title: string;
  confidence: number;
  energy: number;
  time: number;
  model: string;
  action: [number, number, number];
  samples: number;
  iterations: number;
  favorite: boolean;
}

// Config types
export interface ModelConfig {
  defaultModel: string;
  defaultVariant: string;
  defaultPreset: string;
  customSamples: number;
  customIterations: number;
  customEliteFraction: number;
  autoDownload: boolean;
  cacheModels: boolean;
  cpuOnly: boolean;
  actionDimensions: "3d" | "7d";
}

export interface UIConfig {
  theme: "dark" | "light" | "auto";
  showTimeEstimates: boolean;
  showTooltips: boolean;
  distanceUnits: "cm" | "m" | "mm";
}

export interface AdvancedConfig {
  gpuDevice: string;
  clearCacheAfterPlanning: boolean;
  debugMode: boolean;
}

// Planning types
export interface PlanningParams {
  preset: "minimum" | "quick" | "balanced" | "quality";
  samples: number;
  iterations: number;
  model: string;
}

export interface PlanningResult {
  action: [number, number, number];
  confidence: number;
  energy: number;
  time: number;
}

// Tab types
export type MainTab = "inference" | "history" | "finetune" | "simulator" | "libero";
export type ConfigTab = "ui" | "advanced";

// Filter/Sort types for History
export type FilterOption = "all" | "high" | "medium" | "low" | "favorites";
export type SortOption = "recent" | "confidence-high" | "confidence-low" | "time-long" | "time-short";

// Preset type
export type PresetType = "minimum" | "quick" | "balanced" | "quality";

// Navigation state
export interface NavState {
  activeTab: MainTab;
  researchTab: string;
  sidebarOpen: boolean;
}

// Planning state (for upload page)
export interface PlanningState {
  preset: PresetType;
  samples: number;
  iterations: number;
  currentImage: string | null;
  goalImage: string | null;
  hasResults: boolean;
  isProcessing: boolean;
}

// Download config
export interface DownloadConfig {
  autoDownload: boolean;
  cacheModels: boolean;
  cpuOnly: boolean;
}

// Toast state
export interface ToastState {
  visible: boolean;
  message: string;
  type?: "success" | "error" | "info";
}
