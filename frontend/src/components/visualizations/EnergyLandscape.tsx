"use client";

import { useState, useMemo, useCallback } from "react";
import { getEnergyColor, createEnergyColorPalette, lookupEnergyColor } from "@/utils/colors";
import { ENERGY_LANDSCAPE, toSvgX, toSvgY } from "@/constants/visualization";

interface EnergyLandscapeProps {
  optimalAction: [number, number, number];
  onActionSelect?: (action: [number, number, number], energy: number) => void;
}

// Generate mock energy landscape data
// In production, this would come from the model
function generateEnergyData(
  optimalAction: [number, number, number],
  slicePlane: "XY" | "XZ" | "YZ",
  fixedValue: number,
  resolution: number = 20
): { x: number; y: number; energy: number }[] {
  const data: { x: number; y: number; energy: number }[] = [];
  const range = 7.5; // ±7.5cm action bounds
  const step = (range * 2) / resolution;

  for (let i = 0; i <= resolution; i++) {
    for (let j = 0; j <= resolution; j++) {
      const coord1 = -range + i * step;
      const coord2 = -range + j * step;

      let action: [number, number, number];
      if (slicePlane === "XY") {
        action = [coord1, coord2, fixedValue];
      } else if (slicePlane === "XZ") {
        action = [coord1, fixedValue, coord2];
      } else {
        action = [fixedValue, coord1, coord2];
      }

      // Calculate energy as distance from optimal + some noise for realism
      const distance = Math.sqrt(
        Math.pow(action[0] - optimalAction[0], 2) +
        Math.pow(action[1] - optimalAction[1], 2) +
        Math.pow(action[2] - optimalAction[2], 2)
      );

      // Add some realistic energy landscape features (local minima, gradients)
      const noise = Math.sin(coord1 * 0.5) * 0.3 + Math.cos(coord2 * 0.5) * 0.3;
      const energy = distance * 0.8 + noise + Math.random() * 0.1;

      data.push({ x: coord1, y: coord2, energy: Math.max(0.5, energy) });
    }
  }

  return data;
}

