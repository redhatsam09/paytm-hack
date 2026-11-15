'use client';

import React from 'react';
import { Radio, Volume2, Key } from 'lucide-react';
import { playPaytmChime } from '@/lib/audio';

interface TopNavbarProps {
  backendConnected: boolean;
  onOpenSettings: () => void;
}

export const TopNavbar: React.FC<TopNavbarProps> = ({
  backendConnected,
  onOpenSettings,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-[#e6e6e6]">
      <div className="max-w-5xl mx-auto px-6 h-18 flex items-center justify-between gap-4">
        {/* Brand / Logo */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#3a3f5c] flex items-center justify-center text-white shadow-xs">
            <Radio className="w-4.5 h-4.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-lg text-[#3d3d3d] tracking-tight">Vani</span>
              <span className="text-[11px] font-medium text-[#717171] hidden sm:inline">
                Autonomous Counter, Credit & Restock Agent
              </span>
            </div>
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-2.5">
          {/* Status Badge */}
          <div
            className={`hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${
              backendConnected
                ? 'bg-[#0e9f6e]/5 text-[#0e9f6e] border-[#0e9f6e]/20'
                : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                backendConnected ? 'bg-[#0e9f6e] animate-pulse' : 'bg-amber-500'
              }`}
            />
            <span>{backendConnected ? 'Zero-Setup Engine Active (Ready for live demo without keys)' : 'Offline'}</span>
          </div>

          {/* Soundbox Chime Test */}
          <button
            type="button"
            onClick={() => playPaytmChime()}
            title="Test Soundbox Chime"
            className="h-10 px-4 rounded-full border border-[#e6e6e6] hover:bg-gray-50 text-[#3d3d3d] text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Volume2 className="w-3.5 h-3.5 text-[#f97316]" />
            <span className="hidden sm:inline">Chime</span>
          </button>

          {/* API Keys Drawer Button */}
          <button
            type="button"
            onClick={onOpenSettings}
            title="Configure Pluggable API Keys"
            className="h-10 px-4 rounded-full bg-[#3a3f5c] hover:bg-[#2c314a] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
          >
            <Key className="w-3.5 h-3.5" />
            <span>API Keys</span>
          </button>
        </div>
      </div>
    </header>
  );
};
