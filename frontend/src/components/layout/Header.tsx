"use client";

import { MenuIcon } from "@/components/icons";

interface HeaderProps {
  onMenuToggle: () => void;
}

export function Header({ onMenuToggle }: HeaderProps) {
  return (
    <header className="h-14 bg-gradient-to-r from-zinc-900 via-zinc-900 to-zinc-800 border-b border-zinc-700 flex items-center justify-between px-6 shrink-0">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuToggle}
          className="lg:hidden p-2 text-zinc-400 hover:text-white transition-colors"
        >
          <MenuIcon />
        </button>
        <h1 className="text-xl font-semibold bg-gradient-to-r from-white to-zinc-300 bg-clip-text text-transparent">
          V-JEPA2 Planning Demo
        </h1>
      </div>
    </header>
  );
}
