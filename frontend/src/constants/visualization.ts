/**
 * Visualization constants
 * Centralizes magic numbers used across visualization components
 */

// Energy Landscape visualization
export const ENERGY_LANDSCAPE = {
  SVG_SIZE: 280,
  ACTION_BOUNDS: 7.5,    // ±7.5cm action range
  RANGE: 15,             // Total range (ACTION_BOUNDS * 2)
  RESOLUTION: 25,        // Grid resolution
  PADDING: 20,
  MARKER_RADIUS: 6,
  MARKER_GLOW_RADIUS: 12,
} as const;

// Iteration Replay visualization
export const ITERATION_REPLAY = {
  SVG_WIDTH: 200,
  SVG_HEIGHT: 160,
  CHART_WIDTH: 160,
  CHART_HEIGHT: 120,
  PADDING_LEFT: 30,
  PADDING_TOP: 10,
  DOT_RADIUS: 3,
  ACTIVE_DOT_RADIUS: 5,
} as const;

// Sample distribution visualization
export const SAMPLE_DISTRIBUTION = {
  SVG_SIZE: 200,
  PADDING: 20,
  ELITE_RADIUS: 4,
  NORMAL_RADIUS: 2,
} as const;

// Progress bar colors (for mini convergence chart)
export const PROGRESS_BAR = {
  HEIGHT: 80,
  BAR_GAP: 1,
} as const;

// Animation speeds (ms)
export const ANIMATION = {
  PLAYBACK_BASE: 1000,   // Base playback interval
  TRANSITION: 200,        // UI transition duration
  FADE: 300,              // Fade in/out duration
} as const;

// Default planning parameters
export const PLANNING_DEFAULTS = {
  SAMPLES: {
    MIN: 50,
    MAX: 800,
    DEFAULT: 400,
  },
  ITERATIONS: {
    MIN: 3,
    MAX: 15,
    DEFAULT: 10,
  },
  ELITE_FRACTION: 0.1,
} as const;

// SVG coordinate helpers
export function toSvgX(value: number, range: number = ENERGY_LANDSCAPE.RANGE, size: number = ENERGY_LANDSCAPE.SVG_SIZE): number {
  return ((value + range / 2) / range) * size;
}

export function toSvgY(value: number, range: number = ENERGY_LANDSCAPE.RANGE, size: number = ENERGY_LANDSCAPE.SVG_SIZE): number {
  return size - ((value + range / 2) / range) * size;
}

export function fromSvgX(svgX: number, range: number = ENERGY_LANDSCAPE.RANGE, size: number = ENERGY_LANDSCAPE.SVG_SIZE): number {
  return (svgX / size) * range - range / 2;
}

export function fromSvgY(svgY: number, range: number = ENERGY_LANDSCAPE.RANGE, size: number = ENERGY_LANDSCAPE.SVG_SIZE): number {
  return ((size - svgY) / size) * range - range / 2;
}
