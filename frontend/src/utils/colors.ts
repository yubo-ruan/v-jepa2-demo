/**
 * Color utilities for progress visualization
 * Used across energy charts, convergence displays, and progress bars
 */

// Progress thresholds for color transitions
const THRESHOLDS = {
  RED: 0.33,
  ORANGE: 0.5,
  YELLOW: 0.66,
  LIME: 0.83,
} as const;

// Hex colors for SVG/canvas rendering
const HEX_COLORS = {
  red: "#ef4444",
  orange: "#f97316",
  yellow: "#eab308",
  lime: "#84cc16",
  green: "#22c55e",
} as const;

// Tailwind gradient classes for styled elements
const TAILWIND_GRADIENTS = {
  red: "from-red-500 to-orange-400",
  orange: "from-orange-400 to-yellow-400",
  yellow: "from-yellow-500 to-lime-400",
  lime: "from-lime-400 to-green-400",
  green: "from-green-500 to-emerald-400",
} as const;

/**
 * Get a hex color based on progress (0-1)
 * Red → Orange → Yellow → Lime → Green
 */
export function getProgressColorHex(progress: number): string {
  if (progress < THRESHOLDS.RED) return HEX_COLORS.red;
  if (progress < THRESHOLDS.ORANGE) return HEX_COLORS.orange;
  if (progress < THRESHOLDS.YELLOW) return HEX_COLORS.yellow;
  if (progress < THRESHOLDS.LIME) return HEX_COLORS.lime;
  return HEX_COLORS.green;
}

/**
 * Get Tailwind gradient classes based on progress (0-1)
 */
export function getProgressGradient(progress: number): string {
  if (progress < THRESHOLDS.ORANGE) return TAILWIND_GRADIENTS.red;
  if (progress < 0.8) return TAILWIND_GRADIENTS.yellow;
  return TAILWIND_GRADIENTS.green;
}

/**
 * Get energy heatmap color (blue = low energy/good, red = high energy/bad)
 * For energy landscape visualization
 */
export function getEnergyColor(energy: number, minEnergy: number, maxEnergy: number): string {
  const normalized = (energy - minEnergy) / (maxEnergy - minEnergy);

  // Interpolate from blue (low energy) to red (high energy)
  const r = Math.round(normalized * 255);
  const g = Math.round((1 - Math.abs(normalized - 0.5) * 2) * 100);
  const b = Math.round((1 - normalized) * 255);

  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Pre-compute a color palette for energy visualization (100 steps)
 * More efficient than calculating per-cell
 */
export function createEnergyColorPalette(minEnergy: number, maxEnergy: number): Map<number, string> {
  const palette = new Map<number, string>();
  for (let i = 0; i <= 100; i++) {
    const energy = minEnergy + (maxEnergy - minEnergy) * (i / 100);
    palette.set(i, getEnergyColor(energy, minEnergy, maxEnergy));
  }
  return palette;
}

/**
 * Look up color from pre-computed palette
 */
export function lookupEnergyColor(
  energy: number,
  minEnergy: number,
  maxEnergy: number,
  palette: Map<number, string>
): string {
  const index = Math.round(((energy - minEnergy) / (maxEnergy - minEnergy)) * 100);
  return palette.get(Math.max(0, Math.min(100, index))) || getEnergyColor(energy, minEnergy, maxEnergy);
}

/**
 * Get confidence level color
 */
export function getConfidenceColor(confidence: number): string {
  if (confidence >= 80) return "text-green-400";
  if (confidence >= 60) return "text-yellow-400";
  return "text-red-400";
}

export { HEX_COLORS, TAILWIND_GRADIENTS, THRESHOLDS };
