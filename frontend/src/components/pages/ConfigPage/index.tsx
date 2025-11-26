"use client";

import { useState } from "react";
import { SaveIcon, ResetIcon } from "@/components/icons";
import { styles, Spinner, focusRing } from "@/components/ui";
import { useConfig, useToast, useModels } from "@/contexts";
import { configTabs, presetOptions } from "@/constants";
import { ModelManagementTable } from "@/components/ModelManagementTable";

export function ConfigPage() {
  const [configTab, setConfigTab] = useState<"model" | "ui" | "advanced">("model");
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
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
    saveConfig,
    resetConfig
  } = useConfig();
  const { showToast } = useToast();

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveConfig();
      showToast("Settings saved successfully", "success");
    } catch {
      showToast("Failed to save settings", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    setIsResetting(true);
    try {
      await resetConfig();
      showToast("Settings reset to defaults", "success");
    } catch {
      showToast("Failed to reset settings", "error");
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <>
      {/* Config Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-zinc-200">Configuration</h2>
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className={`px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-lg transition-all text-sm font-medium shadow-lg shadow-indigo-500/25 hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 ${focusRing}`}
          >
            {isSaving ? <Spinner size="sm" /> : <SaveIcon />}
            {isSaving ? "Saving..." : "Save"}
          </button>
          <button
            onClick={handleReset}
            disabled={isResetting}
            className={`px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg transition-colors text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${focusRing}`}
          >
            {isResetting ? <Spinner size="sm" /> : <ResetIcon />}
            {isResetting ? "Resetting..." : "Reset"}
          </button>
        </div>
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

          {/* Default Preset Settings */}
          <div className="bg-zinc-800 rounded-xl border border-zinc-700 p-6">
            <h3 className="text-base font-semibold text-zinc-300 mb-5">Default Preset</h3>

            <div>
              <label className="block text-sm text-zinc-400 mb-2">Preset</label>
              <select
                value={modelConfig.defaultPreset}
                onChange={(e) => updateModelConfig({ defaultPreset: e.target.value })}
                className={styles.input}
              >
                {presetOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Custom Preset Editor */}
          <div className="bg-zinc-800 rounded-xl border border-zinc-700 p-6">
            <h3 className="text-base font-semibold text-zinc-300 mb-5">Custom Preset Editor</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-zinc-400 mb-2">Custom Preset Name</label>
                <input
                  type="text"
                  placeholder="My Research Preset"
                  className="w-full md:w-64 px-4 py-2.5 bg-zinc-700 text-white rounded-lg border-none outline-none text-sm placeholder-zinc-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-zinc-400">Samples</span>
                    <span className="text-zinc-200 font-medium">{modelConfig.customSamples}</span>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="1000"
                    value={modelConfig.customSamples}
                    onChange={(e) => updateModelConfig({ customSamples: Number(e.target.value) })}
                    className={styles.slider}
                  />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-zinc-400">Iterations</span>
                    <span className="text-zinc-200 font-medium">{modelConfig.customIterations}</span>
                  </div>
                  <input
                    type="range"
                    min="3"
                    max="20"
                    value={modelConfig.customIterations}
                    onChange={(e) => updateModelConfig({ customIterations: Number(e.target.value) })}
                    className={styles.slider}
                  />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-zinc-400">Elite Fraction</span>
                    <span className="text-zinc-200 font-medium">{modelConfig.customEliteFraction.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.05"
                    max="0.3"
                    step="0.01"
                    value={modelConfig.customEliteFraction}
                    onChange={(e) => updateModelConfig({ customEliteFraction: Number(e.target.value) })}
                    className={styles.slider}
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button className={`px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors text-sm ${focusRing}`}>
                  Save Preset
                </button>
                <button className={`px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded-lg transition-colors text-sm ${focusRing}`}>
                  Delete Preset
                </button>
              </div>
            </div>
          </div>

          {/* Action Space Configuration */}
          <div className="bg-zinc-800 rounded-xl border border-zinc-700 p-6">
            <h3 className="text-base font-semibold text-zinc-300 mb-5">Action Space Configuration</h3>

            <div className="mb-6">
              <p className="text-sm text-zinc-400 mb-3">Action Dimensions:</p>
              <div className="space-y-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="actionDimensions"
                    checked={modelConfig.actionDimensions === "3d"}
                    onChange={() => updateModelConfig({ actionDimensions: "3d" })}
                    className={styles.radio}
                  />
                  <span className="text-sm text-zinc-300">3D (X, Y, Z only) - Simpler, faster</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="actionDimensions"
                    checked={modelConfig.actionDimensions === "7d"}
                    onChange={() => updateModelConfig({ actionDimensions: "7d" })}
                    className={styles.radio}
                  />
                  <span className="text-sm text-zinc-300">7D (X, Y, Z + rotations + gripper) - Full control</span>
                </label>
              </div>
            </div>

            <div className="mb-4">
              <p className="text-sm text-zinc-400 mb-3">Action Bounds (meters):</p>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div className="bg-zinc-900 rounded-lg p-3">
                  <span className="text-red-400 font-medium">X:</span>
                  <span className="text-zinc-300 ml-2">[-0.075, +0.075]</span>
                  <p className="text-zinc-500 text-xs mt-1">±7.5cm</p>
                </div>
                <div className="bg-zinc-900 rounded-lg p-3">
                  <span className="text-green-400 font-medium">Y:</span>
                  <span className="text-zinc-300 ml-2">[-0.075, +0.075]</span>
                  <p className="text-zinc-500 text-xs mt-1">±7.5cm</p>
                </div>
                <div className="bg-zinc-900 rounded-lg p-3">
                  <span className="text-blue-400 font-medium">Z:</span>
                  <span className="text-zinc-300 ml-2">[-0.075, +0.075]</span>
                  <p className="text-zinc-500 text-xs mt-1">±7.5cm</p>
                </div>
              </div>
            </div>

            <button className={`px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded-lg transition-colors text-sm ${focusRing}`}>
              Reset to Defaults
            </button>
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
                  checked={uiConfig.showCostEstimates}
                  onChange={(e) => updateUIConfig({ showCostEstimates: e.target.checked })}
                  className={styles.checkbox}
                />
                <span className="text-sm text-zinc-300">Show cost estimates</span>
              </label>
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
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={uiConfig.compactMode}
                  onChange={(e) => updateUIConfig({ compactMode: e.target.checked })}
                  className={styles.checkbox}
                />
                <span className="text-sm text-zinc-300">Compact mode (smaller UI elements)</span>
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
                <span className="text-sm text-zinc-300">Enable debug logging</span>
              </label>
            </div>

            <div className="flex gap-2">
              <button className={`px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded-lg transition-colors text-sm ${focusRing}`}>
                Download Logs
              </button>
              <button className={`px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded-lg transition-colors text-sm ${focusRing}`}>
                Clear Logs
              </button>
            </div>
          </div>

          {/* Experimental Features */}
          <div className="bg-zinc-800 rounded-xl border border-amber-600/50 p-6">
            <h3 className="text-base font-semibold text-zinc-300 mb-2 flex items-center gap-2">
              <span className="text-amber-500">⚠️</span>
              Experimental Features
            </h3>
            <p className="text-sm text-zinc-500 mb-5">These features are experimental and may be unstable</p>

            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className={styles.checkboxAmber}
                />
                <span className="text-sm text-zinc-300">Multi-step trajectory planning (Phase 3)</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className={styles.checkboxAmber}
                />
                <span className="text-sm text-zinc-300">Real-time action streaming</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className={styles.checkboxAmber}
                />
                <span className="text-sm text-zinc-300">Ensemble predictions (multiple models)</span>
              </label>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
