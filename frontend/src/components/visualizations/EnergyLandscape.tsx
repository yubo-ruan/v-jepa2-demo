"use client";

import { useState, useMemo, useCallback, useEffect, lazy, Suspense } from "react";
import { createEnergyColorPalette } from "@/utils/colors";
import { ENERGY_LANDSCAPE } from "@/constants/visualization";
import api from "@/lib/api";

// Lazy load 3D component to avoid SSR issues with Three.js
const EnergyLandscape3D = lazy(() =>
  import("./EnergyLandscape3D").then(mod => ({ default: mod.EnergyLandscape3D }))
);

interface EnergyLandscapeProps {
  optimalAction: [number, number, number];
  currentImage?: string; // Base64 or upload_id
  goalImage?: string; // Base64 or upload_id
  modelId?: string;
  onActionSelect?: (action: [number, number, number], energy: number) => void;
}

export function EnergyLandscape({
  optimalAction,
  currentImage,
  goalImage,
  modelId = "vit-giant",
  onActionSelect
}: EnergyLandscapeProps) {
  const [slicePlane, setSlicePlane] = useState<"XY" | "XZ" | "YZ">("XY");
  const [fixedValue, setFixedValue] = useState(optimalAction[2]);
  const [selectedPoint, setSelectedPoint] = useState<{ x: number; y: number; energy: number } | null>(null);
  const [energyData, setEnergyData] = useState<{ x: number; y: number; energy: number }[]>([]);
  const [isLoadingEnergy, setIsLoadingEnergy] = useState(false);

  // Use constants for layout
  const { RESOLUTION, ACTION_BOUNDS } = ENERGY_LANDSCAPE;

  // Fetch real energy data from API based on slice + slider value
  useEffect(() => {
    const fetchEnergyData = async () => {
      if (!currentImage || !goalImage) {
        setEnergyData([]);
        return;
      }

      setIsLoadingEnergy(true);
      try {
        const actions: number[][] = [];
        const range = ACTION_BOUNDS;
        const step = (range * 2) / RESOLUTION;

        for (let i = 0; i <= RESOLUTION; i++) {
          for (let j = 0; j <= RESOLUTION; j++) {
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

            actions.push(action);
          }
        }

        const response = await api.evaluateActions({
          currentImage,
          goalImage,
          actions,
          model: modelId,
        });

        const data: { x: number; y: number; energy: number }[] = [];
        let idx = 0;
        for (let i = 0; i <= RESOLUTION; i++) {
          for (let j = 0; j <= RESOLUTION; j++) {
            const coord1 = -range + i * step;
            const coord2 = -range + j * step;
            const actionEnergy = response.energies[idx];
            data.push({ x: coord1, y: coord2, energy: actionEnergy.energy });
            idx++;
          }
        }

        setEnergyData(data);
      } catch (error) {
        console.error("[EnergyLandscape] Failed to fetch energy data:", error);
        setEnergyData([]);
      } finally {
        setIsLoadingEnergy(false);
      }
    };

    fetchEnergyData();
  }, [currentImage, goalImage, slicePlane, fixedValue, RESOLUTION, modelId, ACTION_BOUNDS]);

  // Calculate min/max for color scaling
  const { minEnergy, maxEnergy } = useMemo(() => {
    if (energyData.length === 0) {
      return { minEnergy: 0, maxEnergy: 1 };
    }
    const energies = energyData.map(d => d.energy);
    return {
      minEnergy: Math.min(...energies),
      maxEnergy: Math.max(...energies)
    };
  }, [energyData]);

  // Pre-compute color palette for legend
  const colorPalette = useMemo(
    () => createEnergyColorPalette(minEnergy, maxEnergy),
    [minEnergy, maxEnergy]
  );

  const paletteValues = useMemo(() => Array.from(colorPalette.values()), [colorPalette]);

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

  // Handle click on the 3D surface
  const handlePointSelect = useCallback((point: { x: number; y: number; energy: number }) => {
    setSelectedPoint(point);

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

  // Calculate distance from selected point to optimal within the slice
  const distanceFromOptimal = useMemo(() => {
    if (!selectedPoint) return null;
    return Math.sqrt(
      Math.pow(selectedPoint.x - optimalInSlice.x, 2) +
      Math.pow(selectedPoint.y - optimalInSlice.y, 2)
    ).toFixed(2);
  }, [selectedPoint, optimalInSlice]);

  const axisLabels = useMemo(() => {
    if (slicePlane === "XY") return { x: "X", y: "Y", fixed: "Z" };
    if (slicePlane === "XZ") return { x: "X", y: "Z", fixed: "Y" };
    return { x: "Y", y: "Z", fixed: "X" };
  }, [slicePlane]);

  const legendGradient = useMemo(() => {
    if (paletteValues.length === 0) {
      return "linear-gradient(to right, #22c55e, #eab308, #ef4444)";
    }
    const midColor = paletteValues[Math.floor(paletteValues.length / 2)];
    return `linear-gradient(to right, ${paletteValues[0]}, ${midColor}, ${paletteValues[paletteValues.length - 1]})`;
  }, [paletteValues]);

  return (
    <div className="bg-zinc-900 rounded-xl border border-zinc-700 p-3 sm:p-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
        <div>
          <h4 className="text-sm font-semibold text-zinc-300">Energy Landscape</h4>
          {isLoadingEnergy && (
            <p className="text-xs text-blue-400 mt-1 flex items-center gap-1">
              <span className="animate-pulse">●</span>
              <span>Loading real model predictions...</span>
            </p>
          )}
          {!isLoadingEnergy && energyData.length > 0 && (
            <p className="text-xs text-green-400 mt-1 flex items-center gap-1">
              <span>✓</span>
              <span>Real V-JEPA2 energy predictions</span>
            </p>
          )}
          {!isLoadingEnergy && energyData.length === 0 && (
            <p className="text-xs text-zinc-500 mt-1 flex items-center gap-1">
              <span>○</span>
              <span>No data - upload images to visualize</span>
            </p>
          )}
        </div>

        {/* Slice plane controls */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-zinc-500">Slice Plane:</span>
          <div className="flex gap-1">
            {(["XY", "XZ", "YZ"] as const).map(plane => (
              <button
                key={plane}
                onClick={() => {
                  setSlicePlane(plane);
                  setSelectedPoint(null);
                }}
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
        </div>
      </div>

      {/* 3D View */}
      <div>
        <Suspense
          fallback={
            <div className="h-[500px] flex flex-col items-center justify-center text-center bg-zinc-800 rounded-lg">
              <div className="w-16 h-16 rounded-full bg-zinc-700 flex items-center justify-center mb-4 animate-pulse">
                <svg className="w-8 h-8 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" />
                </svg>
              </div>
              <p className="text-zinc-400 text-sm">Loading 3D view...</p>
            </div>
          }
        >
          <EnergyLandscape3D
            energyData={energyData}
            optimalAction={optimalAction}
            slicePlane={slicePlane}
            resolution={RESOLUTION}
            onPointClick={handlePointSelect}
          />
        </Suspense>

        {/* Legend */}
        <div className="flex items-center justify-center gap-2 mt-4 mb-2">
          <span className="text-xs text-zinc-500">Low (Good)</span>
          <div className="w-36 h-3 rounded-full" style={{ background: legendGradient }} />
          <span className="text-xs text-zinc-500">High (Bad)</span>
        </div>

        {/* Slider */}
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-zinc-500">Fix {axisLabels.fixed} at:</span>
            <input
              type="range"
              min={-ACTION_BOUNDS}
              max={ACTION_BOUNDS}
              step="0.5"
              value={fixedValue}
              onChange={(e) => {
                setFixedValue(Number(e.target.value));
                setSelectedPoint(null);
              }}
              className="flex-1 min-w-[80px] max-w-[140px] h-1.5 bg-zinc-700 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-indigo-500 [&::-webkit-slider-thumb]:rounded-full"
            />
            <span className="text-xs text-zinc-300 font-mono w-12">{fixedValue.toFixed(1)}</span>
          </div>
        </div>

        {/* Selected action info */}
        <div className="mt-4 bg-zinc-800 rounded-lg p-3 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-zinc-400">Selected Action:</span>
            <span className="text-zinc-200 font-mono">
              {selectedPoint
                ? `[${selectedPoint.x.toFixed(1)}, ${selectedPoint.y.toFixed(1)}, ${fixedValue.toFixed(1)}]`
                : "Click on the surface"}
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
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              onClick={() => {
                setSelectedPoint(null);
                setFixedValue(optimalAction[2]);
              }}
              className="px-3 py-1.5 text-xs bg-zinc-700 text-zinc-200 hover:text-white rounded transition-colors"
            >
              Reset View
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
