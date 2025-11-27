"use client";

import { useState } from "react";
import { Header, Sidebar } from "@/components/layout";
import { UploadPage, HistoryPage, SimulatorPage } from "@/components/pages";
import { ResearchDashboard, type ResearchTab } from "@/components/research/ResearchDashboard";
import { Toast } from "@/components/ui";
import { ToastProvider, ConfigProvider, PlanningProvider, ModelsProvider, HistoryProvider, useToast } from "@/contexts";
import type { MainTab } from "@/types";

function MainContent() {
  const [activeTab, setActiveTab] = useState<MainTab>("inference");
  const [researchTab, setResearchTab] = useState<ResearchTab>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { toast } = useToast();

  return (
    <div className="flex flex-col h-screen">
      <Header onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          isOpen={sidebarOpen}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />

        <main className="flex-1 bg-zinc-900 p-8 overflow-auto">
          {/* Toast Notification */}
          <Toast message={toast.message} visible={toast.visible} type={toast.type} />

          {activeTab === "inference" && <UploadPage />}

          {activeTab === "simulator" && <SimulatorPage />}

          {activeTab === "history" && (
            <HistoryPage onGoToUpload={() => setActiveTab("inference")} />
          )}

          {activeTab === "finetune" && (
            <ResearchDashboard
              activeTab={researchTab}
              onTabChange={setResearchTab}
            />
          )}
        </main>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <ToastProvider>
      <ConfigProvider>
        <ModelsProvider>
          <HistoryProvider>
            <PlanningProvider>
              <MainContent />
            </PlanningProvider>
          </HistoryProvider>
        </ModelsProvider>
      </ConfigProvider>
    </ToastProvider>
  );
}
