'use client';

import React from 'react';
import { Radio } from 'lucide-react';

interface TopNavbarProps {
  backendConnected: boolean;
}

export const TopNavbar: React.FC<TopNavbarProps> = ({ backendConnected }) => {
  return (
    <header className="sticky top-0 z-40 bg-white/85 backdrop-blur-md border-b border-[#e5e7eb]">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-[#0071e3] flex items-center justify-center text-white shadow-xs">
            <Radio className="w-3.5 h-3.5" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-semibold text-base text-[#1d1d1f] tracking-tight">Paytm Counter</span>
            <span className="hidden sm:inline text-xs text-[#86868b] font-normal">
              Autonomous Voice &amp; Store Credit Agent
            </span>
          </div>
        </div>

        {/* Status */}
        <div className="flex items-center gap-3">
          {backendConnected ? (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#f5f5f7] border border-[#e5e7eb]">
              <span className="w-2 h-2 rounded-full bg-[#34c759]" />
              <span className="text-xs text-[#1d1d1f] font-medium">Terminal Online</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <span className="text-xs text-amber-700 font-medium">Connecting...</span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
