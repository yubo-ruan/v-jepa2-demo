"use client";

import { useMemo } from "react";
import {
  UploadIcon,
  HistoryIcon,
  ResearchIcon,
  SimulatorIcon,
  LiberoIcon,
} from "@/components/icons";
import type { MainTab } from "@/types";

interface SidebarProps {
  isOpen: boolean;
  activeTab: MainTab;
  onTabChange: (tab: MainTab) => void;
}

export function Sidebar({ isOpen, activeTab, onTabChange }: SidebarProps) {
  const navTabs = useMemo(() => [
    { id: "inference" as const, label: "Inference", icon: <UploadIcon /> },
    { id: "simulator" as const, label: "Simulator", icon: <SimulatorIcon /> },
    { id: "libero" as const, label: "LIBERO", icon: <LiberoIcon /> },
    { id: "history" as const, label: "History", icon: <HistoryIcon /> },
    { id: "finetune" as const, label: "Fine-tune", icon: <ResearchIcon /> },
  ], []);

  return (
    <aside
      className={`${
        isOpen ? "translate-x-0" : "-translate-x-full"
      } lg:translate-x-0 fixed lg:relative z-20 w-56 bg-zinc-800 border-r border-zinc-700 flex flex-col shrink-0 h-[calc(100vh-3.5rem)] transition-transform duration-300`}
    >
      <nav className="flex flex-col p-4 gap-1">
        {navTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all ${
              activeTab === tab.id
                ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/25"
                : "text-zinc-300 hover:bg-zinc-700 hover:text-white"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </nav>
    </aside>
  );
}
