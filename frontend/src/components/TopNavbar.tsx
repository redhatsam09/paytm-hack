'use client';

import React from 'react';
import { Radio } from 'lucide-react';

interface TopNavbarProps {
  backendConnected: boolean;
}

export const TopNavbar: React.FC<TopNavbarProps> = ({ backendConnected }) => {
  return (
    <header className="sticky top-0 z-40 bg-[#fcfcfc]/90 backdrop-blur-md border-b border-[#e6e6e6]">
      <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[#3a3f5c] flex items-center justify-center text-white shadow-xs">
            <Radio className="w-4 h-4" />
          </div>
          <span className="font-medium text-lg text-[#3d3d3d] tracking-tight">Vani</span>
        </div>

        {/* Status */}
        <div className="flex items-center gap-2">
          {backendConnected ? (
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0e9f6e]/10 border border-[#0e9f6e]/20">
              <span className="w-2 h-2 rounded-full bg-[#0e9f6e]" />
              <span className="text-xs text-[#0e9f6e] font-medium">Online</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 border border-amber-200">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <span className="text-xs text-amber-600 font-medium">Connecting...</span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
