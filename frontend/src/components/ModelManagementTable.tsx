"use client";

import { type ModelStatusItem, type ModelStatus } from "@/lib/api";
import { Spinner, focusRing } from "@/components/ui";

interface ModelManagementTableProps {
  models: ModelStatusItem[];
  loadedModel: string | null;
  isActioning: string | null;
  isLoading: boolean;
  onLoad: (modelId: string) => Promise<void>;
  onUnload: (modelId: string) => Promise<void>;
  onDownload: (modelId: string) => Promise<void>;
  onCancelDownload: (modelId: string) => Promise<void>;
}

function StatusBadge({ status, downloadPercent }: { status: ModelStatus; downloadPercent: number }) {
  switch (status) {
    case "loaded":
      return (
        <span className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-full bg-green-500/20 text-green-400">
          <span className="w-1.5 h-1.5 bg-green-400 rounded-full" />
          Loaded
        </span>
      );
    case "loading":
      return (
        <span className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-full bg-purple-500/20 text-purple-400">
          <Spinner size="sm" />
          Loading...
        </span>
      );
    case "cached":
      return (
        <span className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-full bg-blue-500/20 text-blue-400">
          <span className="w-1.5 h-1.5 bg-blue-400 rounded-full" />
          Cached
        </span>
      );
    case "downloading":
      return (
        <span className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-full bg-amber-500/20 text-amber-400">
          <Spinner size="sm" />
          {downloadPercent}%
        </span>
      );
    case "not_downloaded":
      return (
        <span className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-full bg-zinc-600/50 text-zinc-400">
          <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full" />
          Not Downloaded
        </span>
      );
  }
}

function ActionButton({
  status,
  modelId,
  isActioning,
  onLoad,
  onUnload,
  onDownload,
  onCancelDownload,
}: {
  status: ModelStatus;
  modelId: string;
  isActioning: string | null;
  onLoad: (modelId: string) => Promise<void>;
  onUnload: (modelId: string) => Promise<void>;
  onDownload: (modelId: string) => Promise<void>;
  onCancelDownload: (modelId: string) => Promise<void>;
}) {
  const isThisActioning = isActioning === modelId;

  const baseClasses = `px-3 py-1.5 text-xs font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed ${focusRing}`;

  switch (status) {
    case "not_downloaded":
      return (
        <button
          onClick={() => onDownload(modelId)}
          disabled={isThisActioning}
          className={`${baseClasses} bg-indigo-600 hover:bg-indigo-500 text-white`}
        >
          {isThisActioning ? <Spinner size="sm" /> : "Download"}
        </button>
      );
    case "downloading":
      return (
        <button
          onClick={() => onCancelDownload(modelId)}
          disabled={isThisActioning}
          className={`${baseClasses} bg-amber-600 hover:bg-amber-500 text-white`}
        >
          {isThisActioning ? <Spinner size="sm" /> : "Cancel"}
        </button>
      );
    case "cached":
      return (
        <button
          onClick={() => onLoad(modelId)}
          disabled={isThisActioning}
          className={`${baseClasses} bg-blue-600 hover:bg-blue-500 text-white`}
        >
          {isThisActioning ? <Spinner size="sm" /> : "Load"}
        </button>
      );
    case "loading":
      return (
        <button disabled className={`${baseClasses} bg-zinc-700 text-zinc-400`}>
          <Spinner size="sm" />
        </button>
      );
    case "loaded":
      return (
        <button
          onClick={() => onUnload(modelId)}
          disabled={isThisActioning}
          className={`${baseClasses} bg-zinc-700 hover:bg-zinc-600 text-zinc-300`}
        >
          {isThisActioning ? <Spinner size="sm" /> : "Unload"}
        </button>
      );
  }
}

export function ModelManagementTable({
  models,
  loadedModel,
  isActioning,
  isLoading,
  onLoad,
  onUnload,
  onDownload,
  onCancelDownload,
}: ModelManagementTableProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner size="md" />
        <span className="ml-2 text-zinc-400">Loading models...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Currently loaded model indicator */}
      {loadedModel && (
        <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-sm text-green-300">
              Active model: <span className="font-medium">{models.find(m => m.id === loadedModel)?.name}</span>
            </span>
          </div>
          <span className="text-xs text-green-400/70">Ready for inference</span>
        </div>
      )}

      {/* Model table */}
      <div className="overflow-hidden rounded-lg border border-zinc-700">
        <table className="w-full">
          <thead className="bg-zinc-800/50">
            <tr>
              <th className="text-left text-xs font-medium text-zinc-400 px-4 py-3">Model</th>
              <th className="text-left text-xs font-medium text-zinc-400 px-4 py-3">Size</th>
              <th className="text-left text-xs font-medium text-zinc-400 px-4 py-3">Status</th>
              <th className="text-right text-xs font-medium text-zinc-400 px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-700/50">
            {models.map((model) => (
              <tr key={model.id} className="bg-zinc-900/50 hover:bg-zinc-800/50 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-zinc-200">{model.name}</span>
                    <span className="text-xs text-zinc-500">{model.params} params</span>
                    {model.isAc && (
                      <span className="text-xs text-purple-400 mt-0.5">Action-Conditioned</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-zinc-400">{(model.sizeGb ?? 0).toFixed(1)} GB</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-1">
                    <StatusBadge status={model.status} downloadPercent={model.downloadPercent} />
                    {model.status === "downloading" && (
                      <div className="w-24 h-1 bg-zinc-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-amber-500 rounded-full transition-all duration-300"
                          style={{ width: `${model.downloadPercent}%` }}
                        />
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <ActionButton
                    status={model.status}
                    modelId={model.id}
                    isActioning={isActioning}
                    onLoad={onLoad}
                    onUnload={onUnload}
                    onDownload={onDownload}
                    onCancelDownload={onCancelDownload}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
