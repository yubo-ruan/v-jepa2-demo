"use client";

import { useState, useMemo, useCallback } from "react";
import {
  CameraIcon,
  TargetIcon,
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
import { sampleExperiments } from "@/constants";

interface HistoryPageProps {
  onGoToUpload: () => void;
}

export function HistoryPage({ onGoToUpload }: HistoryPageProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterOption, setFilterOption] = useState("all");
  const [sortOption, setSortOption] = useState("recent");
  const [showStats, setShowStats] = useState(false);
  const [selectedExperiments, setSelectedExperiments] = useState<string[]>([]);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);

  // Filter and sort experiments (memoized for performance)
  const filteredExperiments = useMemo(() =>
    sampleExperiments
      .filter((exp) => {
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          return (
            exp.title.toLowerCase().includes(query) ||
            exp.model.toLowerCase().includes(query)
          );
        }
        if (filterOption === "high") return exp.confidence >= 80;
        if (filterOption === "medium") return exp.confidence >= 50 && exp.confidence < 80;
        if (filterOption === "low") return exp.confidence < 50;
        if (filterOption === "favorites") return exp.favorite;
        return true;
      })
      .sort((a, b) => {
        if (sortOption === "confidence-high") return b.confidence - a.confidence;
        if (sortOption === "confidence-low") return a.confidence - b.confidence;
        if (sortOption === "time-long") return b.time - a.time;
        if (sortOption === "time-short") return a.time - b.time;
        return 0; // recent (default order)
      }),
    [searchQuery, filterOption, sortOption]
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

  if (sampleExperiments.length === 0) {
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
          <button className={`${styles.buttonSecondary} flex items-center gap-2`}>
            <ExportIcon />
            Export
          </button>
          <button className={`${styles.buttonDanger} flex items-center gap-2`}>
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
            {!showStats && (
              <span className="text-xs text-zinc-500 hidden sm:block">
                <span className="text-zinc-300">{sampleExperiments.length}</span> experiments
                <span className="mx-1">|</span>
                <span className="text-green-400">{Math.round((sampleExperiments.filter((e) => e.confidence >= 80).length / sampleExperiments.length) * 100)}%</span> success
                <span className="mx-1">|</span>
                Avg <span className="text-zinc-300">{(sampleExperiments.reduce((a, b) => a + b.time, 0) / sampleExperiments.length).toFixed(1)}s</span>
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
                <p className="text-2xl font-semibold text-zinc-200">{sampleExperiments.length}</p>
              </div>
              <div className="bg-zinc-900 rounded-lg p-4">
                <p className="text-xs text-zinc-500 mb-1">Success Rate</p>
                <p className="text-2xl font-semibold text-green-400">
                  {Math.round((sampleExperiments.filter((e) => e.confidence >= 80).length / sampleExperiments.length) * 100)}%
                </p>
              </div>
              <div className="bg-zinc-900 rounded-lg p-4">
                <p className="text-xs text-zinc-500 mb-1">Avg Planning Time</p>
                <p className="text-2xl font-semibold text-zinc-200">
                  {(sampleExperiments.reduce((a, b) => a + b.time, 0) / sampleExperiments.length).toFixed(1)}s
                </p>
              </div>
              <div className="bg-zinc-900 rounded-lg p-4">
                <p className="text-xs text-zinc-500 mb-1">Most Used Model</p>
                <p className="text-lg font-semibold text-zinc-200">ViT-Giant</p>
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
          <option value="all">All experiments ({sampleExperiments.length})</option>
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
            <button className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs">
              Compare
            </button>
            <button className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-white rounded text-xs">
              Export
            </button>
            <button className="px-3 py-1.5 bg-red-600/50 hover:bg-red-600 text-white rounded text-xs">
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

              {/* Thumbnail Placeholder */}
              <div className="flex gap-2 shrink-0">
                <div className="w-16 h-16 bg-zinc-700 rounded-lg flex items-center justify-center">
                  <CameraIcon className="text-zinc-500 !w-5 !h-5" />
                </div>
                <div className="text-zinc-500 self-center">→</div>
                <div className="w-16 h-16 bg-zinc-700 rounded-lg flex items-center justify-center">
                  <TargetIcon className="text-zinc-500 !w-5 !h-5" />
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <h4 className="text-sm font-medium text-zinc-200">{exp.title}</h4>
                    <p className="text-xs text-zinc-500">{exp.timestamp}</p>
                  </div>
                  <button
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
                          className={`h-full ${getConfidenceColors(exp.confidence).bg} rounded-full`}
                          style={{ width: `${exp.confidence}%` }}
                        />
                      </div>
                      <span className={`text-xs font-medium ${getConfidenceColors(exp.confidence).text}`}>
                        {exp.confidence}%
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
                      <li>• Confidence: {exp.confidence}% {exp.confidence >= 80 ? "✓" : ""}</li>
                      <li>• Final Energy: {exp.energy}</li>
                      <li>• Planning Time: {exp.time}s</li>
                    </ul>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-2">
                  <button className={`${styles.buttonPrimary} flex items-center gap-2`}>
                    <EyeIcon />
                    View Details
                  </button>
                  <button className={`${styles.buttonSecondary} flex items-center gap-2`}>
                    <CompareIcon />
                    Compare
                  </button>
                  <button className={`${styles.buttonSecondary} flex items-center gap-2`}>
                    <PlayIcon />
                    Replay
                  </button>
                  <button className={`${styles.buttonSecondary} flex items-center gap-2`}>
                    <ExportIcon />
                    Export
                  </button>
                  <button className={`${styles.buttonDanger} flex items-center gap-2`}>
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
        Showing {filteredExperiments.length} of {sampleExperiments.length} experiments
      </div>
    </>
  );
}
