// Research module types and constants

// Research sub-tabs
export type ResearchTab = "dashboard" | "datasets" | "finetune" | "training" | "models" | "compare" | "benchmarks" | "analysis";

// Sub-navigation tabs config
export const researchTabs = [
  { id: "dashboard" as const, label: "Dashboard", icon: "🏠" },
  { id: "datasets" as const, label: "Datasets", icon: "📊" },
  { id: "finetune" as const, label: "Fine-tuning", icon: "🎓" },
  { id: "training" as const, label: "Training", icon: "🏋️" },
  { id: "models" as const, label: "Models", icon: "📦" },
  { id: "compare" as const, label: "Compare", icon: "🔄" },
  { id: "benchmarks" as const, label: "Benchmarks", icon: "🎯" },
  { id: "analysis" as const, label: "Analysis", icon: "📈" },
];

// Quick action cards
export const quickActions = [
  { id: "upload", label: "Upload Dataset", icon: "📁", tab: "datasets" as ResearchTab },
  { id: "train", label: "Start Training", icon: "🚀", tab: "finetune" as ResearchTab },
  { id: "compare", label: "Compare Models", icon: "🔄", tab: "compare" as ResearchTab },
  { id: "benchmark", label: "Run Benchmark", icon: "🎯", tab: "benchmarks" as ResearchTab },
];

// Sample data for active trainings
export const activeTrainings = [
  {
    id: "droid-finetune-v1",
    name: "DROID-finetune-v1",
    progress: 24,
    eta: "7h 26m",
    status: "training" as const,
  },
];

// Sample data for recent results
export const recentResults = [
  { id: 1, text: "v1 vs Baseline: +18% improvement", success: true },
  { id: 2, text: "v2 training completed (pending evaluation)", success: null },
];

// Sample data for models
export const modelsSummary = {
  total: 3,
  production: 1,
};

// Sample data for datasets
export const datasetsSummary = [
  { name: "DROID v1.0", trajectories: "76k", status: "validated" },
  { name: "Custom", trajectories: "5k", status: "validated" },
];
