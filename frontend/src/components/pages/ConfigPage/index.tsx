"use client";

import { useState } from "react";
import { styles } from "@/components/ui";
import { useConfig, useModels } from "@/contexts";
import { configTabs } from "@/constants";
import { ModelManagementTable } from "@/components/ModelManagementTable";

export function ConfigPage() {
  const [configTab, setConfigTab] = useState<"model" | "ui" | "advanced">("model");
  const {
    models,
    loadedModel,
    isLoading: isLoadingModels,
    isActioning,
    loadModel,
    unloadModel,
    downloadModel,
    cancelDownload,
  } = useModels();
  const {
    modelConfig,
    uiConfig,
    advancedConfig,
    updateModelConfig,
    updateUIConfig,
    updateAdvancedConfig,
  } = useConfig();

  return (
    <>
      {/* Config Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-zinc-200">Configuration</h2>
      </div>

      {/* Config Tabs */}
      <div className="flex gap-1 mb-6 bg-zinc-800 p-1 rounded-lg w-fit">
        {configTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setConfigTab(tab.id)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              configTab === tab.id
                ? "bg-zinc-700 text-white"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Model Preferences Tab */}
      {configTab === "model" && (
        <div className="space-y-6">
          {/* Model Management - Primary section at top */}
          <div className="bg-zinc-800 rounded-xl border border-zinc-700 p-6">
            <h3 className="text-base font-semibold text-zinc-300 mb-5">Model Management</h3>
            <ModelManagementTable
              models={models}
              loadedModel={loadedModel}
              isActioning={isActioning}
              isLoading={isLoadingModels}
              onLoad={loadModel}
              onUnload={unloadModel}
              onDownload={downloadModel}
              onCancelDownload={cancelDownload}
            />
          </div>
        </div>
      )}

      {/* UI Settings Tab */}
      {configTab === "ui" && (
        <div className="space-y-6">
          {/* Theme */}
          <div className="bg-zinc-800 rounded-xl border border-zinc-700 p-6">
            <h3 className="text-base font-semibold text-zinc-300 mb-5">Theme</h3>
            <div className="space-y-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="theme"
                  checked={uiConfig.theme === "dark"}
                  onChange={() => updateUIConfig({ theme: "dark" })}
                  className={styles.radio}
                />
                <span className="text-sm text-zinc-300">Dark mode (current)</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="theme"
                  checked={uiConfig.theme === "light"}
                  onChange={() => updateUIConfig({ theme: "light" })}
                  className={styles.radio}
                />
                <span className="text-sm text-zinc-300">Light mode</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="theme"
                  checked={uiConfig.theme === "auto"}
                  onChange={() => updateUIConfig({ theme: "auto" })}
                  className={styles.radio}
                />
                <span className="text-sm text-zinc-300">Auto (follow system)</span>
              </label>
            </div>
          </div>

          {/* Display Preferences */}
          <div className="bg-zinc-800 rounded-xl border border-zinc-700 p-6">
            <h3 className="text-base font-semibold text-zinc-300 mb-5">Display Preferences</h3>
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={uiConfig.showTimeEstimates}
                  onChange={(e) => updateUIConfig({ showTimeEstimates: e.target.checked })}
                  className={styles.checkbox}
                />
                <span className="text-sm text-zinc-300">Show time estimates</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={uiConfig.showTooltips}
                  onChange={(e) => updateUIConfig({ showTooltips: e.target.checked })}
                  className={styles.checkbox}
                />
                <span className="text-sm text-zinc-300">Show tooltips on hover</span>
              </label>
            </div>
          </div>

          {/* Units & Formatting */}
          <div className="bg-zinc-800 rounded-xl border border-zinc-700 p-6">
            <h3 className="text-base font-semibold text-zinc-300 mb-5">Units & Formatting</h3>
            <div className="mb-4">
              <p className="text-sm text-zinc-400 mb-3">Distance Units:</p>
              <div className="space-y-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="distanceUnits"
                    checked={uiConfig.distanceUnits === "cm"}
                    onChange={() => updateUIConfig({ distanceUnits: "cm" })}
                    className={styles.radio}
                  />
                  <span className="text-sm text-zinc-300">Centimeters (cm)</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="distanceUnits"
                    checked={uiConfig.distanceUnits === "m"}
                    onChange={() => updateUIConfig({ distanceUnits: "m" })}
                    className={styles.radio}
                  />
                  <span className="text-sm text-zinc-300">Meters (m)</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="distanceUnits"
                    checked={uiConfig.distanceUnits === "mm"}
                    onChange={() => updateUIConfig({ distanceUnits: "mm" })}
                    className={styles.radio}
                  />
                  <span className="text-sm text-zinc-300">Millimeters (mm)</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Advanced Tab */}
      {configTab === "advanced" && (
        <div className="space-y-6">
          {/* Performance */}
          <div className="bg-zinc-800 rounded-xl border border-zinc-700 p-6">
            <h3 className="text-base font-semibold text-zinc-300 mb-5">Performance</h3>

            <div className="mb-6">
              <label className="block text-sm text-zinc-400 mb-2">GPU Settings</label>
              <select
                value={advancedConfig.gpuDevice}
                onChange={(e) => updateAdvancedConfig({ gpuDevice: e.target.value })}
                className="w-full md:w-64 px-4 py-2.5 bg-zinc-700 text-white rounded-lg border-none outline-none text-sm"
              >
                <option value="auto">Auto-detect ⭐</option>
                <option value="cuda">CUDA (NVIDIA)</option>
                <option value="cpu">CPU only</option>
              </select>
            </div>

            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={advancedConfig.clearCacheAfterPlanning}
                  onChange={(e) => updateAdvancedConfig({ clearCacheAfterPlanning: e.target.checked })}
                  className={styles.checkbox}
                />
                <span className="text-sm text-zinc-300">Clear cache after planning</span>
              </label>
            </div>
          </div>

          {/* Developer Options */}
          <div className="bg-zinc-800 rounded-xl border border-zinc-700 p-6">
            <h3 className="text-base font-semibold text-zinc-300 mb-5">Developer Options</h3>

            <div className="space-y-3 mb-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={advancedConfig.debugMode}
                  onChange={(e) => updateAdvancedConfig({ debugMode: e.target.checked })}
                  className={styles.checkbox}
                />
                <span className="text-sm text-zinc-300">Enable debug logging (browser console)</span>
              </label>
            </div>

            <p className="text-xs text-zinc-500">
              Debug logs are output to the browser console. Check DevTools (F12) to view detailed logging.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
