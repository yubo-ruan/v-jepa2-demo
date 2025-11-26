"use client";

import { useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import type { PlotMouseEvent, Data, Layout, ColorScale } from "plotly.js";
import { createEnergyColorPalette } from "@/utils/colors";

// Dynamically import Plotly to avoid SSR issues
const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

interface EnergyLandscape3DProps {
  energyData: { x: number; y: number; energy: number }[];
  optimalAction: [number, number, number];
  slicePlane: "XY" | "XZ" | "YZ";
  resolution: number;
  onPointClick?: (point: { x: number; y: number; energy: number }) => void;
}

// Flattened grid -> structured arrays Plotly expects
function buildGrid(
  energyData: { x: number; y: number; energy: number }[],
  resolution: number
) {
  const gridSize = resolution + 1;
  const xs = Array.from(new Set(energyData.map(p => p.x))).sort((a, b) => a - b);
  const ys = Array.from(new Set(energyData.map(p => p.y))).sort((a, b) => a - b);

  // Fallback in case data is empty or malformed
  if (xs.length !== gridSize || ys.length !== gridSize) {
    return { xs: [], ys: [], zs: [] };
  }

  const zs: (number | null)[][] = ys.map(() => xs.map(() => null));

  for (const point of energyData) {
    const yi = ys.indexOf(point.y);
    const xi = xs.indexOf(point.x);
    if (yi >= 0 && xi >= 0) {
      zs[yi][xi] = point.energy;
    }
  }

  return { xs, ys, zs };
}

export function EnergyLandscape3D({
  energyData,
  optimalAction,
  slicePlane,
  resolution,
  onPointClick
}: EnergyLandscape3DProps) {
  if (energyData.length === 0) {
    return (
      <div className="h-[500px] flex flex-col items-center justify-center bg-zinc-800 rounded-lg text-center p-6">
        <div className="w-16 h-16 rounded-full bg-zinc-700 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        </div>
        <p className="text-zinc-400 font-medium mb-2">No energy data available</p>
        <p className="text-zinc-600 text-sm max-w-sm">
          Upload current and goal images, then click &quot;Generate Plan&quot; to visualize the 3D energy landscape.
        </p>
      </div>
    );
  }

  const { minEnergy, maxEnergy } = useMemo(() => {
    const energies = energyData.map(d => d.energy);
    return { minEnergy: Math.min(...energies), maxEnergy: Math.max(...energies) };
  }, [energyData]);

  const colorPalette = useMemo(
    () => createEnergyColorPalette(minEnergy, maxEnergy),
    [minEnergy, maxEnergy]
  );
  const paletteValues = useMemo(() => Array.from(colorPalette.values()), [colorPalette]);

  const { xs, ys, zs } = useMemo(() => buildGrid(energyData, resolution), [energyData, resolution]);

  const axesLabels = useMemo(() => {
    if (slicePlane === "XY") return { x: "ΔX (cm)", y: "ΔY (cm)" };
    if (slicePlane === "XZ") return { x: "ΔX (cm)", y: "ΔZ (cm)" };
    return { x: "ΔY (cm)", y: "ΔZ (cm)" };
  }, [slicePlane]);

  const optimalPoint = useMemo(() => {
    if (slicePlane === "XY") return { x: optimalAction[0], y: optimalAction[1] };
    if (slicePlane === "XZ") return { x: optimalAction[0], y: optimalAction[2] };
    return { x: optimalAction[1], y: optimalAction[2] };
  }, [optimalAction, slicePlane]);

  const handleClick = useCallback((event: Readonly<PlotMouseEvent>) => {
    if (!onPointClick || !event.points?.length) return;
    const pt = event.points[0];
    const x = typeof pt.x === "number" ? pt.x : 0;
    const y = typeof pt.y === "number" ? pt.y : 0;
    const z = typeof (pt as any).z === "number" ? (pt as any).z : 0;
    onPointClick({ x, y, energy: z });
  }, [onPointClick]);

  // Plotly expects colorscale as [stop, color]
  const plotlyColorscale: ColorScale = useMemo(() => {
    if (paletteValues.length === 0) {
      return [
        [0, "#22c55e"],
        [0.5, "#eab308"],
        [1, "#ef4444"]
      ] as ColorScale;
    }
    const mid = paletteValues[Math.floor(paletteValues.length / 2)];
    return [
      [0, paletteValues[0]],
      [0.5, mid],
      [1, paletteValues[paletteValues.length - 1]],
    ] as ColorScale;
  }, [paletteValues]);

  const surfaceTrace: Partial<Data> = {
    type: "surface",
    x: xs,
    y: ys,
    z: zs,
    colorscale: plotlyColorscale,
    cmin: minEnergy,
    cmax: maxEnergy,
    showscale: false,
    opacity: 0.95,
    contours: {
      z: { show: true, usecolormap: true, highlightwidth: 1, project: { z: true } },
    } as any,
  };

  const optimalTrace: Partial<Data> = {
    type: "scatter3d",
    mode: "markers+text",
    x: [optimalPoint.x],
    y: [optimalPoint.y],
    z: [minEnergy],
    marker: { color: "#22c55e", size: 6, symbol: "cross" },
    text: ["Optimal"],
    textposition: "top center",
    hoverinfo: "skip",
    showlegend: false,
  };

  const layout: Partial<Layout> = {
    autosize: true,
    height: 500,
    margin: { l: 0, r: 0, b: 0, t: 20 },
    paper_bgcolor: "#0f172a",
    plot_bgcolor: "#0f172a",
    scene: {
      xaxis: {
        title: axesLabels.x,
        backgroundcolor: "#0f172a",
        gridcolor: "#1f2937",
        zerolinecolor: "#1f2937",
        color: "#9ca3af",
      },
      yaxis: {
        title: axesLabels.y,
        backgroundcolor: "#0f172a",
        gridcolor: "#1f2937",
        zerolinecolor: "#1f2937",
        color: "#9ca3af",
      },
      zaxis: {
        title: "Energy",
        backgroundcolor: "#0f172a",
        gridcolor: "#1f2937",
        zerolinecolor: "#1f2937",
        color: "#9ca3af",
      },
      camera: {
        eye: { x: 1.3, y: -1.2, z: 1.1 },
      },
      aspectratio: { x: 1, y: 1, z: 0.6 },
    },
  };

  return (
    <Plot
      data={[surfaceTrace, optimalTrace]}
      layout={layout}
      style={{ width: "100%", height: "100%" }}
      useResizeHandler
      onClick={handleClick}
      config={{
        displaylogo: false,
        responsive: true,
        modeBarButtonsToRemove: ["select2d", "lasso2d"],
      }}
      className="bg-zinc-900 rounded-lg"
    />
  );
}
