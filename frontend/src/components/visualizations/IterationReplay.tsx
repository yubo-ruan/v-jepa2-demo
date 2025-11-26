"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { PlayIcon, PauseIcon, StopIcon, ExportIcon, ChevronIcon } from "@/components/icons";
import { getProgressColorHex } from "@/utils/colors";
import { ITERATION_REPLAY } from "@/constants/visualization";
import { useExportAnimation, type ExportFormat } from "@/hooks";

interface IterationData {
  iteration: number;
  samples: { x: number; y: number; z: number; energy: number; isElite: boolean }[];
  mean: [number, number, number];
  stdDev: number;
  bestEnergy: number;
  eliteCount: number;
  totalSamples: number;
}

interface IterationReplayProps {
  iterations?: IterationData[];
  totalIterations?: number;
  totalSamples?: number;
  eliteFraction?: number;
  onIterationChange?: (iteration: number) => void;
}

// Generate mock iteration data for demo
function generateMockData(totalIterations: number, totalSamples: number, eliteFraction: number): IterationData[] {
  const data: IterationData[] = [];
  let mean: [number, number, number] = [0, 0, 0];
  let stdDev = 5;

  for (let iter = 0; iter < totalIterations; iter++) {
    const samples: IterationData["samples"] = [];
    const energies: number[] = [];

    // Generate samples from current distribution
    for (let i = 0; i < totalSamples; i++) {
      const x = mean[0] + (Math.random() - 0.5) * 2 * stdDev;
      const y = mean[1] + (Math.random() - 0.5) * 2 * stdDev;
      const z = mean[2] + (Math.random() - 0.5) * 2 * stdDev;

      // Energy is distance from optimal point [3, -1.5, 0.8] with some noise
      const optimal = [3, -1.5, 0.8];
      const energy = Math.sqrt(
        Math.pow(x - optimal[0], 2) +
        Math.pow(y - optimal[1], 2) +
        Math.pow(z - optimal[2], 2)
      ) + Math.random() * 0.5;

      samples.push({ x, y, z, energy, isElite: false });
      energies.push(energy);
    }

    // Sort by energy and mark elites
    const sortedIndices = energies
      .map((e, i) => ({ e, i }))
      .sort((a, b) => a.e - b.e)
      .map(item => item.i);

    const eliteCount = Math.floor(totalSamples * eliteFraction);
    const eliteIndices = new Set(sortedIndices.slice(0, eliteCount));

    samples.forEach((s, i) => {
      s.isElite = eliteIndices.has(i);
    });

    // Calculate new mean from elites
    const elites = samples.filter(s => s.isElite);
    const newMean: [number, number, number] = [
      elites.reduce((a, b) => a + b.x, 0) / elites.length,
      elites.reduce((a, b) => a + b.y, 0) / elites.length,
      elites.reduce((a, b) => a + b.z, 0) / elites.length,
    ];

    // Calculate new std dev (shrinking)
    const newStdDev = Math.sqrt(
      elites.reduce((a, b) => a + Math.pow(b.x - newMean[0], 2), 0) / elites.length
    ) * 0.9;

    data.push({
      iteration: iter + 1,
      samples,
      mean: newMean,
      stdDev: Math.max(newStdDev, 0.3),
      bestEnergy: Math.min(...energies),
      eliteCount,
      totalSamples,
    });

    // Update for next iteration
    mean = newMean;
    stdDev = Math.max(newStdDev, 0.3);
  }

  return data;
}