export function EnergyLandscape({ optimalAction, onActionSelect }: EnergyLandscapeProps) {
  const [viewMode, setViewMode] = useState<"2D" | "3D">("2D");
  const [slicePlane, setSlicePlane] = useState<"XY" | "XZ" | "YZ">("XY");
  const [fixedValue, setFixedValue] = useState(optimalAction[2]);
  const [hoveredPoint, setHoveredPoint] = useState<{ x: number; y: number; energy: number } | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<{ x: number; y: number; energy: number } | null>(null);
  const [showGradients, setShowGradients] = useState(false);
  const [showOptimalMarker, setShowOptimalMarker] = useState(true);

  // Use constants for layout
  const { SVG_SIZE, RESOLUTION, ACTION_BOUNDS, RANGE } = ENERGY_LANDSCAPE;

  // Generate energy data
  const energyData = useMemo(() => {
    return generateEnergyData(optimalAction, slicePlane, fixedValue, RESOLUTION);
  }, [optimalAction, slicePlane, fixedValue, RESOLUTION]);

  // Calculate min/max for color scaling
  const { minEnergy, maxEnergy } = useMemo(() => {
    const energies = energyData.map(d => d.energy);
    return {
      minEnergy: Math.min(...energies),
      maxEnergy: Math.max(...energies)
    };
  }, [energyData]);

  // Pre-compute color palette for energy values (performance optimization)
  const colorPalette = useMemo(
    () => createEnergyColorPalette(minEnergy, maxEnergy),
    [minEnergy, maxEnergy]
  );

  // Get optimal point in current slice
  const optimalInSlice = useMemo(() => {
    if (slicePlane === "XY") {
      return { x: optimalAction[0], y: optimalAction[1] };
    } else if (slicePlane === "XZ") {
      return { x: optimalAction[0], y: optimalAction[2] };
    } else {
      return { x: optimalAction[1], y: optimalAction[2] };
    }
  }, [optimalAction, slicePlane]);

  // Handle click on heatmap
  const handleCellClick = useCallback((point: { x: number; y: number; energy: number }) => {
    setSelectedPoint(point);

    // Convert 2D point back to 3D action
    let action: [number, number, number];
    if (slicePlane === "XY") {
      action = [point.x, point.y, fixedValue];
    } else if (slicePlane === "XZ") {
      action = [point.x, fixedValue, point.y];
    } else {
      action = [fixedValue, point.x, point.y];
    }

    onActionSelect?.(action, point.energy);
  }, [slicePlane, fixedValue, onActionSelect]);

  // Calculate distance from selected point to optimal
  const distanceFromOptimal = useMemo(() => {
    if (!selectedPoint) return null;
    return Math.sqrt(
      Math.pow(selectedPoint.x - optimalInSlice.x, 2) +
      Math.pow(selectedPoint.y - optimalInSlice.y, 2)
    ).toFixed(2);
  }, [selectedPoint, optimalInSlice]);

  // Get axis labels based on slice plane
  const axisLabels = useMemo(() => {
    if (slicePlane === "XY") return { x: "X", y: "Y", fixed: "Z" };
    if (slicePlane === "XZ") return { x: "X", y: "Z", fixed: "Y" };
    return { x: "Y", y: "Z", fixed: "X" };
  }, [slicePlane]);

  // Convert data to grid format for rendering
  const gridSize = RESOLUTION + 1;
  const cellSize = SVG_SIZE / gridSize;

  // Memoized coordinate conversion helpers
  const coordToSvg = useCallback((x: number, y: number) => ({
    x: toSvgX(x, RANGE, SVG_SIZE),
    y: toSvgY(y, RANGE, SVG_SIZE),
  }), [RANGE, SVG_SIZE]);

  return (
    <div className="bg-zinc-900 rounded-xl border border-zinc-700 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-semibold text-zinc-300">Energy Landscape</h4>
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode("2D")}
            className={`px-3 py-1 text-xs rounded transition-colors ${
              viewMode === "2D"
                ? "bg-indigo-600 text-white"
                : "bg-zinc-700 text-zinc-400 hover:text-white"
            }`}
          >
            2D
          </button>
          <button
            onClick={() => setViewMode("3D")}
            className={`px-3 py-1 text-xs rounded transition-colors ${
              viewMode === "3D"
                ? "bg-indigo-600 text-white"
                : "bg-zinc-700 text-zinc-400 hover:text-white"
            }`}
          >
            3D
          </button>
          <button
            className="px-3 py-1 text-xs bg-zinc-700 text-zinc-400 hover:text-white rounded transition-colors"
          >
            Save
          </button>
        </div>
      </div>

      {viewMode === "2D" ? (
        <>
          {/* 2D Heatmap */}
          <div className="relative">
            {/* Y-axis label */}
            <div className="absolute -left-6 top-1/2 -translate-y-1/2 -rotate-90 text-xs text-zinc-500 font-medium">
              {axisLabels.y} (cm)
            </div>

            {/* Heatmap container */}
            <div
              className="relative w-[280px] h-[280px] mx-auto bg-zinc-800 rounded overflow-hidden cursor-crosshair"
              style={{ touchAction: 'none' }}
            >
              {/* Grid cells */}
              <svg width="280" height="280" className="absolute inset-0">
                {energyData.map((point, i) => {
                  const row = Math.floor(i / gridSize);
                  const col = i % gridSize;
                  return (
                    <rect
                      key={i}
                      x={col * cellSize}
                      y={(gridSize - 1 - row) * cellSize}
                      width={cellSize + 0.5}
                      height={cellSize + 0.5}
                      fill={lookupEnergyColor(point.energy, minEnergy, maxEnergy, colorPalette)}
                      className="transition-opacity"
                      style={{
                        opacity: hoveredPoint === point ? 0.7 : 1
                      }}
                      onMouseEnter={() => setHoveredPoint(point)}
                      onMouseLeave={() => setHoveredPoint(null)}
                      onClick={() => handleCellClick(point)}
                    />
                  );
                })}

                {/* Crosshairs on hover for precise selection */}
                {hoveredPoint && (
                  <>
                    <line
                      x1={((hoveredPoint.x + 7.5) / 15) * 280}
                      y1="0"
                      x2={((hoveredPoint.x + 7.5) / 15) * 280}
                      y2="280"
                      stroke="rgba(255,255,255,0.3)"
                      strokeWidth="1"
                      strokeDasharray="4,4"
                    />
                    <line
                      x1="0"
                      y1={280 - ((hoveredPoint.y + 7.5) / 15) * 280}
                      x2="280"
                      y2={280 - ((hoveredPoint.y + 7.5) / 15) * 280}
                      stroke="rgba(255,255,255,0.3)"
                      strokeWidth="1"
                      strokeDasharray="4,4"
                    />
                    {/* Preview dot at cursor */}
                    <circle
                      cx={((hoveredPoint.x + 7.5) / 15) * 280}
                      cy={280 - ((hoveredPoint.y + 7.5) / 15) * 280}
                      r="6"
                      fill="rgba(168, 85, 247, 0.5)"
                      stroke="#a855f7"
                      strokeWidth="2"
                    />
                  </>
                )}

                {/* Optimal point marker with label */}
                {showOptimalMarker && (
                  <g className="animate-pulse">
                    {/* Outer glow */}
                    <circle
                      cx={((optimalInSlice.x + 7.5) / 15) * 280}
                      cy={280 - ((optimalInSlice.y + 7.5) / 15) * 280}
                      r="12"
                      fill="rgba(34, 197, 94, 0.2)"
                    />
                    {/* Cross marker */}
                    <line
                      x1={((optimalInSlice.x + 7.5) / 15) * 280 - 8}
                      y1={280 - ((optimalInSlice.y + 7.5) / 15) * 280}
                      x2={((optimalInSlice.x + 7.5) / 15) * 280 + 8}
                      y2={280 - ((optimalInSlice.y + 7.5) / 15) * 280}
                      stroke="#22c55e"
                      strokeWidth="2"
                    />
                    <line
                      x1={((optimalInSlice.x + 7.5) / 15) * 280}
                      y1={280 - ((optimalInSlice.y + 7.5) / 15) * 280 - 8}
                      x2={((optimalInSlice.x + 7.5) / 15) * 280}
                      y2={280 - ((optimalInSlice.y + 7.5) / 15) * 280 + 8}
                      stroke="#22c55e"
                      strokeWidth="2"
                    />
                    {/* Label */}
                    <text
                      x={((optimalInSlice.x + 7.5) / 15) * 280 + 14}
                      y={280 - ((optimalInSlice.y + 7.5) / 15) * 280 - 6}
                      fill="#22c55e"
                      fontSize="10"
                      fontWeight="bold"
                    >
                      Optimal
                    </text>
                  </g>
                )}

                {/* Selected point marker with cross-hairs to axes */}
                {selectedPoint && (
                  <>
                    {/* Cross-hairs from selected to axes */}
                    <line
                      x1={((selectedPoint.x + 7.5) / 15) * 280}
                      y1="280"
                      x2={((selectedPoint.x + 7.5) / 15) * 280}
                      y2={280 - ((selectedPoint.y + 7.5) / 15) * 280}
                      stroke="#a855f7"
                      strokeWidth="1"
                      strokeDasharray="2,2"
                      opacity="0.5"
                    />
                    <line
                      x1="0"
                      y1={280 - ((selectedPoint.y + 7.5) / 15) * 280}
                      x2={((selectedPoint.x + 7.5) / 15) * 280}
                      y2={280 - ((selectedPoint.y + 7.5) / 15) * 280}
                      stroke="#a855f7"
                      strokeWidth="1"
                      strokeDasharray="2,2"
                      opacity="0.5"
                    />
                    {/* Connection line to optimal */}
                    <line
                      x1={((optimalInSlice.x + 7.5) / 15) * 280}
                      y1={280 - ((optimalInSlice.y + 7.5) / 15) * 280}
                      x2={((selectedPoint.x + 7.5) / 15) * 280}
                      y2={280 - ((selectedPoint.y + 7.5) / 15) * 280}
                      stroke="#a855f7"
                      strokeWidth="1.5"
                      strokeDasharray="4,4"
                      opacity="0.7"
                    />
                    {/* Selected marker with glow */}
                    <circle
                      cx={((selectedPoint.x + 7.5) / 15) * 280}
                      cy={280 - ((selectedPoint.y + 7.5) / 15) * 280}
                      r="10"
                      fill="rgba(168, 85, 247, 0.3)"
                    />
                    <circle
                      cx={((selectedPoint.x + 7.5) / 15) * 280}
                      cy={280 - ((selectedPoint.y + 7.5) / 15) * 280}
                      r="6"
                      fill="white"
                      stroke="#a855f7"
                      strokeWidth="2"
                    />
                    {/* Label */}
                    <text
                      x={((selectedPoint.x + 7.5) / 15) * 280 + 10}
                      y={280 - ((selectedPoint.y + 7.5) / 15) * 280 + 4}
                      fill="white"
                      fontSize="9"
                    >
                      Selected
                    </text>
                  </>
                )}

                {/* Gradient arrows (optional) */}
                {showGradients && energyData.filter((_, i) => i % 25 === 12).map((point, i) => {
                  const gradX = (optimalInSlice.x - point.x) * 2;
                  const gradY = (optimalInSlice.y - point.y) * 2;
                  const len = Math.sqrt(gradX * gradX + gradY * gradY);
                  if (len < 0.5) return null;
                  const normX = gradX / len * 8;
                  const normY = gradY / len * 8;
                  const px = ((point.x + 7.5) / 15) * 280;
                  const py = 280 - ((point.y + 7.5) / 15) * 280;
                  return (
                    <line
                      key={`grad-${i}`}
                      x1={px}
                      y1={py}
                      x2={px + normX}
                      y2={py - normY}
                      stroke="rgba(255,255,255,0.4)"
                      strokeWidth="1"
                      markerEnd="url(#arrowhead)"
                    />
                  );
                })}
              </svg>

              {/* Hover tooltip */}
              {hoveredPoint && (
                <div
                  className="absolute z-10 px-2 py-1 bg-zinc-950 text-xs text-white rounded shadow-lg pointer-events-none"
                  style={{
                    left: ((hoveredPoint.x + 7.5) / 15) * 280 + 10,
                    top: 280 - ((hoveredPoint.y + 7.5) / 15) * 280 - 30,
                  }}
                >
                  [{hoveredPoint.x.toFixed(1)}, {hoveredPoint.y.toFixed(1)}]
                  <br />
                  Energy: {hoveredPoint.energy.toFixed(2)}
                </div>
              )}
            </div>

            {/* X-axis label */}
            <div className="text-center text-xs text-zinc-500 font-medium mt-2">
              {axisLabels.x} (cm)
            </div>
          </div>

          {/* Color scale legend */}
          <div className="flex items-center justify-center gap-2 mt-4 mb-4">
            <span className="text-xs text-zinc-500">Low (Good)</span>
            <div className="w-32 h-3 rounded-full" style={{
              background: 'linear-gradient(to right, rgb(34, 197, 82), rgb(234, 179, 52), rgb(220, 38, 38))'
            }} />
            <span className="text-xs text-zinc-500">High (Bad)</span>
          </div>

          {/* Selected action info */}
          <div className="bg-zinc-800 rounded-lg p-3 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-zinc-400">Selected Action:</span>
              <span className="text-zinc-200 font-mono">
                {selectedPoint
                  ? `[${selectedPoint.x.toFixed(1)}, ${selectedPoint.y.toFixed(1)}, ${fixedValue.toFixed(1)}]`
                  : "Click to select"
                }
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-400">Predicted Energy:</span>
              <span className={`font-medium ${selectedPoint && selectedPoint.energy < 2 ? 'text-green-400' : selectedPoint && selectedPoint.energy < 4 ? 'text-yellow-400' : 'text-red-400'}`}>
                {selectedPoint ? selectedPoint.energy.toFixed(2) : "—"}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-400">Distance from Optimal:</span>
              <span className="text-zinc-200">
                {distanceFromOptimal ? `${distanceFromOptimal} cm` : "—"}
              </span>
            </div>
          </div>

          {/* Slice plane controls */}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="text-xs text-zinc-500">Slice Plane:</span>
            <div className="flex gap-1">
              {(["XY", "XZ", "YZ"] as const).map(plane => (
                <button
                  key={plane}
                  onClick={() => setSlicePlane(plane)}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    slicePlane === plane
                      ? "bg-indigo-600 text-white"
                      : "bg-zinc-700 text-zinc-400 hover:text-white"
                  }`}
                >
                  {plane}
                </button>
              ))}
            </div>

            <span className="text-xs text-zinc-500 ml-2">Fix {axisLabels.fixed} at:</span>
            <input
              type="range"
              min="-7.5"
              max="7.5"
              step="0.5"
              value={fixedValue}
              onChange={(e) => setFixedValue(Number(e.target.value))}
              className="w-20 h-1.5 bg-zinc-700 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-indigo-500 [&::-webkit-slider-thumb]:rounded-full"
            />
            <span className="text-xs text-zinc-300 font-mono w-12">{fixedValue.toFixed(1)}</span>
          </div>

          {/* Additional controls */}
          <div className="mt-3 flex flex-wrap gap-2">
            <div className="relative group">
              <button
                onClick={() => setShowGradients(!showGradients)}
                className={`px-3 py-1.5 text-xs rounded transition-colors flex items-center gap-1.5 ${
                  showGradients
                    ? "bg-indigo-600 text-white"
                    : "bg-zinc-700 text-zinc-400 hover:text-white"
                }`}
              >
                <span>↗</span>
                Gradient Vectors
              </button>
              <div className="absolute bottom-full left-0 mb-2 px-2 py-1 bg-zinc-950 text-xs text-zinc-300 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                Show arrows indicating direction of energy improvement
              </div>
            </div>
            <button
              onClick={() => setShowOptimalMarker(!showOptimalMarker)}
              className={`px-3 py-1.5 text-xs rounded transition-colors ${
                showOptimalMarker
                  ? "bg-green-600 text-white"
                  : "bg-zinc-700 text-zinc-400 hover:text-white"
              }`}
            >
              ⊕ Show Optimal
            </button>
            <button
              onClick={() => {
                setSelectedPoint(null);
                setFixedValue(optimalAction[2]);
              }}
              className="px-3 py-1.5 text-xs bg-zinc-700 text-zinc-400 hover:text-white rounded transition-colors"
            >
              Reset View
            </button>
            <button
              className="px-3 py-1.5 text-xs bg-zinc-700 text-zinc-400 hover:text-white rounded transition-colors"
            >
              Compare to Optimal
            </button>
          </div>
        </>
      ) : (
        /* 3D View Placeholder */
        <div className="h-[400px] flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" />
            </svg>
          </div>
          <p className="text-zinc-400 text-sm font-medium">3D View Coming Soon</p>
          <p className="text-zinc-600 text-xs mt-1 max-w-xs">
            Interactive 3D surface visualization with Three.js
          </p>
          <button
            onClick={() => setViewMode("2D")}
            className="mt-4 px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg text-xs transition-colors"
          >
            Switch to 2D View
          </button>
        </div>
      )}
    </div>
  );
}
