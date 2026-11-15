'use client';

import React from 'react';
import { Radio, Volume2 } from 'lucide-react';
import { playPaytmChime } from '@/lib/audio';

interface TopNavbarProps {
  backendConnected: boolean;
}

export const TopNavbar: React.FC<TopNavbarProps> = ({ backendConnected }) => {
  return (
    <header className="sticky top-0 z-40 bg-[#fcfcfc]/90 backdrop-blur-md border-b border-[#e6e6e6]">
      <div className="max-w-5xl mx-auto px-6 h-18 flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#3a3f5c] flex items-center justify-center text-white shadow-xs">
            <Radio className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="font-medium text-lg text-[#3d3d3d] tracking-tight">Vani</span>
              <span className="text-xs text-[#717171] font-normal">Counter Terminal</span>
            </div>
            <p className="text-[11px] text-[#717171] leading-none">Autonomous Counter & Credit Workflow</p>
          </div>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-3">
          {/* Status */}
          <span className="text-xs text-[#717171] inline-flex items-center gap-1.5 mr-2">
            {backendConnected ? (
              <>
                <span className="w-2 h-2 rounded-full bg-[#0e9f6e]" />
                <span className="text-[#0e9f6e] font-medium">Terminal Online</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span className="text-amber-600 font-medium">Offline</span>
              </>
            )}
          </span>

          {/* Soundbox audio test button */}
          <button
            type="button"
            onClick={() => playPaytmChime()}
            title="Soundbox audio chime test"
            className="h-10 px-4 rounded-full border border-[#e6e6e6] hover:bg-white text-xs font-medium text-[#3d3d3d] flex items-center gap-1.5 transition-colors cursor-pointer bg-white/70"
          >
            <Volume2 className="w-3.5 h-3.5 text-[#f97316]" />
            <span>Test Chime</span>
          </button>
        </div>
      </div>
    </header>
  );
};
