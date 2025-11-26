"use client";

import { useState, useMemo, useCallback } from "react";
import {
  EyeIcon,
  ExportIcon,
  CompareIcon,
  TrashIcon,
  ChartIcon,
  ChevronIcon,
  SearchIcon,
  StarIcon,
  PlayIcon,
  ResultsIcon,
} from "@/components/icons";
import { styles } from "@/components/ui";
import { useHistory } from "@/contexts";

interface HistoryPageProps {
  onGoToUpload: () => void;
}

export function HistoryPage({ onGoToUpload }: HistoryPageProps) {
  const { experiments, toggleFavorite, removeExperiment, clearAll } = useHistory();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterOption, setFilterOption] = useState("all");
  const [sortOption, setSortOption] = useState("recent");
  const [showStats, setShowStats] = useState(false);
  const [selectedExperiments, setSelectedExperiments] = useState<string[]>([]);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [detailsModalId, setDetailsModalId] = useState<string | null>(null);
  const [replayModalId, setReplayModalId] = useState<string | null>(null);

  // Convert timestamp to formatted date string
  const formatDate = useCallback((timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString() + " " + date.toLocaleTimeString();
  }, []);

  // Convert confidence from 0-1 range to 0-100 percentage
  const toPercentage = useCallback((confidence: number) => {
    return Math.round(confidence * 100);
  }, []);

  // Get image URL - handle both blob URLs and upload IDs
  const getImageUrl = useCallback((imageRef: string) => {
    // If it's already a blob URL or data URL, return as-is
    if (imageRef.startsWith("blob:") || imageRef.startsWith("data:")) {
      return imageRef;
    }
    // Otherwise, it's an upload ID - construct API URL
    // Use the same API base as the api client
    if (typeof window !== "undefined") {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";
      return `${apiBase}/upload/${imageRef}`;
    }
    return imageRef;
  }, []);

  // Filter and sort experiments (memoized for performance)
  const filteredExperiments = useMemo(() =>
    experiments
      .filter((exp) => {
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          return (
            exp.title.toLowerCase().includes(query) ||
            exp.model.toLowerCase().includes(query)
          );
        }
        const confidencePercent = toPercentage(exp.confidence);
        if (filterOption === "high") return confidencePercent >= 80;
        if (filterOption === "medium") return confidencePercent >= 50 && confidencePercent < 80;
        if (filterOption === "low") return confidencePercent < 50;
        if (filterOption === "favorites") return exp.favorite;
        return true;
      })
      .sort((a, b) => {
        if (sortOption === "confidence-high") return b.confidence - a.confidence;
        if (sortOption === "confidence-low") return a.confidence - b.confidence;
        if (sortOption === "time-long") return b.time - a.time;
        if (sortOption === "time-short") return a.time - b.time;
        return b.timestamp - a.timestamp; // recent (default order - newest first)
      }),
    [experiments, searchQuery, filterOption, sortOption, toPercentage]
  );

  const toggleSelect = useCallback((id: string) => {
    setSelectedExperiments((prev) =>
      prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]
    );
  }, []);

  // Consolidated confidence color helper (memoized)
  const getConfidenceColors = useCallback((confidence: number) => ({
    text: confidence >= 80 ? "text-green-400" : confidence >= 50 ? "text-yellow-400" : "text-red-400",
    bg: confidence >= 80 ? "bg-green-500" : confidence >= 50 ? "bg-yellow-500" : "bg-red-500",
  }), []);

  // Export experiment as JSON
  const handleExport = useCallback((exp: typeof experiments[0]) => {
    const dataStr = JSON.stringify(exp, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `experiment-${exp.id}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, []);

  // Batch export selected experiments
  const handleBatchExport = useCallback(() => {
    const selectedExps = experiments.filter((exp) => selectedExperiments.includes(exp.id));
    const dataStr = JSON.stringify(selectedExps, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `experiments-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [experiments, selectedExperiments]);

  // Batch delete selected experiments
  const handleBatchDelete = useCallback(() => {
    if (confirm(`Are you sure you want to delete ${selectedExperiments.length} experiment(s)? This cannot be undone.`)) {
      selectedExperiments.forEach((id) => removeExperiment(id));
      setSelectedExperiments([]);
    }
  }, [selectedExperiments, removeExperiment]);

  if (experiments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-20 h-20 rounded-full bg-zinc-800 flex items-center justify-center mb-4">
          <ResultsIcon />
        </div>
        <p className="text-zinc-400 text-sm font-medium">No planning history yet</p>
        <p className="text-zinc-600 text-xs mt-2 max-w-xs">
          Upload images and run your first planning experiment to see results here.
        </p>
        <button
          onClick={onGoToUpload}
          className={styles.buttonPrimary}
        >
          Go to Upload Page
        </button>
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-zinc-200">Planning History</h2>
        <div className="flex gap-2">
          <button
            onClick={() => {
              const dataStr = JSON.stringify(experiments, null, 2);
              const dataBlob = new Blob([dataStr], { type: "application/json" });
              const url = URL.createObjectURL(dataBlob);
              const link = document.createElement("a");
              link.href = url;
              link.download = `all-experiments-${new Date().toISOString().split('T')[0]}.json`;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              URL.revokeObjectURL(url);
            }}
            className={`${styles.buttonSecondary} flex items-center gap-2`}
          >
            <ExportIcon />
            Export All
          </button>
          <button
            onClick={() => {
              if (confirm("Are you sure you want to clear all planning history? This cannot be undone.")) {
                clearAll();
              }
            }}
            className={`${styles.buttonDanger} flex items-center gap-2`}
          >
            <TrashIcon />
            Clear All
          </button>
        </div>
      </div>

      {/* Statistics Dashboard (Collapsible with preview) */}
      <div className="bg-zinc-800 rounded-xl border border-zinc-700 mb-6">
        <button
          onClick={() => setShowStats(!showStats)}
          className="w-full px-6 py-4 flex items-center justify-between text-left group"
        >
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-zinc-300 flex items-center gap-2">
              <ChartIcon />
              Statistics (Last 30 days)
            </span>
            {/* Mini preview when collapsed */}
            {!showStats && experiments.length > 0 && (
              <span className="text-xs text-zinc-500 hidden sm:block">
                <span className="text-zinc-300">{experiments.length}</span> experiments
                <span className="mx-1">|</span>
                <span className="text-green-400">{Math.round((experiments.filter((e) => toPercentage(e.confidence) >= 80).length / experiments.length) * 100)}%</span> success
                <span className="mx-1">|</span>
                Avg <span className="text-zinc-300">{(experiments.reduce((a, b) => a + b.time, 0) / experiments.length).toFixed(1)}s</span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500 group-hover:text-zinc-400 transition-colors">
              {showStats ? "Collapse" : "Expand"}
            </span>
            <ChevronIcon className={`transform transition-transform ${showStats ? "rotate-180" : ""}`} />
          </div>
        </button>
        {showStats && (
          <div className="px-6 pb-6 border-t border-zinc-700 pt-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-zinc-900 rounded-lg p-4">
                <p className="text-xs text-zinc-500 mb-1">Total Experiments</p>
                <p className="text-2xl font-semibold text-zinc-200">{experiments.length}</p>
              </div>
              <div className="bg-zinc-900 rounded-lg p-4">
                <p className="text-xs text-zinc-500 mb-1">Success Rate</p>
                <p className="text-2xl font-semibold text-green-400">
                  {experiments.length > 0 ? Math.round((experiments.filter((e) => toPercentage(e.confidence) >= 80).length / experiments.length) * 100) : 0}%
                </p>
              </div>
              <div className="bg-zinc-900 rounded-lg p-4">
                <p className="text-xs text-zinc-500 mb-1">Avg Planning Time</p>
                <p className="text-2xl font-semibold text-zinc-200">
                  {experiments.length > 0 ? (experiments.reduce((a, b) => a + b.time, 0) / experiments.length).toFixed(1) : 0}s
                </p>
              </div>
              <div className="bg-zinc-900 rounded-lg p-4">
                <p className="text-xs text-zinc-500 mb-1">Most Used Model</p>
                <p className="text-lg font-semibold text-zinc-200">
                  {experiments.length > 0 ? experiments.reduce((acc, e) => {
                    acc[e.model] = (acc[e.model] || 0) + 1;
                    return acc;
                  }, {} as Record<string, number>) && Object.entries(experiments.reduce((acc, e) => {
                    acc[e.model] = (acc[e.model] || 0) + 1;
                    return acc;
                  }, {} as Record<string, number>)).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A" : "N/A"}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Search and Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="Search experiments..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-zinc-800 text-white rounded-lg border border-zinc-700 outline-none text-sm focus:border-indigo-500 transition-colors"
            />
          </div>
        </div>
        <select
          value={filterOption}
          onChange={(e) => setFilterOption(e.target.value)}
          className="px-4 py-2.5 bg-zinc-800 text-white rounded-lg border border-zinc-700 outline-none text-sm"
        >
          <option value="all">All experiments ({experiments.length})</option>
          <option value="high">High confidence (&gt;80%)</option>
          <option value="medium">Medium (50-80%)</option>
          <option value="low">Low (&lt;50%)</option>
          <option value="favorites">Favorites</option>
        </select>
        <select
          value={sortOption}
          onChange={(e) => setSortOption(e.target.value)}
          className="px-4 py-2.5 bg-zinc-800 text-white rounded-lg border border-zinc-700 outline-none text-sm"
        >
          <option value="recent">Most recent</option>
          <option value="confidence-high">Highest confidence</option>
          <option value="confidence-low">Lowest confidence</option>
          <option value="time-long">Longest time</option>
          <option value="time-short">Shortest time</option>
        </select>
      </div>

      {/* Batch Actions (when items selected) */}
      {selectedExperiments.length > 0 && (
        <div className="bg-indigo-600/20 border border-indigo-500/30 rounded-lg px-4 py-3 mb-4 flex items-center justify-between">
          <span className="text-sm text-indigo-300">
            {selectedExperiments.length} experiment{selectedExperiments.length > 1 ? "s" : ""} selected
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => alert("Compare feature coming soon!")}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs"
            >
              Compare
            </button>
            <button
              onClick={handleBatchExport}
              className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-white rounded text-xs"
            >
              Export
            </button>
            <button
              onClick={handleBatchDelete}
              className="px-3 py-1.5 bg-red-600/50 hover:bg-red-600 text-white rounded text-xs"
            >
              Delete
            </button>
            <button
              onClick={() => setSelectedExperiments([])}
              className="px-3 py-1.5 text-zinc-400 hover:text-white text-xs"
            >
              Clear selection
            </button>
          </div>
        </div>
      )}

      {/* Experiment Cards */}
      <div className="space-y-4">
        {filteredExperiments.map((exp) => (
          <div
            key={exp.id}
            className={`bg-zinc-800 rounded-xl border transition-all ${
              selectedExperiments.includes(exp.id)
                ? "border-indigo-500"
                : "border-zinc-700 hover:border-zinc-600"
            }`}
          >
            {/* Card Header */}
            <div className="p-4 flex items-start gap-4">
              {/* Checkbox */}
              <input
                type="checkbox"
                checked={selectedExperiments.includes(exp.id)}
                onChange={() => toggleSelect(exp.id)}
                className={`mt-1 ${styles.checkbox}`}
              />

              {/* Image Thumbnails */}
              <div className="flex gap-2 shrink-0">
                <img
                  src={getImageUrl(exp.currentImage)}
                  alt="Current state"
                  className="w-16 h-16 bg-zinc-700 rounded-lg object-cover"
                />
                <div className="text-zinc-500 self-center">→</div>
                <img
                  src={getImageUrl(exp.goalImage)}
                  alt="Goal state"
                  className="w-16 h-16 bg-zinc-700 rounded-lg object-cover"
                />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <h4 className="text-sm font-medium text-zinc-200">{exp.title}</h4>
                    <p className="text-xs text-zinc-500">{formatDate(exp.timestamp)}</p>
                  </div>
                  <button
                    onClick={() => toggleFavorite(exp.id)}
                    className={`p-1 transition-colors ${
                      exp.favorite ? "text-amber-400" : "text-zinc-600 hover:text-amber-400"
                    }`}
                  >
                    <StarIcon filled={exp.favorite} />
                  </button>
                </div>

                {/* Quick Stats */}
                <div className="flex flex-wrap gap-4 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-500">Confidence:</span>
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${getConfidenceColors(toPercentage(exp.confidence)).bg} rounded-full`}
                          style={{ width: `${toPercentage(exp.confidence)}%` }}
                        />
                      </div>
                      <span className={`text-xs font-medium ${getConfidenceColors(toPercentage(exp.confidence)).text}`}>
                        {toPercentage(exp.confidence)}%
                      </span>
                    </div>
                  </div>
                  <div className="text-xs text-zinc-400">
                    Energy: <span className="text-zinc-200">{exp.energy}</span>
                  </div>
                  <div className="text-xs text-zinc-400">
                    Time: <span className="text-zinc-200">{exp.time}s</span>
                  </div>
                  <div className="text-xs text-zinc-400">
                    Model: <span className="text-zinc-200">{exp.model}</span>
                  </div>
                </div>

                {/* Action Preview */}
                <div className="text-xs text-zinc-500">
                  Action:{" "}
                  <span className="text-zinc-300 font-mono">
                    [{exp.action.map((v) => (v >= 0 ? "+" : "") + v.toFixed(1)).join(", ")}] cm
                  </span>
                </div>
              </div>

              {/* Expand Button */}
              <button
                onClick={() => setExpandedCard(expandedCard === exp.id ? null : exp.id)}
                className="p-2 text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                <ChevronIcon className={`transform transition-transform ${expandedCard === exp.id ? "rotate-180" : ""}`} />
              </button>
            </div>

            {/* Expanded Content */}
            {expandedCard === exp.id && (
              <div className="px-4 pb-4 border-t border-zinc-700 pt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-xs text-zinc-500 mb-2">Planning Parameters:</p>
                    <ul className="text-sm text-zinc-300 space-y-1">
                      <li>• Model: {exp.model}</li>
                      <li>• Samples: {exp.samples}</li>
                      <li>• Iterations: {exp.iterations}</li>
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500 mb-2">Results:</p>
                    <ul className="text-sm text-zinc-300 space-y-1">
                      <li>• Confidence: {toPercentage(exp.confidence)}% {toPercentage(exp.confidence) >= 80 ? "✓" : ""}</li>
                      <li>• Final Energy: {exp.energy.toFixed(2)}</li>
                      <li>• Planning Time: {exp.time}s</li>
                    </ul>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setDetailsModalId(exp.id)}
                    className={`${styles.buttonPrimary} flex items-center gap-2`}
                  >
                    <EyeIcon />
                    View Details
                  </button>
                  <button
                    onClick={() => alert("Compare feature coming soon!")}
                    className={`${styles.buttonSecondary} flex items-center gap-2`}
                  >
                    <CompareIcon />
                    Compare
                  </button>
                  <button
                    onClick={() => setReplayModalId(exp.id)}
                    className={`${styles.buttonSecondary} flex items-center gap-2`}
                  >
                    <PlayIcon />
                    Replay
                  </button>
                  <button
                    onClick={() => handleExport(exp)}
                    className={`${styles.buttonSecondary} flex items-center gap-2`}
                  >
                    <ExportIcon />
                    Export
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Are you sure you want to delete "${exp.title}"? This cannot be undone.`)) {
                        removeExperiment(exp.id);
                      }
                    }}
                    className={`${styles.buttonDanger} flex items-center gap-2`}
                  >
                    <TrashIcon />
                    Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Results Count */}
      <div className="mt-6 text-center text-sm text-zinc-500">
        Showing {filteredExperiments.length} of {experiments.length} experiments
      </div>

      {/* Details Modal */}
      {detailsModalId && (() => {
        const exp = experiments.find((e) => e.id === detailsModalId);
        if (!exp) return null;
        return (
          <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setDetailsModalId(null)}>
            <div className="bg-zinc-900 rounded-xl border border-zinc-700 max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              {/* Modal Header */}
              <div className="sticky top-0 bg-zinc-900 border-b border-zinc-700 px-6 py-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-zinc-200">{exp.title}</h3>
                <button
                  onClick={() => setDetailsModalId(null)}
                  className="text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-6">
                {/* Images */}
                <div>
                  <h4 className="text-sm font-medium text-zinc-400 mb-3">Images</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-zinc-500 mb-2">Current State</p>
                      <img
                        src={getImageUrl(exp.currentImage)}
                        alt="Current state"
                        className="w-full aspect-video bg-zinc-800 rounded-lg object-cover"
                      />
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500 mb-2">Goal State</p>
                      <img
                        src={getImageUrl(exp.goalImage)}
                        alt="Goal state"
                        className="w-full aspect-video bg-zinc-800 rounded-lg object-cover"
                      />
                    </div>
                  </div>
                </div>

                {/* Experiment Info */}
                <div>
                  <h4 className="text-sm font-medium text-zinc-400 mb-3">Experiment Information</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-zinc-800 rounded-lg p-3">
                      <p className="text-xs text-zinc-500 mb-1">Timestamp</p>
                      <p className="text-sm text-zinc-200">{formatDate(exp.timestamp)}</p>
                    </div>
                    <div className="bg-zinc-800 rounded-lg p-3">
                      <p className="text-xs text-zinc-500 mb-1">Model</p>
                      <p className="text-sm text-zinc-200">{exp.model}</p>
                    </div>
                    <div className="bg-zinc-800 rounded-lg p-3">
                      <p className="text-xs text-zinc-500 mb-1">Samples</p>
                      <p className="text-sm text-zinc-200">{exp.samples}</p>
                    </div>
                    <div className="bg-zinc-800 rounded-lg p-3">
                      <p className="text-xs text-zinc-500 mb-1">Iterations</p>
                      <p className="text-sm text-zinc-200">{exp.iterations}</p>
                    </div>
                  </div>
                </div>

                {/* Results */}
                <div>
                  <h4 className="text-sm font-medium text-zinc-400 mb-3">Results</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-zinc-800 rounded-lg p-3">
                      <p className="text-xs text-zinc-500 mb-1">Confidence</p>
                      <p className={`text-2xl font-semibold ${getConfidenceColors(toPercentage(exp.confidence)).text}`}>
                        {toPercentage(exp.confidence)}%
                      </p>
                    </div>
                    <div className="bg-zinc-800 rounded-lg p-3">
                      <p className="text-xs text-zinc-500 mb-1">Final Energy</p>
                      <p className="text-2xl font-semibold text-zinc-200">{exp.energy.toFixed(2)}</p>
                    </div>
                    <div className="bg-zinc-800 rounded-lg p-3">
                      <p className="text-xs text-zinc-500 mb-1">Planning Time</p>
                      <p className="text-2xl font-semibold text-zinc-200">{exp.time}s</p>
                    </div>
                    <div className="bg-zinc-800 rounded-lg p-3">
                      <p className="text-xs text-zinc-500 mb-1">Action</p>
                      <p className="text-sm font-mono text-zinc-200">
                        [{exp.action.map((v) => (v >= 0 ? "+" : "") + v.toFixed(1)).join(", ")}] cm
                      </p>
                    </div>
                  </div>
                </div>

                {/* Energy History */}
                {exp.energyHistory && exp.energyHistory.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-zinc-400 mb-3">Energy History</h4>
                    <div className="bg-zinc-800 rounded-lg p-4">
                      {(() => {
                        const energyHistory = exp.energyHistory!;
                        const width = 100; // percentage
                        const height = 120; // pixels
                        const padding = { top: 10, right: 10, bottom: 20, left: 40 };
                        const chartWidth = width - padding.left - padding.right;
                        const chartHeight = height - padding.top - padding.bottom;

                        const maxEnergy = Math.max(...energyHistory);
                        const minEnergy = Math.min(...energyHistory);
                        const energyRange = maxEnergy - minEnergy || 1;

                        // Create points for the line
                        const points = energyHistory.map((energy, i) => {
                          const x = (i / (energyHistory.length - 1)) * chartWidth + padding.left;
                          const y = height - padding.bottom - ((energy - minEnergy) / energyRange) * chartHeight;
                          return { x, y, energy };
                        });

                        // Create SVG path
                        const pathD = points.map((p, i) =>
                          `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`
                        ).join(' ');

                        return (
                          <div className="relative">
                            {/* Best Energy Label */}
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs text-zinc-500">Best Energy</span>
                              <span className="text-sm font-semibold text-green-400">
                                {energyHistory[energyHistory.length - 1].toFixed(2)}
                              </span>
                            </div>

                            {/* Line Chart */}
                            <svg
                              viewBox={`0 0 ${width} ${height}`}
                              className="w-full"
                              style={{ height: `${height}px` }}
                            >
                              {/* Grid lines */}
                              {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
                                const y = height - padding.bottom - fraction * chartHeight;
                                const value = minEnergy + fraction * energyRange;
                                return (
                                  <g key={fraction}>
                                    <line
                                      x1={padding.left}
                                      y1={y}
                                      x2={width - padding.right}
                                      y2={y}
                                      stroke="#3f3f46"
                                      strokeWidth="0.2"
                                      strokeDasharray="1,1"
                                    />
                                    <text
                                      x={padding.left - 3}
                                      y={y}
                                      textAnchor="end"
                                      fontSize="3"
                                      fill="#71717a"
                                      dominantBaseline="middle"
                                    >
                                      {value.toFixed(0)}
                                    </text>
                                  </g>
                                );
                              })}

                              {/* X-axis */}
                              <line
                                x1={padding.left}
                                y1={height - padding.bottom}
                                x2={width - padding.right}
                                y2={height - padding.bottom}
                                stroke="#52525b"
                                strokeWidth="0.3"
                              />

                              {/* Y-axis */}
                              <line
                                x1={padding.left}
                                y1={padding.top}
                                x2={padding.left}
                                y2={height - padding.bottom}
                                stroke="#52525b"
                                strokeWidth="0.3"
                              />

                              {/* Line path */}
                              <path
                                d={pathD}
                                fill="none"
                                stroke="#6366f1"
                                strokeWidth="0.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />

                              {/* Data points */}
                              {points.map((point, i) => (
                                <g key={i}>
                                  <circle
                                    cx={point.x}
                                    cy={point.y}
                                    r="1"
                                    fill="#6366f1"
                                    stroke="#1e1b4b"
                                    strokeWidth="0.3"
                                  />
                                  {/* Show energy value on hover */}
                                  <title>Iteration {i + 1}: {point.energy.toFixed(2)}</title>
                                </g>
                              ))}

                              {/* X-axis labels */}
                              <text
                                x={padding.left}
                                y={height - 2}
                                fontSize="3"
                                fill="#71717a"
                                textAnchor="start"
                              >
                                1
                              </text>
                              <text
                                x={width - padding.right}
                                y={height - 2}
                                fontSize="3"
                                fill="#71717a"
                                textAnchor="end"
                              >
                                {energyHistory.length}
                              </text>

                              {/* Converged indicator if energy stabilized */}
                              {energyHistory.length > 2 &&
                               Math.abs(energyHistory[energyHistory.length - 1] - energyHistory[energyHistory.length - 2]) < 0.1 && (
                                <text
                                  x={width / 2}
                                  y={height - 2}
                                  fontSize="3"
                                  fill="#22c55e"
                                  textAnchor="middle"
                                >
                                  (converged)
                                </text>
                              )}
                            </svg>

                            {/* Iteration label */}
                            <div className="text-center mt-1">
                              <span className="text-xs text-zinc-500">Iteration</span>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Replay Modal */}
      {replayModalId && (() => {
        const exp = experiments.find((e) => e.id === replayModalId);
        if (!exp) return null;
        return (
          <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setReplayModalId(null)}>
            <div className="bg-zinc-900 rounded-xl border border-zinc-700 max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
              {/* Modal Header */}
              <div className="border-b border-zinc-700 px-6 py-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-zinc-200">Replay: {exp.title}</h3>
                <button
                  onClick={() => setReplayModalId(null)}
                  className="text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6">
                <div className="bg-zinc-800 rounded-lg p-8 text-center">
                  <div className="w-16 h-16 rounded-full bg-zinc-700 flex items-center justify-center mx-auto mb-4">
                    <PlayIcon className="text-zinc-500 !w-8 !h-8" />
                  </div>
                  <p className="text-zinc-400 text-sm mb-4">
                    Replay functionality coming soon!
                  </p>
                  <p className="text-zinc-600 text-xs">
                    This feature will allow you to replay the planning process step by step.
                  </p>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}