export function IterationReplay({
  iterations: providedIterations,
  totalIterations = 10,
  totalSamples = 400,
  eliteFraction = 0.1,
  onIterationChange,
}: IterationReplayProps) {
  const [currentIteration, setCurrentIteration] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isLooping, setIsLooping] = useState(false);
  const [hoveredIteration, setHoveredIteration] = useState<number | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Refs for SVG elements
  const distributionSvgRef = useRef<SVGSVGElement>(null);
  const energySvgRef = useRef<SVGSVGElement>(null);

  // Export animation hook
  const { exportAnimation, isExporting, exportProgress } = useExportAnimation();

  // Generate or use provided iteration data
  const iterations = useMemo(
    () => providedIterations || generateMockData(totalIterations, totalSamples, eliteFraction),
    [providedIterations, totalIterations, totalSamples, eliteFraction]
  );

  const currentData = iterations[currentIteration - 1];

  // Energy history for the line chart
  const energyHistory = useMemo(
    () => iterations.slice(0, currentIteration).map(d => d.bestEnergy),
    [iterations, currentIteration]
  );

  // Playback logic
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      setCurrentIteration(prev => {
        if (prev >= iterations.length) {
          if (isLooping) return 1;
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 1000 / playbackSpeed);

    return () => clearInterval(interval);
  }, [isPlaying, playbackSpeed, isLooping, iterations.length]);

  // Notify parent of iteration change
  useEffect(() => {
    onIterationChange?.(currentIteration);
  }, [currentIteration, onIterationChange]);

  const handlePlay = useCallback(() => {
    if (currentIteration >= iterations.length) {
      setCurrentIteration(1);
    }
    setIsPlaying(true);
  }, [currentIteration, iterations.length]);

  const handlePause = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const handleStop = useCallback(() => {
    setIsPlaying(false);
    setCurrentIteration(1);
  }, []);

  const handleSliderChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentIteration(Number(e.target.value));
    setIsPlaying(false);
  }, []);

  // Calculate scatter plot bounds
  const bounds = useMemo(() => {
    const allSamples = iterations.flatMap(d => d.samples);
    const xs = allSamples.map(s => s.x);
    const ys = allSamples.map(s => s.y);
    return {
      minX: Math.min(...xs),
      maxX: Math.max(...xs),
      minY: Math.min(...ys),
      maxY: Math.max(...ys),
    };
  }, [iterations]);

  // Map sample to SVG coordinates
  const mapToSvg = useCallback((x: number, y: number, width: number, height: number) => {
    const padding = 20;
    const svgX = padding + ((x - bounds.minX) / (bounds.maxX - bounds.minX)) * (width - 2 * padding);
    const svgY = padding + ((bounds.maxY - y) / (bounds.maxY - bounds.minY)) * (height - 2 * padding);
    return { x: svgX, y: svgY };
  }, [bounds]);

  // Energy chart bounds
  const maxEnergy = Math.max(...iterations.map(d => d.bestEnergy));
  const minEnergy = Math.min(...iterations.map(d => d.bestEnergy));

  // Render a single frame to canvas (for export)
  const renderFrameToCanvas = useCallback(
    async (frameIndex: number): Promise<HTMLCanvasElement> => {
      const width = 800;
      const height = 600;
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not get canvas context");

      // Background
      ctx.fillStyle = "#18181b";
      ctx.fillRect(0, 0, width, height);

      const frameData = iterations[frameIndex];
      const frameEnergyHistory = iterations.slice(0, frameIndex + 1).map(d => d.bestEnergy);
      const padding = 40;

      // Title
      ctx.fillStyle = "#d4d4d8";
      ctx.font = "bold 20px system-ui";
      ctx.fillText(`V-JEPA2 CEM Optimization - Iteration ${frameIndex + 1}/${iterations.length}`, padding, 30);

      // === LEFT SIDE: Sample Distribution ===
      const distX = padding;
      const distY = 60;
      const distW = 350;
      const distH = 350;

      // Distribution background
      ctx.fillStyle = "#27272a";
      ctx.fillRect(distX, distY, distW, distH);

      // Distribution title
      ctx.fillStyle = "#a1a1aa";
      ctx.font = "14px system-ui";
      ctx.fillText("Sample Distribution (X-Y plane)", distX, distY - 10);

      // Grid
      ctx.strokeStyle = "#3f3f46";
      ctx.lineWidth = 0.5;
      const gridSize = 35;
      for (let x = distX; x <= distX + distW; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, distY);
        ctx.lineTo(x, distY + distH);
        ctx.stroke();
      }
      for (let y = distY; y <= distY + distH; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(distX, y);
        ctx.lineTo(distX + distW, y);
        ctx.stroke();
      }

      // Map sample coordinates to canvas
      const mapSampleToCanvas = (x: number, y: number) => {
        const innerPadding = 20;
        const canvasX = distX + innerPadding + ((x - bounds.minX) / (bounds.maxX - bounds.minX)) * (distW - 2 * innerPadding);
        const canvasY = distY + innerPadding + ((bounds.maxY - y) / (bounds.maxY - bounds.minY)) * (distH - 2 * innerPadding);
        return { x: canvasX, y: canvasY };
      };

      // Draw samples
      frameData.samples.forEach((sample) => {
        const pos = mapSampleToCanvas(sample.x, sample.y);
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, sample.isElite ? 6 : 3, 0, Math.PI * 2);
        ctx.fillStyle = sample.isElite ? "#22c55e" : "rgba(99, 102, 241, 0.5)";
        ctx.fill();
      });

      // Draw mean
      const meanPos = mapSampleToCanvas(frameData.mean[0], frameData.mean[1]);
      ctx.beginPath();
      ctx.arc(meanPos.x, meanPos.y, 10, 0, Math.PI * 2);
      ctx.strokeStyle = "#f59e0b";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(meanPos.x, meanPos.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = "#f59e0b";
      ctx.fill();

      // Legend
      ctx.fillStyle = "#71717a";
      ctx.font = "12px system-ui";
      const legendY = distY + distH + 25;
      ctx.beginPath();
      ctx.arc(distX + 10, legendY, 4, 0, Math.PI * 2);
      ctx.fillStyle = "#6366f1";
      ctx.fill();
      ctx.fillStyle = "#71717a";
      ctx.fillText("Samples", distX + 20, legendY + 4);

      ctx.beginPath();
      ctx.arc(distX + 100, legendY, 4, 0, Math.PI * 2);
      ctx.fillStyle = "#22c55e";
      ctx.fill();
      ctx.fillStyle = "#71717a";
      ctx.fillText("Elites", distX + 110, legendY + 4);

      ctx.beginPath();
      ctx.arc(distX + 180, legendY, 6, 0, Math.PI * 2);
      ctx.strokeStyle = "#f59e0b";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = "#71717a";
      ctx.fillText("Mean", distX + 195, legendY + 4);

      // === RIGHT SIDE: Energy Chart ===
      const chartX = 420;
      const chartY = 60;
      const chartW = 340;
      const chartH = 200;

      // Chart background
      ctx.fillStyle = "#27272a";
      ctx.fillRect(chartX, chartY, chartW, chartH);

      // Chart title
      ctx.fillStyle = "#a1a1aa";
      ctx.font = "14px system-ui";
      ctx.fillText("Energy Evolution", chartX, chartY - 10);

      // Axes
      ctx.strokeStyle = "#52525b";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(chartX + 30, chartY);
      ctx.lineTo(chartX + 30, chartY + chartH - 20);
      ctx.lineTo(chartX + chartW, chartY + chartH - 20);
      ctx.stroke();

      // Y-axis labels
      ctx.fillStyle = "#71717a";
      ctx.font = "10px system-ui";
      ctx.fillText(maxEnergy.toFixed(1), chartX + 2, chartY + 15);
      ctx.fillText(minEnergy.toFixed(1), chartX + 2, chartY + chartH - 25);

      // X-axis labels
      ctx.fillText("1", chartX + 30, chartY + chartH - 5);
      ctx.fillText(String(iterations.length), chartX + chartW - 15, chartY + chartH - 5);

      // Draw energy line
      const innerChartW = chartW - 40;
      const innerChartH = chartH - 40;
      const chartInnerX = chartX + 35;
      const chartInnerY = chartY + 10;

      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";

      for (let i = 1; i < frameEnergyHistory.length; i++) {
        const x1 = chartInnerX + ((i - 1) / (iterations.length - 1)) * innerChartW;
        const y1 = chartInnerY + ((maxEnergy - frameEnergyHistory[i - 1]) / (maxEnergy - minEnergy)) * innerChartH;
        const x2 = chartInnerX + (i / (iterations.length - 1)) * innerChartW;
        const y2 = chartInnerY + ((maxEnergy - frameEnergyHistory[i]) / (maxEnergy - minEnergy)) * innerChartH;

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = getProgressColorHex(i / (iterations.length - 1));
        ctx.stroke();
      }

      // Draw points
      for (let i = 0; i < frameEnergyHistory.length; i++) {
        const x = chartInnerX + (i / (iterations.length - 1)) * innerChartW;
        const y = chartInnerY + ((maxEnergy - frameEnergyHistory[i]) / (maxEnergy - minEnergy)) * innerChartH;

        ctx.beginPath();
        ctx.arc(x, y, i === frameIndex ? 6 : 4, 0, Math.PI * 2);
        ctx.fillStyle = getProgressColorHex(i / (iterations.length - 1));
        ctx.fill();

        if (i === frameIndex) {
          ctx.strokeStyle = "#fff";
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }

      // === STATS SECTION ===
      const statsY = 290;
      ctx.fillStyle = "#27272a";
      ctx.fillRect(chartX, statsY, chartW, 120);

      ctx.fillStyle = "#a1a1aa";
      ctx.font = "14px system-ui";
      ctx.fillText("Current State", chartX + 10, statsY + 20);

      ctx.font = "12px system-ui";
      ctx.fillStyle = "#71717a";
      ctx.fillText("Mean Action:", chartX + 10, statsY + 45);
      ctx.fillStyle = "#d4d4d8";
      ctx.font = "12px monospace";
      ctx.fillText(`[${frameData.mean.map(v => v.toFixed(2)).join(", ")}]`, chartX + 100, statsY + 45);

      ctx.font = "12px system-ui";
      ctx.fillStyle = "#71717a";
      ctx.fillText("Std Dev:", chartX + 10, statsY + 65);
      ctx.fillStyle = "#d4d4d8";
      ctx.font = "12px monospace";
      ctx.fillText(frameData.stdDev.toFixed(3), chartX + 100, statsY + 65);

      ctx.font = "12px system-ui";
      ctx.fillStyle = "#71717a";
      ctx.fillText("Best Energy:", chartX + 10, statsY + 85);
      ctx.fillStyle = "#22c55e";
      ctx.font = "12px monospace";
      ctx.fillText(frameData.bestEnergy.toFixed(3), chartX + 100, statsY + 85);

      ctx.font = "12px system-ui";
      ctx.fillStyle = "#71717a";
      ctx.fillText("Elite Count:", chartX + 10, statsY + 105);
      ctx.fillStyle = "#d4d4d8";
      ctx.font = "12px monospace";
      ctx.fillText(`${frameData.eliteCount} / ${frameData.totalSamples}`, chartX + 100, statsY + 105);

      // Footer
      ctx.fillStyle = "#52525b";
      ctx.font = "11px system-ui";
      ctx.fillText("V-JEPA2 Demo - CEM Optimization Visualization", padding, height - 15);

      return canvas;
    },
    [iterations, bounds, maxEnergy, minEnergy]
  );

  // Export handler
  const handleExport = useCallback(
    async (format: ExportFormat) => {
      setShowExportMenu(false);
      setIsPlaying(false);

      try {
        await exportAnimation(
          renderFrameToCanvas,
          iterations.length,
          format,
          {
            filename: `vjepa2-cem-animation`,
            width: 800,
            height: 600,
            fps: 2,
            quality: 10,
          }
        );
      } catch (error) {
        console.error("Export failed:", error);
        alert(`Export failed: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    },
    [exportAnimation, renderFrameToCanvas, iterations.length]
  );

  return (
    <div className="bg-zinc-800 rounded-xl border border-zinc-700 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-zinc-300">Iteration Replay</h3>
        <div className="flex gap-2">
          {!isPlaying ? (
            <button
              onClick={handlePlay}
              className="p-2 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors"
              title="Play"
            >
              <PlayIcon />
            </button>
          ) : (
            <button
              onClick={handlePause}
              className="p-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition-colors"
              title="Pause"
            >
              <PauseIcon />
            </button>
          )}
          <button
            onClick={handleStop}
            className="p-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors"
            title="Stop"
          >
            <StopIcon />
          </button>
        </div>
      </div>

      {/* Timeline Slider */}
      <div className="mb-6">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-zinc-400">Iteration</span>
          <span className="text-zinc-200 font-medium">{currentIteration} / {iterations.length}</span>
        </div>
        <input
          type="range"
          min="1"
          max={iterations.length}
          value={currentIteration}
          onChange={handleSliderChange}
          className="w-full h-2 bg-zinc-700 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-indigo-500 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-lg"
        />
        {/* Iteration markers - interactive */}
        <div className="flex justify-between mt-1">
          {iterations.map((iterData, i) => (
            <div key={i} className="relative group">
              <button
                onClick={() => {
                  setCurrentIteration(i + 1);
                  setIsPlaying(false);
                }}
                onMouseEnter={() => setHoveredIteration(i + 1)}
                onMouseLeave={() => setHoveredIteration(null)}
                className={`w-2.5 h-2.5 rounded-full transition-all cursor-pointer hover:scale-150 ${
                  i + 1 <= currentIteration ? "bg-indigo-500" : "bg-zinc-600 hover:bg-zinc-500"
                } ${i + 1 === currentIteration ? "ring-2 ring-indigo-400 ring-offset-1 ring-offset-zinc-800" : ""}`}
              />
              {/* Tooltip on hover */}
              {hoveredIteration === i + 1 && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-zinc-700 text-xs text-zinc-200 rounded whitespace-nowrap z-10 pointer-events-none">
                  <div className="font-medium">Iter {i + 1}</div>
                  <div className="text-zinc-400">Energy: {iterData.bestEnergy.toFixed(2)}</div>
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-zinc-700" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Visualizations Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Sample Distribution (2D projection) */}
        <div className="bg-zinc-900 rounded-lg p-4">
          <h4 className="text-sm font-medium text-zinc-400 mb-3">Sample Distribution (X-Y plane)</h4>
          <svg viewBox="0 0 200 200" className="w-full h-48">
            {/* Grid */}
            <defs>
              <pattern id="grid-pattern" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#3f3f46" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="200" height="200" fill="url(#grid-pattern)" />

            {/* Samples */}
            {currentData?.samples.map((sample, i) => {
              const pos = mapToSvg(sample.x, sample.y, 200, 200);
              return (
                <circle
                  key={i}
                  cx={pos.x}
                  cy={pos.y}
                  r={sample.isElite ? 4 : 2}
                  fill={sample.isElite ? "#22c55e" : "#6366f1"}
                  opacity={sample.isElite ? 1 : 0.4}
                  className="transition-all duration-300"
                />
              );
            })}

            {/* Mean marker */}
            {currentData && (
              <g>
                <circle
                  cx={mapToSvg(currentData.mean[0], currentData.mean[1], 200, 200).x}
                  cy={mapToSvg(currentData.mean[0], currentData.mean[1], 200, 200).y}
                  r={6}
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth={2}
                />
                <circle
                  cx={mapToSvg(currentData.mean[0], currentData.mean[1], 200, 200).x}
                  cy={mapToSvg(currentData.mean[0], currentData.mean[1], 200, 200).y}
                  r={2}
                  fill="#f59e0b"
                />
              </g>
            )}

            {/* Optimal marker */}
            <g>
              <circle
                cx={mapToSvg(3, -1.5, 200, 200).x}
                cy={mapToSvg(3, -1.5, 200, 200).y}
                r={6}
                fill="none"
                stroke="#10b981"
                strokeWidth={2}
                strokeDasharray="4,2"
              />
            </g>
          </svg>
          <div className="flex justify-center gap-4 mt-2 text-xs">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-indigo-500" /> Samples
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500" /> Elites
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full border-2 border-amber-500" /> Mean
            </span>
          </div>
        </div>

        {/* Energy Evolution */}
        <div className="bg-zinc-900 rounded-lg p-4">
          <h4 className="text-sm font-medium text-zinc-400 mb-3">Energy Evolution</h4>
          <svg viewBox="0 0 200 160" className="w-full h-48">
            {/* Grid */}
            <defs>
              {/* Background gradient (subtle) */}
              <linearGradient id="energy-bg-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#ef4444" stopOpacity="0.1" />
                <stop offset="50%" stopColor="#eab308" stopOpacity="0.1" />
                <stop offset="100%" stopColor="#22c55e" stopOpacity="0.1" />
              </linearGradient>
              {/* Line gradient (red → yellow → green) based on iteration progress */}
              <linearGradient id="energy-line-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#ef4444" />
                <stop offset="40%" stopColor="#f97316" />
                <stop offset="60%" stopColor="#eab308" />
                <stop offset="80%" stopColor="#84cc16" />
                <stop offset="100%" stopColor="#22c55e" />
              </linearGradient>
              {/* Glow filter for the line */}
              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>
            <rect x="30" y="10" width="160" height="120" fill="url(#energy-bg-gradient)" />

            {/* Y-axis */}
            <line x1="30" y1="10" x2="30" y2="130" stroke="#52525b" strokeWidth="1" />
            <text x="5" y="15" fill="#71717a" fontSize="8">{maxEnergy.toFixed(1)}</text>
            <text x="5" y="130" fill="#71717a" fontSize="8">{minEnergy.toFixed(1)}</text>

            {/* X-axis */}
            <line x1="30" y1="130" x2="190" y2="130" stroke="#52525b" strokeWidth="1" />
            <text x="30" y="145" fill="#71717a" fontSize="8">1</text>
            <text x="180" y="145" fill="#71717a" fontSize="8">{iterations.length}</text>
            <text x="100" y="155" fill="#71717a" fontSize="8">Iteration</text>

            {/* Energy line segments with individual colors */}
            {energyHistory.map((energy, i) => {
              if (i === 0) return null;
              const x1 = ITERATION_REPLAY.PADDING_LEFT + ((i - 1) / (iterations.length - 1)) * ITERATION_REPLAY.CHART_WIDTH;
              const y1 = ITERATION_REPLAY.PADDING_TOP + ((maxEnergy - energyHistory[i - 1]) / (maxEnergy - minEnergy)) * ITERATION_REPLAY.CHART_HEIGHT;
              const x2 = ITERATION_REPLAY.PADDING_LEFT + (i / (iterations.length - 1)) * ITERATION_REPLAY.CHART_WIDTH;
              const y2 = ITERATION_REPLAY.PADDING_TOP + ((maxEnergy - energy) / (maxEnergy - minEnergy)) * ITERATION_REPLAY.CHART_HEIGHT;
              const progress = i / (iterations.length - 1);

              return (
                <line
                  key={i}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={getProgressColorHex(progress)}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  filter="url(#glow)"
                />
              );
            })}

            {/* Data points */}
            {energyHistory.map((energy, i) => {
              const x = ITERATION_REPLAY.PADDING_LEFT + (i / (iterations.length - 1)) * ITERATION_REPLAY.CHART_WIDTH;
              const y = ITERATION_REPLAY.PADDING_TOP + ((maxEnergy - energy) / (maxEnergy - minEnergy)) * ITERATION_REPLAY.CHART_HEIGHT;
              const progress = i / (iterations.length - 1);
              const isActive = i + 1 === currentIteration;

              return (
                <circle
                  key={i}
                  cx={x}
                  cy={y}
                  r={isActive ? ITERATION_REPLAY.ACTIVE_DOT_RADIUS : ITERATION_REPLAY.DOT_RADIUS}
                  fill={getProgressColorHex(progress)}
                  stroke={isActive ? "#fff" : "none"}
                  strokeWidth={isActive ? 2 : 0}
                  className="transition-all duration-200"
                />
              );
            })}
          </svg>
        </div>
      </div>

      {/* Current State Stats */}
      <div className="bg-zinc-900 rounded-lg p-4 mb-6">
        <h4 className="text-sm font-medium text-zinc-400 mb-3">Current State</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-zinc-500">Mean Action</p>
            <p className="text-sm font-mono text-zinc-200">
              [{currentData?.mean.map(v => v.toFixed(1)).join(", ")}]
            </p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">Std Dev</p>
            <p className="text-sm font-mono text-zinc-200 flex items-center gap-1">
              {currentData?.stdDev.toFixed(2)}
              {currentIteration > 1 && currentData?.stdDev < iterations[currentIteration - 2]?.stdDev && (
                <span className="text-green-400 text-xs">↓ shrinking</span>
              )}
            </p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">Best Energy</p>
            <p className="text-sm font-mono text-green-400">{currentData?.bestEnergy.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">Elite Count</p>
            <p className="text-sm font-mono text-zinc-200">
              {currentData?.eliteCount} / {currentData?.totalSamples}
            </p>
          </div>
        </div>
      </div>

      {/* Playback Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-zinc-400">Speed:</span>
          {[0.5, 1, 2].map(speed => (
            <button
              key={speed}
              onClick={() => setPlaybackSpeed(speed)}
              className={`px-3 py-1.5 rounded text-sm transition-colors ${
                playbackSpeed === speed
                  ? "bg-indigo-600 text-white"
                  : "bg-zinc-700 text-zinc-300 hover:bg-zinc-600"
              }`}
            >
              {speed}x
            </button>
          ))}
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isLooping}
            onChange={(e) => setIsLooping(e.target.checked)}
            className="w-4 h-4 rounded bg-zinc-700 border-zinc-600 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-0"
          />
          <span className="text-sm text-zinc-300">Loop</span>
        </label>

        <div className="flex gap-2 relative">
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            disabled={isExporting}
            className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors text-sm flex items-center gap-2"
          >
            <ExportIcon />
            {isExporting ? (
              <>
                Exporting... {exportProgress?.progress ?? 0}%
              </>
            ) : (
              <>
                Export Animation
                <ChevronIcon className={`w-3 h-3 transition-transform ${showExportMenu ? "rotate-180" : ""}`} />
              </>
            )}
          </button>
          {/* Export format dropdown */}
          {showExportMenu && !isExporting && (
            <div className="absolute bottom-full right-0 mb-2 bg-zinc-700 rounded-lg shadow-xl border border-zinc-600 overflow-hidden z-20">
              <button
                onClick={() => handleExport("gif")}
                className="w-full px-4 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-600 flex items-center gap-2"
              >
                <span className="w-4 text-center">🎞️</span>
                GIF <span className="text-zinc-400 text-xs ml-auto">web-friendly</span>
              </button>
              <button
                onClick={() => handleExport("webm")}
                className="w-full px-4 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-600 flex items-center gap-2"
              >
                <span className="w-4 text-center">🎬</span>
                WebM <span className="text-zinc-400 text-xs ml-auto">video</span>
              </button>
              <button
                onClick={() => handleExport("png-sequence")}
                className="w-full px-4 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-600 flex items-center gap-2"
              >
                <span className="w-4 text-center">📁</span>
                PNG Sequence <span className="text-zinc-400 text-xs ml-auto">zip</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
